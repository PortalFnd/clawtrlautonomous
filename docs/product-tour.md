# Clawtrl Ops — Product Tour

**Autonomous Claws that never sleep.** This is the long-form walkthrough of what Clawtrl Ops actually *is*, what every moving part does, and where it's headed next.

If you just want to ship: skim **§1 The 30-second pitch** and **§4 Recruit your first Claw**. Everything else is reference.

---

## 1 · The 30-second pitch

Clawtrl Ops is a self-hostable swarm of small, single-purpose AI agents — *Claws* — that you can wake, pause, recruit, and re-mission from a local Next.js dashboard, a Telegram chat, or any MCP-aware client (Claude Desktop, Cursor, Continue, Zed).

- **Zero servers.** Every Claw is a `SKILL.md` checked into your fork. They run on GitHub Actions cron. The dashboard is `next dev` on your laptop.
- **One secret to start.** Drop in `ANTHROPIC_API_KEY`, hit *Recruit*, type a one-line brief, and a new Claw is born — disabled by default, fully auditable as a single PR commit.
- **Bring your own wallet.** A Base agent wallet handles x402-gated APIs and on-chain reads with hard daily caps and per-call ceilings, so the swarm can pay for its own data without you babysitting it.
- **Speak any protocol.** Telegram bridge for ops chatter, MCP server for tool-use from any LLM client, GitHub PRs for everything material.

Think of it as a Vercel for autonomous agents, except it's just your fork plus a 200-line Next.js app, and every action leaves a git trail.

---

## 2 · The architecture in one diagram

```
                ┌──────────────────────────────────────────────────────────┐
                │                       Operator                           │
                │  Dashboard · Telegram · MCP client (Claude Desktop, …)   │
                └────────────────┬───────────────────┬─────────────────────┘
                                 │                   │
                  GitHub REST API│                   │stdio MCP / HTTP
                                 ▼                   ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │                    Your fork (single source of truth)                │
   │                                                                      │
   │   claw.yml ─── lists every Claw, schedule, model override            │
   │   skills/<name>/SKILL.md ─── the Claw's prompt + steps               │
   │   memory/ ─── cron-state.json, MEMORY.md, per-Claw state             │
   │   articles/ ─── outputs the operator actually reads                  │
   │   wallet/ ─── snapshot.json, tx-log.jsonl, x402-receipts.jsonl       │
   │   data/x402-cache/<date>/ ─── pre-warmed paid data                   │
   └────────────────────────────┬─────────────────────────────────────────┘
                                │
                  workflow_dispatch
                                ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │                .github/workflows/claw.yml — the Aeon engine          │
   │   1. Resolve skill + model                                           │
   │   2. Validate secrets                                                │
   │   3. Pre-fetch (xAI / Vercel / Replicate prep scripts)               │
   │   4. Run Claude Code with the SKILL.md as the system prompt          │
   │   5. Notify (Telegram / Discord / Slack / Email)                     │
   │   6. Post-process (Dev.to syndication, Farcaster casts, …)           │
   │   7. Commit results back to main                                     │
   └──────────────────────────────────────────────────────────────────────┘
```

There are two other workflows:

- `.github/workflows/messages.yml` — chat dispatcher (turns Telegram replies into skill runs)
- `.github/workflows/chain-runner.yml` — runs *chains* (multi-Claw pipelines)
- `.github/workflows/telegram-burst.yml` — long-poll mode for live ops sessions
- `.github/workflows/sync-upstream.yml` — pulls in upstream Aeon improvements

---

## 3 · What lives where

### `claw.yml`
The fleet manifest. Every cron-scheduled Claw appears here as one inline-flow line:

```yaml
skills:
  morning-brief: { enabled: true, schedule: "0 7 * * *" }
  claw-onchain-alpha: { enabled: false, schedule: "30 9 * * *", var: "" }
  heartbeat: { enabled: true, schedule: "0 8,14,20 * * *" }
```

Three booleans matter:

- **enabled** — whether the scheduler dispatches it
- **schedule** — cron expression OR `workflow_dispatch` for on-demand
- **var** — default argument passed as `${var}` inside the SKILL.md

