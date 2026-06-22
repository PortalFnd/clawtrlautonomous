/**
 * @clawtrl/mcp — stdio MCP server.
 *
 * Exposes a Clawtrl Ops fleet as MCP tools so Claude Desktop, Cursor,
 * Continue, etc. can drive your autonomous agents directly.
 *
 * Zero infra: runs locally on stdio, talks to your fork via the GitHub
 * API. Optional Anthropic key powers /recruit (Auto-Spec).
 *
 * Required env:
 *   CLAWTRL_REPO        owner/repo of your fork (e.g. you/clawtrlautonomous)
 *   CLAWTRL_TOKEN       GitHub PAT with repo + workflow scopes
 *
 * Optional env:
 *   ANTHROPIC_API_KEY   enables claw.recruit (Auto-Spec)
 *   CLAWTRL_BRANCH      default 'main'
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
  ghGet, ghPost, ghPut, getFile, listDir,
  decodeBase64, listWorkflowRuns, dispatchClaw,
} from './gh.mjs'
import { synthesizeSpec, renderSkillMd } from './auto-spec.mjs'

const REPO = process.env.CLAWTRL_REPO
const TOKEN = process.env.CLAWTRL_TOKEN
const BRANCH = process.env.CLAWTRL_BRANCH || 'main'

// ──────────────────── Rate limiting for claw_run ────────────────────
const RUN_TIMESTAMPS = []
const RUN_RATE_LIMIT_MS = 60_000
const RUN_RATE_MAX = 5

function checkRunRateLimit() {
  const now = Date.now()
  while (RUN_TIMESTAMPS.length && RUN_TIMESTAMPS[0] < now - RUN_RATE_LIMIT_MS) {
    RUN_TIMESTAMPS.shift()
  }
  if (RUN_TIMESTAMPS.length >= RUN_RATE_MAX) return false
  RUN_TIMESTAMPS.push(now)
  return true
}

if (!REPO || !TOKEN) {
  process.stderr.write(
    '[clawtrl-mcp] CLAWTRL_REPO and CLAWTRL_TOKEN must be set.\n' +
    'Add them to your MCP client config, e.g. for Claude Desktop:\n' +
    '  "env": { "CLAWTRL_REPO": "you/clawtrlautonomous", "CLAWTRL_TOKEN": "ghp_..." }\n',
  )
  process.exit(1)
}

const ctx = { repo: REPO, token: TOKEN, branch: BRANCH }

const server = new McpServer({
  name: 'clawtrl-mcp',
  version: '0.1.0',
})

// ───────────────────────────── claw.list ─────────────────────────────
server.tool(
  'claw_list',
  'List every Claw skill registered in claw.yml with its enabled flag and schedule.',
  {},
  async () => {
    const f = await getFile(ctx, 'claw.yml')
    const yml = decodeBase64(f.content)
    const skills = parseSkills(yml)
    return {
      content: [{
        type: 'text',
        text: skills.length
          ? skills.map(s => `${s.enabled ? '●' : '○'} ${s.name} — ${s.schedule}`).join('\n')
          : '(no skills registered)',
      }],
    }
  },
)

// ───────────────────────────── claw.status ───────────────────────────
server.tool(
  'claw_status',
  'Show the last N workflow runs and their status (default 10).',
  { limit: z.number().int().min(1).max(50).optional() },
  async ({ limit = 10 }) => {
    const data = await listWorkflowRuns(ctx, 'claw.yml', limit)
    const lines = (data.workflow_runs || []).map(r =>
      `${statusGlyph(r.conclusion || r.status)} ${r.name} — ${r.conclusion || r.status} (${r.created_at})`,
    )
    return {
      content: [{ type: 'text', text: lines.join('\n') || '(no runs yet)' }],
    }
  },
)

// ───────────────────────────── claw.run ──────────────────────────────
server.tool(
  'claw_run',
  'Dispatch a Claw skill on GitHub Actions. Optional `var` is passed as the skill argument.',
  {
    skill: z.string().min(1),
    var: z.string().optional(),
    model: z.string().optional(),
  },
  async ({ skill, var: skillVar, model }) => {
    if (!checkRunRateLimit()) {
      return {
        content: [{ type: 'text', text: `Rate limit: max ${RUN_RATE_MAX} dispatches per minute. Wait and retry.` }],
        isError: true,
      }
    }
    await dispatchClaw(ctx, { skill, var: skillVar, model })
    return {
      content: [{
        type: 'text',
        text: `Dispatched \`${skill}\`${skillVar ? ` with var="${skillVar}"` : ''}.`,
      }],
    }
  },
)

// ───────────────────────────── claw.feed ─────────────────────────────
server.tool(
  'claw_feed',
  'List the most recent article files written by Claws (the mission feed).',
  { limit: z.number().int().min(1).max(50).optional() },
  async ({ limit = 10 }) => {
    let entries
    try {
      entries = await listDir(ctx, 'articles')
    } catch {
      return { content: [{ type: 'text', text: '(no articles yet)' }] }
    }
    const files = (entries || [])
      .filter(e => e.type === 'file')
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, limit)
    return {
      content: [{
        type: 'text',
        text: files.length ? files.map(f => `• ${f.name}`).join('\n') : '(no articles yet)',
      }],
    }
  },
)

// ───────────────────────────── claw.read_article ─────────────────────
server.tool(
  'claw_read_article',
  'Fetch the body of a specific article by filename (under articles/).',
  { filename: z.string().min(1) },
  async ({ filename }) => {
    if (filename.includes('..') || filename.includes('/')) {
      return { content: [{ type: 'text', text: 'Invalid filename.' }], isError: true }
    }
    const f = await getFile(ctx, `articles/${filename}`)
    return { content: [{ type: 'text', text: decodeBase64(f.content) }] }
  },
)

// ───────────────────────────── claw.wallet ───────────────────────────
server.tool(
  'claw_wallet',
  'Read the agent wallet snapshot (address, network, ETH/USDC balances). Returns "no snapshot" if the wallet hasn\'t synced yet.',
  {},
  async () => {
    try {
      const f = await getFile(ctx, 'wallet/snapshot.json')
      const json = JSON.parse(decodeBase64(f.content))
      return {
        content: [{
          type: 'text',
          text: [
            `address: ${json.address || '—'}`,
            `network: ${json.network || '—'}`,
            `ETH:     ${json.ethBalance ?? '—'}`,
            `USDC:    ${json.usdcBalance ?? '—'}`,
            json.dailyCap ? `daily cap: ${json.dailyCap} USDC` : null,
          ].filter(Boolean).join('\n'),
        }],
      }
    } catch {
      return { content: [{ type: 'text', text: 'No wallet snapshot yet.' }] }
    }
  },
)

// ───────────────────────────── claw.recruit ──────────────────────────
server.tool(
  'claw_recruit',
  'Synthesize a new Claw from a one-line brief using Auto-Spec, then commit SKILL.md to the repo and register it (disabled) in claw.yml. Requires ANTHROPIC_API_KEY.',
  {
    brief: z.string().min(8).max(1000),
    preview: z.boolean().optional(),
  },
  async ({ brief, preview }) => {
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        content: [{ type: 'text', text: 'ANTHROPIC_API_KEY not set in this MCP server\'s env. Auto-Spec is unavailable.' }],
        isError: true,
      }
    }
    const spec = await synthesizeSpec(brief)
    if (preview) {
      return {
        content: [{
          type: 'text',
          text: [
            `name: ${spec.name}`,
            `description: ${spec.description}`,
            `schedule: ${spec.schedule}`,
            `tags: ${spec.tags.join(', ')}`,
            '',
            spec.summary,
          ].join('\n'),
        }],
      }
    }

    // De-dup against existing skills.
    let final = spec.name
    for (let i = 2; i < 50; i++) {
      try { await getFile(ctx, `skills/${final}/SKILL.md`); final = `${spec.name}-${i}` }
      catch { break }
    }
    spec.name = final

    const skillMd = renderSkillMd(spec)
    await ghPut(ctx, `skills/${spec.name}/SKILL.md`, skillMd, `feat: recruit ${spec.name} via mcp auto-spec`)

    // Register in claw.yml
    const conf = await getFile(ctx, 'claw.yml')
    const yml = decodeBase64(conf.content)
    const updated = registerSkill(yml, spec.name, spec.schedule, spec.var)
    if (updated !== yml) {
      await ghPut(ctx, 'claw.yml', updated, `chore: register ${spec.name}`, conf.sha)
    }

    return {
      content: [{
        type: 'text',
        text: `Recruited \`${spec.name}\` (disabled). ${spec.summary}`,
      }],
    }
  },
)

// ───────────────────────────── claw.pause ────────────────────────────
server.tool(
  'claw_pause',
  'Disable a Claw skill in claw.yml (sets enabled: false). The skill stops running on its schedule but remains registered.',
  { skill: z.string().min(1) },
  async ({ skill }) => {
    const conf = await getFile(ctx, 'claw.yml')
    const yml = decodeBase64(conf.content)
    const updated = toggleSkillInYml(yml, skill, false)
    if (updated === yml) {
      return { content: [{ type: 'text', text: `\`${skill}\` is already off duty or not found in claw.yml.` }] }
    }
    await ghPut(ctx, 'claw.yml', updated, `chore: pause ${skill}`, conf.sha)
    return { content: [{ type: 'text', text: `\`${skill}\` taken off duty.` }] }
  },
)

// ───────────────────────────── claw.enable ───────────────────────────
server.tool(
  'claw_enable',
  'Enable a Claw skill in claw.yml (sets enabled: true). The skill resumes its schedule.',
  { skill: z.string().min(1) },
  async ({ skill }) => {
    const conf = await getFile(ctx, 'claw.yml')
    const yml = decodeBase64(conf.content)
    const updated = toggleSkillInYml(yml, skill, true)
    if (updated === yml) {
      return { content: [{ type: 'text', text: `\`${skill}\` is already on duty or not found in claw.yml.` }] }
    }
    await ghPut(ctx, 'claw.yml', updated, `chore: enable ${skill}`, conf.sha)
    return { content: [{ type: 'text', text: `\`${skill}\` put on duty.` }] }
  },
)

// ───────────────────────────── claw.memory ───────────────────────────
server.tool(
  'claw_memory',
  'Read or append to the fleet memory file (memory/MEMORY.md). Use action="read" to get current contents, action="append" to add a note.',
  {
    action: z.enum(['read', 'append']).default('read'),
    note: z.string().optional(),
  },
  async ({ action, note }) => {
    if (action === 'read') {
      try {
        const f = await getFile(ctx, 'memory/MEMORY.md')
        return { content: [{ type: 'text', text: decodeBase64(f.content) || '(memory file is empty)' }] }
      } catch {
        return { content: [{ type: 'text', text: 'No memory file yet.' }] }
      }
    }
    if (action === 'append') {
      if (!note) return { content: [{ type: 'text', text: 'note is required for append action.' }], isError: true }
      let sha
      let existing = ''
      try {
        const f = await getFile(ctx, 'memory/MEMORY.md')
        sha = f.sha
        existing = decodeBase64(f.content)
      } catch {}
      const ts = new Date().toISOString().slice(0, 10)
      const updated = (existing ? existing + '\n' : '') + `\n## ${ts}\n\n${note}\n`
      await ghPut(ctx, 'memory/MEMORY.md', updated, `memory: ${note.slice(0, 60)}`, sha)
      return { content: [{ type: 'text', text: 'Memory updated.' }] }
    }
  },
)

// ───────────────────────────── helpers ───────────────────────────────
function statusGlyph(s) {
  return s === 'success' ? '●' : s === 'failure' ? '✗' : s === 'in_progress' || s === 'queued' ? '◐' : '○'
}

function parseSkills(yml) {
  // Lightweight parse: grab the inline-flow skill entries `name: { enabled: true, schedule: "..." }`.
  const out = []
  const skillsBlock = yml.split(/^skills:\s*$/m)[1]
  if (!skillsBlock) return out
  const top = skillsBlock.split(/^\S/m)[0]
  for (const line of top.split('\n')) {
    const m = line.match(/^\s{2}([a-z0-9-]+):\s*\{([^}]*)\}/i)
    if (!m) continue
    const name = m[1]
    const body = m[2]
    const enabled = /enabled:\s*true/i.test(body)
    const schedule = (body.match(/schedule:\s*"([^"]*)"/) || [])[1] || ''
    out.push({ name, enabled, schedule })
  }
  return out
}

function registerSkill(yml, name, schedule, varValue) {
  if (yml.includes(`\n  ${name}:`)) return yml
  const entry = `  ${name}: { enabled: false, schedule: "${schedule}"${varValue ? `, var: "${varValue.replace(/"/g, '\\"')}"` : ''} }\n`
  // Insert before the heartbeat fallback.
  const idx = yml.indexOf('\n  heartbeat:')
  if (idx < 0) return yml + entry
  return yml.slice(0, idx + 1) + entry + yml.slice(idx + 1)
}

function toggleSkillInYml(yml, name, enabled) {
  const re = new RegExp(`^(\\s{2}${name}:\\s*\\{[^}]*enabled:\\s*)(true|false)([^}]*\\})`, 'im')
  const match = yml.match(re)
  if (!match) return yml
  const target = enabled ? 'true' : 'false'
  if (match[2] === target) return yml
  return yml.replace(re, `${match[1]}${target}${match[3]}`)
}

// ───────────────────────────── boot ──────────────────────────────────
const transport = new StdioServerTransport()
await server.connect(transport)
process.stderr.write(`[clawtrl-mcp] connected to ${REPO}@${BRANCH}\n`)
