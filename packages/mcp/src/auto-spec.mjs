/**
 * Auto-Spec — synthesize a SKILL.md from a one-line operator brief.
 *
 * Mirrors dashboard/lib/auto-spec.ts so the MCP server can recruit Claws
 * without needing the dashboard running.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ALLOWED_TAGS = ['research', 'dev', 'crypto', 'social', 'productivity', 'ops']

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
- var: only set if the brief implies a parameter the operator will tweak. Otherwise empty string.
- tags: pick exactly one from the allowed list.
- skill_md must follow the Clawtrl Skill Contract: a one-line context line, a "## Steps" section with numbered concrete actions, uses WebFetch/WebSearch primitives, writes outputs under articles/<skill>-\${today}.md, uses ./notify for alerts (silent on quiet days), and includes a "## Constraints" section with anti-spam / cost rules.
- skill_md must be self-contained and immediately runnable. No placeholders.

Return ONLY the JSON object.`

export async function synthesizeSpec(brief, opts = {}) {
  const apiKey = opts.apiKey || process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set.')

  const trimmed = (brief || '').trim()
  if (!trimmed) throw new Error('Brief is empty.')
  if (trimmed.length > 1000) throw new Error('Brief is too long (max 1000 chars).')

  const model = opts.model || 'claude-sonnet-4-5-20250929'

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
      messages: [{ role: 'user', content: `Brief:\n${trimmed}\n\nReturn the JSON envelope.` }],
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 240) || res.statusText}`)
  }

  const data = await res.json()
  const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text || '').join('').trim()
  if (!text) throw new Error('Auto-Spec returned no content.')

  const parsed = extractJson(text)
  return validate(parsed)
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('Auto-Spec did not return JSON.')
  return JSON.parse(candidate.slice(start, end + 1))
}

function validate(r) {
  if (!r || typeof r !== 'object') throw new Error('Auto-Spec returned non-object.')
  const name = slug(String(r.name || ''))
  if (!name) throw new Error('Auto-Spec did not return a name.')

  const description = String(r.description || '').trim().slice(0, 200) || 'Autonomous claw'
  const schedule = normalizeSchedule(String(r.schedule || 'workflow_dispatch'))
  const varValue = typeof r.var === 'string' ? r.var.trim() : ''
  const summary = String(r.summary || '').trim() || description
  const skill_md = String(r.skill_md || '').trim()
  if (!skill_md) throw new Error('Auto-Spec did not return SKILL.md content.')

  let tags = Array.isArray(r.tags)
    ? r.tags.map(t => String(t).toLowerCase().trim()).filter(t => ALLOWED_TAGS.includes(t))
    : []
  if (!tags.length) tags = ['ops']

  return { name, description, schedule, var: varValue, tags, skill_md, summary }
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

function normalizeSchedule(s) {
  const t = s.trim().toLowerCase()
  if (!t || t === 'on-demand' || t === 'manual' || t === 'workflow_dispatch') return 'workflow_dispatch'
  if (/^(\S+\s+){4}\S+$/.test(t)) return t
  if (t === '@daily') return '0 9 * * *'
  if (t === '@hourly') return '0 * * * *'
  if (t === '@weekly') return '0 9 * * 1'
  return 'workflow_dispatch'
}

export function renderSkillMd(spec) {
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