### `skills/<name>/SKILL.md`
A markdown file with YAML frontmatter. The frontmatter is metadata; the body is the Claude Code system prompt. Every Claw follows the same shape:

```markdown
---
name: my-claw
description: One-sentence verb-first summary
var: "default arg"
tags: [research]
---

Today is ${today}. <one-line context>

## Steps
1. Concrete action
2. Concrete action

## Constraints
- Anti-spam rules
- Cost ceilings
```

### `memory/`
Persistent state the swarm reads and writes:

- `MEMORY.md` — the operator's running notebook; Claws read it for context
- `cron-state.json` — per-Claw success/failure tracking; powers the heartbeat health checks
- `logs/` — daily logs of what each Claw did
- `telegram-relay/state.json` — last update_id for the Telegram bridge

### `articles/`
The outputs the human cares about. Every Claw that produces a digest writes `articles/<skill>-<date>.md`. This directory is the mission feed.

### `wallet/`
- `snapshot.json` — address, network, ETH/USDC balances, daily cap (display only)
- `tx-log.jsonl` — append-only ledger of every spend
- `x402-receipts.jsonl` — settled paid fetches with tx hashes

The private key never lives in the repo — it's a GitHub secret.

### `dashboard/`
A Next.js app you run locally. It reads/writes the repo via the GitHub CLI, surfaces secrets in a typed Console, and gives you the Recruit / Run / Pause UI.

### `packages/mcp/`
The npm package that exposes the fleet over MCP stdio.

### `scripts/`
Glue code that's too messy or too security-sensitive to live inline in a SKILL.md:

- `telegram-relay.sh` — single Telegram poll cycle
- `x402-pay.mjs` — EIP-3009 signer for paid fetches
- `prefetch-*.sh` — warm-up scripts run before the Claude step
- `postprocess-*.sh` — distribution scripts (Dev.to, Farcaster) run after

---

## 4 · Recruit your first Claw

The fastest path from idea to running agent:

1. **Set `ANTHROPIC_API_KEY`** in the dashboard's Secrets Console. The Console writes it as a GitHub secret via `gh secret set`, so it lives where the workflow can read it.
2. **Click *Recruit Claw*** in the dashboard header.
3. **Pick *From a brief*** and type something concrete:
   > *"Every Monday 8am UTC, summarize the last week of ETH gas-price moves and ping me only if the median crossed a 5-day moving average."*
4. **Click Preview.** The Auto-Spec engine returns a JSON envelope with `name`, `schedule`, `tags`, and a draft `summary`. You're seeing exactly what would be written.
5. **Click Recruit.** The new Claw lands as a single commit (`feat: recruit <name> via auto-spec`) and gets registered in `claw.yml` **disabled**. Inspect the diff, then flip it on.

That whole flow is also one tool call away from any MCP client:

```
claw_recruit(brief="Every Monday 8am UTC, summarize ETH gas …", preview=true)
claw_recruit(brief="Every Monday 8am UTC, summarize ETH gas …")
```

---

## 5 · The skills you already have

Out of the box your fork ships ~70 skills. They cluster into themes:

### Information
- **autoresearch / deep-research** — long-running research with citations
- **github-trending / github-releases / github-monitor** — code-world signals
- **ai-framework-watch / agent-buzz** — the AI-tooling beat
- **fetch-tweets / refresh-x** — Twitter pull (xAI Live Search)
- **farcaster-digest** — Farcaster pull
- **defi-monitor / defi-overview / aixbt-pulse** — crypto pulse
- **competitor-launch-radar / external-feature** — product intelligence

### Synthesis
- **morning-brief / evening-recap / daily-routine** — operator briefings
- **digest / channel-recap / list-digest** — long-form rollups
- **goal-tracker** — your written goals, checked weekly

### Action
- **distribute-tokens / contributor-reward** — onchain rewards
- **schedule-ads / create-campaign** — paid acquisition (paused by default)
- **deploy-prototype** — Vercel-deploy from a brief

