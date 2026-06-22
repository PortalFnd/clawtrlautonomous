/**
 * Auto-Spec: synthesize a SKILL.md from a natural-language brief.
 *
 * Operator types: "watch USDC reserves on Aerodrome, ping me on 5% drops"
 * We respond with: { name, schedule, var, tags, skill_md, summary }
 *
 * Calls Anthropic's Messages API directly (no SDK) so we don't add a dependency.
 * The model is asked to return a JSON envelope so we don't have to text-parse.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

export interface AutoSpec {
  name: string           // slugified, kebab-case
  description: string    // one line
  schedule: string       // cron expr OR 'workflow_dispatch'
  var: string            // default value, may be ''
  tags: string[]         // e.g. ['crypto'], ['research']
  skill_md: string       // the full SKILL.md body (without frontmatter)
  summary: string        // 1-2 sentence operator-facing summary
}

const SYSTEM_PROMPT = `You are the Auto-Spec engine for Clawtrl Ops, an autonomous agent fleet that runs on GitHub Actions with zero infrastructure.

Your job: turn a one-line operator brief into a runnable Claw skill (SKILL.md).

You always reply with a single JSON object — no prose, no code fences. Schema:

{
  "name": "kebab-case-slug",
  "description": "One sentence. <=120 chars. Verb-first.",
  "schedule": "cron expr like '0 9 * * *' OR 'workflow_dispatch' for on-demand only",
  "var": "default variable value, empty string if none",
  "tags": ["one of: research, dev, crypto, social, productivity, ops"],
  "summary": "1-2 sentences telling the operator what this Claw will do and when",
  "skill_md": "the full SKILL.md body — markdown only, NO frontmatter, will be merged in"
}

Rules:
- name: only [a-z0-9-]. Prefix domain-specific Claws with their domain (e.g. claw-, watch-, brief-) when natural.
- schedule: pick a sane cron. Daily monitors → '0 9 * * *'. Hourly → '0 * * * *'. On-demand only (no cron) → 'workflow_dispatch'. NEVER schedule more often than every 30 min unless the brief explicitly demands real-time.
- var: only set if the brief implies a parameter the operator will tweak (a token, a repo, a topic). Otherwise empty string.
- tags: pick exactly one from the allowed list.
- skill_md must follow the Clawtrl Skill Contract:
  * Start with a one-line context: "Today is \${today}. <what this skill does>"
  * Has a "## Steps" section with numbered concrete actions
  * Uses these primitives where applicable:
      - WebFetch / WebSearch for outbound HTTP (sandbox often blocks raw curl — note this fallback)
      - memory/logs/\${today}.md for state
      - articles/<skill-name>-\${today}.md for outputs
      - ./notify for alerts (silent on quiet days)
  * Has a "## Constraints" section with anti-spam / cost rules
- skill_md must be self-contained and immediately runnable. No placeholders like [REPLACE: X] — fill them in based on the brief.
- If the brief is vague, infer reasonable defaults and call them out in summary.
- If the brief is impossible (e.g. requires a paid API the operator hasn't mentioned), still produce the skill, but mention the missing prerequisite in the summary.

Return ONLY the JSON object.`

export interface SynthesizeOptions {
  brief: string
  model?: string         // defaults to claude-sonnet-4-6
  apiKey?: string        // defaults to env ANTHROPIC_API_KEY
}

export async function synthesizeSpec(opts: SynthesizeOptions): Promise<AutoSpec> {
  const apiKey = opts.apiKey || process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it in Console → Model Providers.')
  }
  const brief = (opts.brief || '').trim()
  if (!brief) throw new Error('Brief is empty.')
  if (brief.length > 1000) throw new Error('Brief is too long (max 1000 chars).')

  const model = opts.model || 'claude-sonnet-4-6'

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Brief:\n${brief}\n\nReturn the JSON envelope.` }],
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 240) || res.statusText}`)
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
  const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text || '').join('').trim()
  if (!text) throw new Error('Auto-Spec returned no content.')

  const parsed = extractJson(text)
  return validateAndNormalize(parsed)
}

/**
 * Extract the first JSON object from a response that may include code fences or stray prose.
 */
function extractJson(text: string): unknown {
  // Strip code fences if present.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : text
  // Find the outermost {...} block.
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('Auto-Spec response did not contain a JSON object.')
  }
  const block = candidate.slice(start, end + 1)
  try {
    return JSON.parse(block)
  } catch (err) {
    throw new Error(`Auto-Spec returned invalid JSON: ${(err as Error).message}`)
  }
}

const ALLOWED_TAGS = ['research', 'dev', 'crypto', 'social', 'productivity', 'ops']

function validateAndNormalize(raw: unknown): AutoSpec {
  if (!raw || typeof raw !== 'object') throw new Error('Auto-Spec returned a non-object.')
  const r = raw as Record<string, unknown>

  const name = slugify(String(r.name || ''))
  if (!name) throw new Error('Auto-Spec did not return a valid name.')

  const description = String(r.description || '').trim().slice(0, 200) || 'Autonomous claw'
  const schedule = normalizeSchedule(String(r.schedule || 'workflow_dispatch'))
  const varValue = typeof r.var === 'string' ? r.var.trim() : ''
  const summary = String(r.summary || '').trim() || description
  const skill_md = String(r.skill_md || '').trim()
  if (!skill_md) throw new Error('Auto-Spec did not return SKILL.md content.')

  let tags: string[] = []
  if (Array.isArray(r.tags)) {
    tags = (r.tags as unknown[])
      .map(t => String(t).toLowerCase().trim())
      .filter(t => ALLOWED_TAGS.includes(t))
  }
  if (!tags.length) tags = ['ops']

  return { name, description, schedule, var: varValue, tags, skill_md, summary }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/**
 * Accept a few schedule shapes and coerce to a valid cron expression or 'workflow_dispatch'.
 */
function normalizeSchedule(s: string): string {
  const t = s.trim().toLowerCase()
  if (!t || t === 'on-demand' || t === 'manual' || t === 'workflow_dispatch') {
    return 'workflow_dispatch'
  }
  // Already a 5-field cron?
  if (/^(\S+\s+){4}\S+$/.test(t)) return t
  // Common short forms.
  if (t === '@daily') return '0 9 * * *'
  if (t === '@hourly') return '0 * * * *'
  if (t === '@weekly') return '0 9 * * 1'
  // Fall back to on-demand if we can't parse.
  return 'workflow_dispatch'
}

/**
 * Render the final SKILL.md including a frontmatter block so the file is drop-in.
 */
export function renderSkillMd(spec: AutoSpec): string {
  const fm = [
    '---',
    `name: ${spec.name}`,
    `description: ${spec.description.replace(/\n/g, ' ')}`,
    `var: "${spec.var.replace(/"/g, '\\"')}"`,
    `tags: [${spec.tags.join(', ')}]`,
    '---',
    '',
  ].join('\n')
  return fm + spec.skill_md.replace(/^\s+/, '') + (spec.skill_md.endsWith('\n') ? '' : '\n')
}
