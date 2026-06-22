/**
 * Cloudflare Worker — Clawtrl webhook proxy.
 *
 * Receives `POST /trigger/<skill>` from external systems (Stripe, Zapier,
 * Alchemy, etc.), HMAC-verifies the body, then forwards to GitHub's
 * `repository_dispatch` endpoint to fire the matching Claw.
 *
 * Deploy:
 *   1. Install wrangler: `npm i -g wrangler`
 *   2. From workers/: `wrangler deploy`
 *   3. Set secrets:
 *        wrangler secret put GITHUB_TOKEN          # PAT with repo + workflow scopes
 *        wrangler secret put WEBHOOK_HMAC_SECRET   # any high-entropy string
 *   4. Set vars in wrangler.toml:
 *        GITHUB_REPO = "owner/repo"
 *
 * Calling it:
 *   POST https://<worker>.workers.dev/trigger/morning-brief
 *   Header: X-Signature: sha256=<hex(hmac_sha256(SECRET, body))>
 *   Body:   { "var": "the last 24h", "model": "claude-sonnet-4-6" }
 *
 *   Returns 202 on success, 401 on bad HMAC, 5xx on GitHub error.
 */

interface Env {
  GITHUB_TOKEN: string
  WEBHOOK_HMAC_SECRET: string
  GITHUB_REPO: string // "owner/repo"
}

const ALLOWED_SKILL_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/i
const MAX_BODY_BYTES = 64 * 1024

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method !== 'POST') return text(405, 'POST only')

    const url = new URL(req.url)
    const m = url.pathname.match(/^\/trigger\/([^/]+)\/?$/)
    if (!m) return text(404, 'route: POST /trigger/<skill>')

    const skill = m[1]
    if (!ALLOWED_SKILL_NAME.test(skill)) return text(400, 'invalid skill name')

    const raw = await req.arrayBuffer()
    if (raw.byteLength > MAX_BODY_BYTES) return text(413, 'body too large')

    const sigHeader = req.headers.get('x-signature') || ''
    if (!(await verifyHmac(env.WEBHOOK_HMAC_SECRET, raw, sigHeader))) {
      return text(401, 'bad signature')
    }

    let payload: Record<string, unknown> = {}
    if (raw.byteLength > 0) {
      try {
        payload = JSON.parse(new TextDecoder().decode(raw))
      } catch {
        return text(400, 'body must be JSON')
      }
    }

    const ghRes = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.GITHUB_TOKEN}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'content-type': 'application/json',
        'user-agent': 'clawtrl-webhook-proxy',
      },
      body: JSON.stringify({ event_type: `trigger-${skill}`, client_payload: payload }),
    })

    if (!ghRes.ok) {
      const detail = await ghRes.text().catch(() => '')
      return text(502, `github ${ghRes.status}: ${detail.slice(0, 200)}`)
    }

    return text(202, `dispatched trigger-${skill}`)
  },
}

async function verifyHmac(secret: string, body: ArrayBuffer, header: string): Promise<boolean> {
  const provided = header.replace(/^sha256=/, '').trim()
  if (!provided) return false

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, body)
  const expected = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return constantTimeEqual(expected, provided)
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function text(status: number, body: string): Response {
  return new Response(body + '\n', { status, headers: { 'content-type': 'text/plain' } })
}