### Health
- **heartbeat** — proactive ambient check; flags failed/stuck/chronic Claws
- **self-improve** — the swarm proposing patches to itself
- **skill-health / skill-update-check / skill-repair** — Claw QA
- **workflow-security-audit** — checks `claw.yml` and skills for risky permissions
- **fleet-control / fleet-state** — birds-eye view across forks

### Distribution
- **show-hn-draft / product-hunt-launch / smithery-manifest** — launch toolkit
- **fork-cohort / fork-skill-digest / fork-fleet** — multi-fork orchestration

You wake any of them by toggling `enabled: true` in `claw.yml` (commit) or clicking *Wake* in the dashboard.

---

## 6 · The new skills (this release)

### 6.1 `telegram-relay` (and `telegram-burst.yml`)
A two-way Telegram bridge. The cron mode polls every 15 minutes and processes any `/commands` you sent in your bot chat. Burst mode long-polls for ~9 minutes at a time, giving you sub-second latency during live sessions.

Commands:
- `/status` — last 5 workflow runs
- `/run <skill> [-- var]` — dispatch any Claw
- `/pause <skill>` / `/wake <skill>` — flip enabled flags (commits `claw.yml`)
- `/wallet` — agent wallet snapshot
- `/feed [n]` — latest articles
- `/recruit <brief>` — pointer to dashboard (Auto-Spec lives there)
- `/help` — list

The whole dispatcher is in `scripts/telegram-relay.sh` so the same handler powers both modes. Security model: messages from any chat ID other than `TELEGRAM_CHAT_ID` are dropped silently.

### 6.2 `claw-x402-paywatcher`
The first Claw that pays for its own data. Reads a `X402_TARGETS` env var (newline-separated `<label> <url>` pairs), fetches each:

1. `GET` unauthenticated — 200? save body, done.
2. `402`? parse the challenge, validate it's USDC on Base under your daily cap and below the hard 0.5 USDC per-call ceiling.
3. Sign EIP-3009 `transferWithAuthorization`, retry with `X-Payment` header.
4. On success, write the body to `data/x402-cache/<date>/<label>.json` and append receipts to `wallet/x402-receipts.jsonl`.

Runs every 6h by default. Disabled until you provision the wallet + targets.

### 6.3 `claw-onchain-alpha`
A pure synthesizer — never pays for anything itself. Consumes the paywatcher's cache plus free RPC reads (Base block height, gas, USDC balance) and writes `articles/claw-onchain-alpha-<date>.md` with a TL;DR, market table, signal paragraphs, wallet section, and a 3–5 item watchlist.

If today's cache is empty it falls back to a *degraded mode* with free APIs and notes that in the frontmatter. First-day no-cache is expected, not an alarm.

### 6.4 Auto-Spec (Recruit Claw → From a brief)
Lives in `dashboard/lib/auto-spec.ts` and `dashboard/app/api/recruit/route.ts`. Given a one-line brief, it asks Claude for a JSON envelope:

```json
{ "name": "kebab-slug", "description": "…", "schedule": "0 9 * * *",
  "var": "", "tags": ["ops"], "summary": "…", "skill_md": "<full body>" }
```

The route validates, slugifies, normalizes the cron expression, de-dupes against existing skills, writes `skills/<name>/SKILL.md`, and registers the new Claw (disabled) in `claw.yml`. Two commits, fully reversible.

`preview: true` returns the envelope without committing — useful in the dashboard's preview pane and over MCP.

### 6.5 `@clawtrl/mcp`
A stdio MCP server you install with `npx -y @clawtrl/mcp`. Tools:

- `claw_list` — every skill + enabled flag + schedule
- `claw_status` — last N runs
- `claw_run` — dispatch a skill (optionally with `var` and `model`)
- `claw_recruit` — Auto-Spec from your MCP client (needs `ANTHROPIC_API_KEY`)
- `claw_feed` — latest articles
- `claw_read_article` — body of one article
- `claw_wallet` — wallet snapshot

Configure once in Claude Desktop / Cursor / Continue / Zed and the entire fleet becomes available as tools to whatever model you're chatting with.

---

## 7 · The lifecycle of a single mission

