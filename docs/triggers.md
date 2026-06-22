# Inbound triggers

Out of the box, Claws are pulled by cron. With **inbound triggers**, any external system can *push* an event that fires a Claw with a payload. This turns the swarm from a scheduler into a reactor.

## How it works

Every Claw is reachable via GitHub's native `repository_dispatch` API. The `claw.yml` workflow listens for events of type `trigger-<skill>`:

```yaml
on:
  repository_dispatch:
    types: [trigger-*]
```

When a payload arrives, the workflow extracts the skill name from the event type, pulls `var` and `model` out of the `client_payload`, and dispatches the Claw exactly as if you had clicked Run from the dashboard.

## The minimal call

```bash
curl -X POST \
  -H "Authorization: Bearer $GITHUB_PAT" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/<owner>/<repo>/dispatches \
  -d '{
    "event_type": "trigger-morning-brief",
    "client_payload": { "var": "the last 24h", "model": "claude-sonnet-4-6" }
  }'
```

The PAT needs the `repo` scope (or for fine-grained PATs: *Actions: read & write* + *Contents: read & write* on the target repo).

## Wiring up common sources

### Stripe webhooks

Stripe wants a URL endpoint. Two options:

- **Cloudflare Worker proxy** (recommended) — see `workers/webhook-proxy.ts`. Deploys for free, runs HMAC verification, re-signs the GitHub call. Latency: ~150ms.
- **Zapier / Make** — both can ingest a Stripe webhook and POST to GitHub's dispatch endpoint with a stored PAT. Latency: ~5s, depends on tier.

### GitHub webhooks (other repos)

You can wire any GitHub webhook (PR opened, issue commented, release published) on *another* repo to dispatch a Claw on yours. Use a GitHub App or a fine-grained PAT for the cross-repo call. The `client_payload` should be the original webhook body — your Claw can parse out what it needs.

### On-chain events

Alchemy, QuickNode, and Tenderly all support webhook delivery on contract events. Point them at the Cloudflare Worker; the Worker forwards to `repository_dispatch`. Your `claw-onchain-alpha` (or any custom Claw) reacts within seconds.

### Email-in

Postmark / SendGrid Inbound Parse / Cloudflare Email Routing all forward incoming email as JSON. The Worker parses the body and dispatches a `trigger-process-inbound-email` event. Useful for "forward a mail to your bot."

### Calendar events

Google Calendar webhooks → Worker → dispatch a `trigger-pre-meeting-brief` Claw 15 minutes before any event with a specific tag. Becomes a real-time prep assistant.

## Cloudflare Worker template

A complete, deploy-ready Worker lives at [`workers/webhook-proxy.ts`](../workers/webhook-proxy.ts). It:

1. Receives a `POST /trigger/<skill>` request.
2. Verifies an HMAC signature in the `X-Signature` header against `WEBHOOK_HMAC_SECRET`.
3. Forwards the body as `client_payload` to GitHub's `repository_dispatch` endpoint, signed with `GITHUB_TOKEN`.
4. Returns 202 on success, 401 on auth failure, 502 on GitHub error.

Deploy with `wrangler deploy`. The worker source stays in your repo; the secret keys are configured via `wrangler secret put`.

## Security notes

- **Never commit the PAT.** It lives as a Cloudflare Worker secret or in your webhook source's secret store.
- **Always HMAC-verify** inbound webhooks. The Worker template does this; if you skip the proxy, your raw GitHub PAT becomes the credential and you cannot rotate it per-source.
- **Rate-limit at the source.** GitHub will throttle `repository_dispatch` at ~5000 calls/hour per token. The Worker enforces a per-skill rate limit before the upstream call.
- **Use a per-skill PAT** if you want fine-grained revocation. Each Worker route can carry a different `GITHUB_TOKEN` binding.

## Why this respects the architecture

Everything is still in the repo:

- The trigger spec lives in `claw.yml` (one stanza)
- The Worker source lives in `workers/webhook-proxy.ts`
- The deployment config lives in `workers/wrangler.toml`
- The Worker secrets live outside git but the *intent* (which routes exist, which Claws they map to) is fully version-controlled

There is no central listener you depend on. If you swap Cloudflare for Deno Deploy, Vercel Edge, AWS Lambda, or your own VPS, the contract is unchanged: `POST /trigger/<skill>` with HMAC, forward to `repository_dispatch`. Three lines of glue.

## Quick test

After enabling inbound triggers, fire a test from anywhere:

```bash
gh api repos/:owner/:repo/dispatches \
  -f event_type=trigger-heartbeat \
  -f 'client_payload[var]=test from cli'
```

You should see a new run appear in `gh run list --workflow claw.yml` within ~2 seconds. If it doesn't, check the workflow's `Determine skill` step output for the dispatched event type.
