import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { resolve } from 'path'

/**
 * GET /api/triggers
 * Returns the data the dashboard needs to render copy-paste curl snippets
 * for inbound webhook triggers. Does NOT return the PAT itself.
 */

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

function hasWorker(): boolean {
  // Heuristic: if WEBHOOK_PROXY_URL is configured, the operator has deployed
  // the Cloudflare Worker. We render that URL instead of the raw GitHub API.
  return Boolean(process.env.WEBHOOK_PROXY_URL)
}

export async function GET() {
  const repo = getRepoSlug()
  const workerUrl = process.env.WEBHOOK_PROXY_URL || ''

  return NextResponse.json({
    repo,
    githubApi: repo ? `https://api.github.com/repos/${repo}/dispatches` : '',
    workerUrl,
    proxyDeployed: hasWorker(),
    docsUrl: 'https://github.com/portalfnd/clawtrlautonomous/blob/main/docs/triggers.md',
  })
}