Take *morning-brief* as the example. Here's what happens at 07:00 UTC:

1. **Cron tick.** GitHub Actions sees the `0 7 * * *` schedule on the workflow's `schedule:` block, dispatches `claw.yml` with `inputs.skill = morning-brief`.
2. **Checkout + identity.** The runner clones your fork as `clawframework`.
3. **Validate secrets.** Each skill declares required secrets in its frontmatter; the workflow short-circuits with a clear error if any are missing.
4. **Pre-fetch.** Scripts under `scripts/prefetch-*.sh` run if relevant (e.g. `prefetch-xai.sh` warms a tweet feed).
5. **Run Claude Code.** The SKILL.md becomes the system prompt; Claude has Bash, WebFetch, WebSearch, gh, and the repo filesystem.
6. **Outputs land.** Articles into `articles/`, memory updates into `memory/`, optional notify hooks into `.pending-notify/`.
7. **Notify.** The workflow re-delivers any `.pending-notify/*.md` over Telegram / Discord / Slack / SendGrid based on which secrets are set.
8. **Post-process.** Dev.to syndication, Farcaster casts, etc.
9. **Commit + push.** Single auto-commit on `main` (or a feature branch + PR for self-mutating Claws).
10. **State update.** `memory/cron-state.json` records success/failure for the heartbeat to read later.

Every step is observable in `gh run view` and recoverable by reverting one commit.

---

## 8 · Cost model

Three things cost money:

- **Claude tokens.** Every dispatch is one Claude Code session; sane Claws cost cents per run.
- **GitHub Actions minutes.** Free tier covers ~2,000 minutes/month for private repos. Public forks are unmetered. A 30-second Claw uses 30 seconds.
- **On-chain.** Only when you wake the wallet skills. Capped at `CLAWTRL_WALLET_DAILY_CAP_USDC` and 0.5 USDC per x402 call.

The Console shows estimated daily token spend per skill (sum of `last_quality_score`-weighted runs). If a Claw goes haywire, the heartbeat catches it within 6 hours.

---

## 9 · Security model

The threat model is straightforward: a single operator running the fleet on their own infra. We don't try to be multi-tenant.

Boundaries:
- **Secrets** never leave GitHub. The dashboard reads them only via `gh secret list`, never their values.
- **Wallet private key** is a GitHub secret, never logged, never committed. The dashboard surfaces only the address and balances.
- **Telegram bridge** drops any message from a chat ID that isn't yours. There is no "shared bot" mode.
- **MCP server** runs locally on stdio; your PAT stays on your machine.
- **Auto-Spec** writes new skills as **disabled** so a malformed synthesis can't accidentally run.
- **x402** rejects any challenge above the per-call ceiling, regardless of cap headroom.
- **Sync from upstream** opens a PR; never auto-merges.

The audit trail is the git history. Every action is one commit, signed by `clawframework`.

---

## 10 · What's next — pushing the boundaries

These are sequenced roughly by impact-per-effort.

### 10.1 *Reactive triggers* on every Claw
`claw.yml` already has a `triggers:` block (e.g. `consecutive_failures >= 3 → page operator`). Extend it to fire on **content** signals: a new file under `articles/`, a delta in `memory/cron-state.json`, a Farcaster mention. The scheduler already evaluates triggers after cron — we just need a richer condition language. Imagine `when: "file_created articles/claw-onchain-alpha-*.md AND wallet_spend_today > 50%cap"`.

### 10.2 *Claw chains* via the existing `chain-runner.yml`
The runner is there but underused. A *chain* is a YAML doc under `chains/<name>.yml`:

```yaml
- skill: github-trending
- skill: deep-research
  var: "${prev.top_repo}"
- skill: show-hn-draft
  var: "${prev.summary}"
```

Each step gets the previous step's outputs piped via `chain_context_file`. With the dashboard surfacing chain runs alongside skill runs, you compose multi-step missions visually.

### 10.3 *Wallet-funded recruiting*
Right now `claw_recruit` consumes your `ANTHROPIC_API_KEY`. Next step: route through Bankr Gateway with the agent wallet so the swarm pays for its own synthesis. The Console already understands `BANKR_API_KEY`. A "wallet mode" toggle on the recruit UI would let operators run truly self-funded fleets.

