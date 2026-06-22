/**
 * Tiny GitHub REST client — no deps, just fetch.
 *
 * Each helper takes a context `{ repo, token, branch }`.
 */

const API = 'https://api.github.com'

function headers(ctx) {
  return {
    'authorization': `Bearer ${ctx.token}`,
    'accept': 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
  }
}

async function check(res) {
  if (res.ok) return res
  const body = await res.text().catch(() => '')
  const err = new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`)
  err.status = res.status
  throw err
}

export async function ghGet(ctx, path, query) {
  const url = new URL(`${API}/repos/${ctx.repo}${path}`)
  if (query) for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, String(v))
  const res = await fetch(url, { headers: headers(ctx) })
  await check(res)
  return res.json()
}

export async function ghPost(ctx, path, body) {
  const res = await fetch(`${API}/repos/${ctx.repo}${path}`, {
    method: 'POST',
    headers: { ...headers(ctx), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  await check(res)
  // Workflow dispatch returns 204 with no body.
  return res.status === 204 ? null : res.json().catch(() => null)
}

export async function ghPut(ctx, filePath, content, message, sha) {
  const body = {
    message,
    branch: ctx.branch,
    content: Buffer.from(content, 'utf-8').toString('base64'),
  }
  if (sha) body.sha = sha
  const res = await fetch(`${API}/repos/${ctx.repo}/contents/${encodeURIComponent(filePath)}`, {
    method: 'PUT',
    headers: { ...headers(ctx), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  await check(res)
  return res.json()
}

export async function getFile(ctx, filePath) {
  return ghGet(ctx, `/contents/${encodeURIComponent(filePath)}`, { ref: ctx.branch })
}

export async function listDir(ctx, dirPath) {
  return ghGet(ctx, `/contents/${encodeURIComponent(dirPath)}`, { ref: ctx.branch })
}

export function decodeBase64(b64) {
  return Buffer.from((b64 || '').replace(/\n/g, ''), 'base64').toString('utf-8')
}

export async function listWorkflowRuns(ctx, workflowFilename, limit = 10) {
  return ghGet(ctx, `/actions/workflows/${workflowFilename}/runs`, { per_page: limit, branch: ctx.branch })
}

export async function dispatchClaw(ctx, { skill, var: skillVar, model }) {
  const inputs = { skill }
  if (skillVar) inputs.var = skillVar
  if (model) inputs.model = model
  return ghPost(ctx, '/actions/workflows/claw.yml/dispatches', { ref: ctx.branch, inputs })
}
