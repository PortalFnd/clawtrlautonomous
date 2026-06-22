import { NextResponse } from 'next/server'
import { readdir, readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { execSync } from 'child_process'

const OUTPUTS_DIR = join(process.cwd(), 'outputs')
const REPO_ROOT = resolve(process.cwd(), '..')

export async function GET() {
  try {
    const files = await readdir(OUTPUTS_DIR).catch(() => [] as string[])
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort((a, b) => {
      // Extract timestamp from filename: <skill>-<YYYY-MM-DDTHH-MM-SSZ>.json
      const tsA = a.match(/(\d{4}-\d{2}-\d{2}T[\d-]+Z)\.json$/)?.[1] || ''
      const tsB = b.match(/(\d{4}-\d{2}-\d{2}T[\d-]+Z)\.json$/)?.[1] || ''
      return tsB.localeCompare(tsA) // newest first
    })

    const outputs = await Promise.all(
      jsonFiles.slice(0, 100).map(async (filename) => {
        try {
          const raw = await readFile(join(OUTPUTS_DIR, filename), 'utf-8')
          const spec = JSON.parse(raw)
          // Parse skill name and timestamp from filename: <skill>-<timestamp>.json
          const base = filename.replace('.json', '')
          const tsMatch = base.match(/^(.+?)-(\d{4}-\d{2}-\d{2}T.+Z)$/)
          return {
            filename,
            skill: tsMatch ? tsMatch[1] : base,
            timestamp: tsMatch ? tsMatch[2] : '',
            spec,
          }
        } catch {
          return null
        }
      })
    )

    return NextResponse.json({ outputs: outputs.filter(Boolean) })
  } catch {
    return NextResponse.json({ outputs: [] })
  }
}

export async function POST() {
  const run = (cmd: string) =>
    execSync(cmd, { stdio: 'pipe', cwd: REPO_ROOT, timeout: 20_000 }).toString().trim()
  const tryRun = (cmd: string) => {
    try { return run(cmd) } catch { return null }
  }

  let stashed = false
  try {
    // Bail early if we're already in the middle of a rebase or merge
    const inRebase = tryRun('test -d .git/rebase-merge -o -d .git/rebase-apply && echo yes || true') === 'yes'
    const inMerge = tryRun('test -f .git/MERGE_HEAD && echo yes || true') === 'yes'
    if (inRebase || inMerge) {
      return NextResponse.json({
        error: 'Repo is mid-rebase or mid-merge. Resolve it manually in a terminal, then retry.',
      }, { status: 409 })
    }

    // Stash anything dirty so the rebase has a clean tree
    const dirty = run('git status --porcelain').length > 0
    if (dirty) {
      run('git stash push --include-untracked --message "clawtrl-ops auto-stash"')
      stashed = true
    }

    // Attempt the pull
    try {
      run('git pull --rebase --autostash=false origin main')
    } catch (err) {
      // Abort any half-applied rebase so the tree is never left in conflict state
      tryRun('git rebase --abort')
      throw err
    }

    // Restore our stash if we made one
    if (stashed) {
      try {
        run('git stash pop')
        stashed = false
      } catch {
        // Conflict on pop. Leave the stash intact so the user can recover it.
        return NextResponse.json({
          ok: false,
          warning: 'Pull succeeded but local changes could not be re-applied automatically. Recover with `git stash pop` and resolve conflicts.',
        }, { status: 207 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    // Last-ditch: try to put the stash back so the working tree isn't lost
    if (stashed) tryRun('git stash pop')
    const msg = e instanceof Error ? e.message : 'Pull failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