### 10.4 *Skill marketplace via npm*
Every Claw is a self-contained `SKILL.md`. We can publish curated bundles as `@clawtrl/pack-research`, `@clawtrl/pack-trader`, `@clawtrl/pack-creator`, each shipping 5–10 skills + their pre-fetch scripts. `npx @clawtrl/pack-trader install` writes them into `skills/` and patches `claw.yml`. Forks compose.

### 10.5 *MCP write-tools*
Today the MCP server can `recruit` but not `pause` or `wake`. Adding `claw_pause` / `claw_wake` / `claw_set_secret` makes the fleet fully steerable from any MCP client. Pair this with model-side memory (Claude's own context) and you get a feedback loop where the model improves its own swarm.

### 10.6 *Live observability — `dashboard/runs` page*
The dashboard already has analytics; what's missing is a streaming run viewer. The GitHub Actions Logs API supports streaming. A `runs/<id>` page that tails the runner's stdout in real time turns "what's happening?" from `gh run view` into a single dashboard click.

### 10.7 *Multi-fork conducting*
The `fork-fleet` and `fleet-control` skills hint at this. Next step: a single dashboard that connects to *N* forks (yours + your team's) and shows a unified feed. The MCP server already takes `CLAWTRL_REPO` per-instance; the dashboard just needs an account-switcher and shared OAuth.

### 10.8 *On-chain creditworthiness*
Once `wallet/tx-log.jsonl` accumulates, we can derive a *Claw credit score*: how often this swarm settles paid fetches without disputes, what its monthly burn looks like. Publish it as a Farcaster frame and forks become composable financial primitives.

### 10.9 *Self-evals*
`scripts/eval-audit` exists but is underused. Wire it into a nightly chain that grades every Claw's output against a rubric Claude generated from the SKILL.md itself, then writes the score back into `cron-state.json.last_quality_score`. The heartbeat already reads that field — this gives it teeth.

### 10.10 *Native Discord + Slack mirrors of Telegram*
The `notify` script already supports all three. The relay is Telegram-only because of the long-poll trick — Discord and Slack need webhooks (or socket-mode for Slack). A `discord-relay` Claw with the same command surface lets you operate from any chat surface your team uses.

### 10.11 *Audit log Claw*
A daily Claw that reads the previous 24h of git commits + `cron-state.json` changes and posts a one-paragraph "what the swarm did and what it cost" recap. Forces accountability into the fleet.

### 10.12 *PR-mode Auto-Spec*
Currently Recruit commits to `main`. Add an opt-in *PR mode* where new skills land as a draft PR with the brief in the body. Combined with the heartbeat watching for `gh pr list`, this gives you a review queue for ambitious Claws before they go live.

### 10.13 *Browser extension surface*
A tiny Chrome extension that turns any tab into a brief: "right-click → Recruit a Claw to watch this page weekly." It calls `POST /api/recruit` on your local dashboard. Suddenly your browsing history seeds the swarm.

### 10.14 *Onchain settlement of Claw outputs*
If `articles/<skill>-<date>.md` is the product, why not let other agents *pay* for it? The same x402 stack we built for fetching can serve outputs: each article gets a tiny x402 paywall, the swarm earns USDC, and the dashboard's "earnings" tab shows revenue alongside cost.

---

## 11 · How to get involved

- **Fork** the repo, run `./onboard`, and you have a working swarm in 60 seconds.
- **File issues** with the `ai-build` label and the `claw.yml` workflow will *try to fix them itself* — watch the PR get drafted.
- **Publish your skills** as `@clawtrl/pack-*` once §10.4 lands.
- **Contribute upstream** — the `sync-upstream.yml` workflow keeps your fork current with the original Aeon repo.

If a Claw gets stuck or pages you for a stupid reason, that's a bug in the SKILL.md. The fix is one commit.

---

*Last updated: this article is itself a candidate to become a Claw — `docs-keeper` could regenerate it nightly from the live state of the repo. Add it to your watchlist.*
