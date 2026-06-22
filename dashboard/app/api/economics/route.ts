import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { resolve } from 'path'
import { getFileContent, getDirectory } from '@/lib/github'
import { parseConfig } from '@/lib/config'
import { getModel } from '@/lib/providers'

/**
 * GET /api/economics?days=30
 *
 * Cost / output per Claw, derived from sources that already exist:
 *   - gh run list (status, duration)
 *   - claw.yml (per-skill model)
 *   - providers registry (token pricing)
 *   - articles/ directory listing
 *   - wallet/tx-log.jsonl (on-chain spend)
 *
 * Cost is an estimate. We don't yet log per-run token usage, so we approximate:
 *   tokens ≈ duration_seconds * 80   (typical agent throughput)
 *   cost   ≈ tokens * (input_price * 0.3 + output_price * 0.7) / 1_000_000
 * The estimate is intentionally pessimistic — better to over-show cost than to
 * under-show it. Once we wire real usage logging, this falls back to actuals.
 */

interface EconRow {
  skill: string
  model: string | null
  runs: number
  successes: number
  failures: number
  avgDurationSec: number
  totalDurationSec: number
  estCostUsd: number
  articles: number
  enabled: boolean
}

interface EconResponse {
  days: number
  generatedAt: string
  rows: EconRow[]
  totals: {
    runs: number
    successes: number
    failures: number
    estCostUsd: number
    walletSpendUsd: number
    articles: number
  }
}

const TOKENS_PER_SECOND = 80
const INPUT_WEIGHT = 0.3
const OUTPUT_WEIGHT = 0.7

function getRepoSlug(): string {
  if (process.env.GITHUB_REPO) return process.env.GITHUB_REPO
  try {
    const url = execSync('git remote get-url origin', {
      stdio: 'pipe',
      cwd: resolve(process.cwd(), '..'),
    })
      .toString()
      .trim()
    const m = url.match(/github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?$/)
    return m ? m[1] : ''
  } catch {
    return ''
  }
}

function ghAvailable(): boolean {
  try {
    execSync('gh auth status', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function fetchRuns(repo: string, since: Date): Array<{ skill: string; conclusion: string; durationSec: number }> {
  const out: Array<{ skill: string; conclusion: string; durationSec: number }> = []
  if (!ghAvailable()) return out
  try {
    const json = execSync(
      `gh api "/repos/${repo}/actions/workflows/claw.yml/runs?per_page=100&created=>=${since.toISOString().slice(0, 10)}"`,
      { stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 },
    ).toString()
    const data = JSON.parse(json)
    for (const run of data.workflow_runs || []) {
      const name = (run.name || run.display_title || '').match(/skill:\s*([a-z0-9-]+)/i)
      if (!name) continue
      const start = new Date(run.run_started_at || run.created_at).getTime()
      const end = new Date(run.updated_at).getTime()
      const durationSec = Math.max(0, (end - start) / 1000)
      out.push({
        skill: name[1],
        conclusion: run.conclusion || run.status || 'unknown',
        durationSec,
      })
    }
  } catch {
    // gh paginated/timeouts — best effort
  }
  return out
}

async function readWalletSpend(): Promise<number> {
  try {
    const f = await getFileContent('wallet/tx-log.jsonl')
    let total = 0
    for (const line of f.content.split('\n')) {
      const t = line.trim()
      if (!t) continue
      try {
        const j = JSON.parse(t)
        if (typeof j.amount_usd === 'number') total += j.amount_usd
      } catch { /* skip */ }
    }
    return total
  } catch {
    return 0
  }
}

async function listArticles(): Promise<string[]> {
  try {
    const entries = await getDirectory('articles')
    return entries.filter(e => e.type === 'file').map(e => e.name)
  } catch {
    return []
  }
}

function articleCountFor(skill: string, articles: string[]): number {
  // Convention: articles/<skill>-<date>.md
  const prefix = `${skill}-`
  return articles.filter(a => a.startsWith(prefix) && a.endsWith('.md')).length
}

function estimateCost(model: string | null, durationSec: number): number {
  if (!model) return 0
  const m = getModel(model)
  if (!m || (m.inputUsdPerMTok === 0 && m.outputUsdPerMTok === 0)) return 0
  const tokens = durationSec * TOKENS_PER_SECOND
  const blendedRate = m.inputUsdPerMTok * INPUT_WEIGHT + m.outputUsdPerMTok * OUTPUT_WEIGHT
  return (tokens * blendedRate) / 1_000_000
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') ?? 30)))

  const repo = getRepoSlug()
  if (!repo) return NextResponse.json({ error: 'no repo configured' }, { status: 400 })

  const since = new Date(Date.now() - days * 86400 * 1000)

  const [configFile, articles, walletSpendUsd] = await Promise.all([
    getFileContent('claw.yml').catch(() => ({ content: '' })),
    listArticles(),
    readWalletSpend(),
  ])
  const config = parseConfig(configFile.content)
  const skillsByName = new Map(Object.entries(config.skills))

  const runs = fetchRuns(repo, since)

  // Aggregate per skill.
  const acc = new Map<string, EconRow>()
  for (const r of runs) {
    const skillCfg = skillsByName.get(r.skill)
    const model = skillCfg?.model || config.model || null
    let row = acc.get(r.skill)
    if (!row) {
      row = {
        skill: r.skill,
        model,
        runs: 0,
        successes: 0,
        failures: 0,
        avgDurationSec: 0,
        totalDurationSec: 0,
        estCostUsd: 0,
        articles: articleCountFor(r.skill, articles),
        enabled: skillCfg?.enabled ?? false,
      }
      acc.set(r.skill, row)
    }
    row.runs += 1
    if (r.conclusion === 'success') row.successes += 1
    else if (r.conclusion === 'failure') row.failures += 1
    row.totalDurationSec += r.durationSec
    row.estCostUsd += estimateCost(model, r.durationSec)
  }
  for (const row of acc.values()) {
    row.avgDurationSec = row.runs > 0 ? row.totalDurationSec / row.runs : 0
  }

  const rows = [...acc.values()].sort((a, b) => b.estCostUsd - a.estCostUsd)
  const totals = rows.reduce(
    (acc, r) => {
      acc.runs += r.runs
      acc.successes += r.successes
      acc.failures += r.failures
      acc.estCostUsd += r.estCostUsd
      acc.articles += r.articles
      return acc
    },
    { runs: 0, successes: 0, failures: 0, estCostUsd: 0, walletSpendUsd, articles: 0 },
  )

  const body: EconResponse = {
    days,
    generatedAt: new Date().toISOString(),
    rows,
    totals,
  }
  return NextResponse.json(body)
}
