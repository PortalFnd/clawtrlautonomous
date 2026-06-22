# Clawtrl Ops — agents that pay for themselves, controllable from anywhere

**Today we're launching Clawtrl Ops: an open-source way to run a fleet of autonomous AI agents that hold their own wallet, settle their own data fetches in USDC, and can be driven from any MCP-aware client. No servers, no SaaS subscription, no vendor lock-in. Recruit them in seconds, run any model behind them, watch them work in markdown commits.**

*[Aeon](https://github.com/aaronjmars/aeon) reimagined, powered by Clawtrl.*

This is the long-form explanation of what we built, why we built it the way we did, and how to start using it today. If you'd rather skip to the reference docs, see [`product-tour.md`](./product-tour.md). If you want to ship now, fork the repo, set one API key, and recruit your first Claw. Everything below is the why.

---

## Aeon reimagined, powered by Clawtrl

Aeon gave us a runtime that was already remarkable: single-file agents, scheduled by GitHub Actions, observable as commits, controlled from a local dashboard. We took that foundation and asked one question — *what would it take for these agents to operate without a human babysitter on the loop?* The answer turned out to be six concrete primitives. Together they're what makes this a launch rather than a fork bump.

**The two headline bets:**

- **Clawtrl Wallet** — a Base agent wallet provisioned per fork. Hard daily USDC cap, per-call ceiling enforced by the signing scripts, append-only ledger in `wallet/tx-log.jsonl`, EIP-3009 signing in `scripts/x402-pay.mjs`. The private key lives only as a GitHub secret. Two Claws — `claw-x402-paywatcher` and `claw-onchain-alpha` — ship in this release as proof the primitive works end-to-end. Agents stop being supervised tools and become economic actors.
- **`@clawtrl/mcp` server** — a stdio Model Context Protocol server published to npm. One `npx -y @clawtrl/mcp` in your Claude Desktop / Cursor / Continue / Zed config exposes the whole fleet (`claw_list`, `claw_run`, `claw_recruit`, `claw_feed`, `claw_read_article`, `claw_wallet`, `claw_status`) as tools. Your existing LLM conversations become the cockpit — the swarm stops being a place you visit.

**The four primitives that make the bets land:**

- **Inbound webhook triggers** — every Claw is reachable via `POST /trigger/<skill>`. Stripe events, on-chain listeners, GitHub webhooks, anything that speaks HTTP can fire a Claw with a payload. The workflow listens via GitHub's native `repository_dispatch`; an optional Cloudflare Worker at `workers/webhook-proxy.ts` adds HMAC-protected URLs. The swarm reacts to the world, not just the clock.
- **Vector memory over articles** — the `claw-index` skill nightly embeds every new article into `memory/articles-index.json` (OpenAI `text-embedding-3-small` by default, Voyage as fallback). Any Claw can call `node scripts/memory-search.mjs "..."` to ground its reasoning in the swarm's own history. The index is one committed JSON file: no vector DB, no native deps.
- **Economics tab** — a per-Claw cost-vs-output dashboard. Rolls up runs, success rate, average duration, model-aware estimated token spend, articles produced, and on-chain wallet settlement. Operators stop being blind about which Claws are paying for themselves.
- **Auto-Spec recruiting** — a one-sentence brief becomes a working SKILL.md and a registered (disabled) Claw in fifteen seconds, from the dashboard *or* from any MCP client via `claw_recruit`. The fleet grows by description.

**Plus the texture changes:** a Telegram bridge with cron and burst modes that turns the swarm into a phone-operable cockpit; genuine model-agnosticism so every Claw can pick its own provider (Claude, GPT, Gemini, OpenRouter, Bankr Gateway, local Ollama); a `sync-upstream.yml` workflow that keeps pulling improvements down from Aeon as they land.

None of these features compromises the original constraint that everything lives in your repo. The wallet is a GitHub secret plus a JSONL ledger. The MCP server is a CLI talking to your fork via `gh`. Webhook triggers ride GitHub's native dispatch endpoint. The vector index is a JSON file. The Economics tab reads files that already existed. The architectural promise holds; the capabilities just got considerably sharper.

---

## What Clawtrl Ops actually is

The honest answer is that Clawtrl Ops is a way to keep a small swarm of AI agents working on your behalf without paying for any infrastructure to host them. You write down the missions you want carried out, the swarm carries them out on a schedule, and the results show up in your repository as if a very diligent intern had been working all night.

That description sounds modest, but the implications are not. Most "agent platforms" today are SaaS products: you sign up, hand over your API keys, write your prompts into someone else's database, and pay a monthly subscription on top of the model costs you were already paying. The agents live on their infrastructure. If the company pivots, your agents pivot with them. If they get acquired, your agents get acquired with them.

Clawtrl flips that. Every agent — every *Claw* — is a markdown file in your own GitHub repository. The scheduler that wakes them up is GitHub Actions, which you already have. The interface for steering them is a Next.js app you run on your own laptop. There is no server to pay for, no account to lose access to, no proprietary runtime. If GitHub disappears tomorrow, you can `git clone` your fork to GitLab and the entire swarm keeps running.

That's the structural answer. The lived answer is that Clawtrl gives you the feeling of having a team. You wake up, your phone has a Telegram message from your *morning-brief* Claw summarizing what happened on the platforms you watch. Your *deep-research* Claw left a markdown file in `articles/` while you slept. Your *heartbeat* Claw noticed that one of the other Claws had failed three times in a row and paused it pending your review. You spend twenty minutes reading, write a one-line brief to recruit a new Claw for something you noticed, and go about your day.

The product is best understood as **a personal operations team that lives in a git repository** — and that can transact and be commanded like a first-class citizen of the rest of the agent ecosystem.

---

## Why the two big bets compound

The headline additions list above tells you *what* Clawtrl adds. This section tells you *why* the two big bets — Wallet and MCP — are the ones we lead with.

**Bet one: agents need wallets.** Every agent platform today treats money as something the operator handles outside the system. You top up an API balance, you pay for the SaaS, and the agent itself never touches a dollar. That model breaks the moment agents start consuming paid data — x402-gated APIs, micropayment-protected research, agent-to-agent commerce — because every transaction needs a human in the loop. Clawtrl Wallet is the primitive that lets agents transact without that human, bounded by hard caps the operator sets once.

**Bet two: agents need to be addressable from anywhere.** The control surface for most agent platforms is a proprietary web UI you have to context-switch into. That doesn't scale to a fleet you actually use. `@clawtrl/mcp` makes the swarm a tool the model you're already chatting with can call directly. Combined with the Telegram bridge for phone access and the local dashboard for deliberate work, the fleet is addressable from three surfaces, and all three speak to the same source of truth in your fork.

These two bets compound. Once agents can pay for data, they have something worth selling. Once they're addressable from any MCP client, that selling becomes one tool call away from any model. The roadmap below — output marketplace, on-chain identity, cross-fork federation — all assumes both primitives are in place. Without them, those features have nowhere to land.

---

## Why this shape

There were three design decisions that defined what Clawtrl became.

**The first was choosing GitHub Actions as the runtime.** It is unfashionable — Actions is famously clunky, the UI is dense, the YAML is verbose. But it is also free for public repos, generous on the free tier for private repos, available in every region, and trusted by every developer's CI pipeline already. Building on top of Actions meant we never had to write a job queue, a secrets vault, a cron scheduler, a permission system, or a deployment story. Those were already done. We just had to compose them.

**The second was making every agent a single file, model-agnostic.** A Claw is a `SKILL.md` file with YAML frontmatter and a markdown body. The body is the system prompt the agent harness reads when the workflow runs. There is no `agent.ts`, no `agent.config.json`, no separate behavior definition. And critically, the SKILL.md does not bind itself to one model — you set a default in `claw.yml`, override per-skill in the frontmatter, and the workflow routes through whichever provider you've given a key to: Anthropic, OpenAI, Google, OpenRouter, Bankr Gateway for crypto-native routing, or a local Ollama endpoint. The reason single-file agents matter is that it makes Claws *legible*: you can read a SKILL.md and know exactly what the Claw will try to do. It makes them *forkable*: you can copy a SKILL.md from someone else's repo into yours and have a new Claw working in seconds. It makes them *reviewable*: a PR that adds a Claw is a PR that adds a markdown file, which any human can audit in two minutes.

**The third was using git as the database.** Every Claw output, every memory update, every configuration change is a commit. This gives you free time-travel debugging ("what did the swarm look like last Tuesday?"), free audit logs ("who paused this Claw?"), free rollback ("revert that commit, the Claw was misbehaving"), and free replication ("clone the repo to a backup machine"). The trade-off is that the swarm cannot operate on millisecond timescales — every action incurs git's overhead. We embraced that. Clawtrl is for missions that matter, not for high-frequency anything.

These three choices stack. Because the runtime is GitHub Actions, the agents *have* to live in a repo. Because the agents live in a repo, they *can* be single files. Because they are single files, the obvious database is the repo they already live in. Each decision made the next one feel inevitable.

---

## How an operator actually uses it

The first time you set up Clawtrl, you fork the repository and run the onboarding script. The script checks that you have the GitHub CLI installed and authenticated, walks you through setting at least one model-provider key (Anthropic, OpenAI, OpenRouter, or any of the supported providers), validates that your fork has Actions enabled with write permissions, and confirms that the workflow can read and write `memory/MEMORY.md`. At the end you have a swarm that can run but has nothing turned on yet. The default fork ships with ~125 skills, all of them disabled, so you can browse before you commit.

You then open the dashboard. It runs locally — `npm run dev` in the `dashboard/` directory — and talks to your fork via the GitHub CLI. The dashboard has four pages worth knowing about. The home page is a feed of recent outputs: every `articles/<skill>-<date>.md` file appears here, newest first. The Secrets Console lets you set GitHub secrets through a typed form rather than the GitHub web UI; secrets you add show up as environment variables in the workflow. The Skills page lists every Claw in your `claw.yml` with toggles to enable, disable, or run-on-demand. The Recruit Claw modal is how you add new ones.

Daily use settles into a rhythm. The Claws you've enabled run themselves; you don't think about them. Their outputs accumulate in the feed. You read them in the morning the same way you'd read email. When you notice a recurring need — "I keep wanting to know what's happening with this protocol" or "I keep forgetting to check this dashboard" — you open the Recruit Claw modal, type that need as a one-line brief, and a Claw to handle it gets synthesized and committed within fifteen seconds.

The Telegram bridge changes the texture of this. With it set up, you can `/run morning-brief` from your phone while you're making coffee, get the output as a reply, pause a misbehaving Claw with `/pause skill-x` while you're on the subway, or check `/wallet` to see what your agent wallet has been spending. The bridge is intentionally a small command surface — it is not a chat interface to an LLM, it is a remote control for the swarm.

The MCP server changes the texture another way. With Clawtrl wired into Claude Desktop or Cursor, your *primary* model — the one you're already talking to about code or research — can call into the swarm directly. You ask Claude "is there a Claw watching the ETH gas market?" and it can answer by running `claw_list`, then offer to `claw_recruit` one if none exists. This is the version of Clawtrl that feels most futuristic, because the boundary between you-talking-to-an-LLM and the-LLM-talking-to-your-swarm disappears. The swarm becomes an extension of whatever model you happen to be working with.

---

## The mental model of a Claw

A Claw is not an agent in the loop-until-done sense that the term usually implies. A Claw is closer to a *cron job that thinks*. It wakes up, reads its instructions, does the thing, writes its output, and goes back to sleep. It does not run continuously. It does not maintain state inside itself between runs. Everything it knows from previous runs lives in the repository — in `memory/`, in `articles/`, in `cron-state.json` — and the next invocation reads those files like any other input.

This is a deliberate constraint. Continuous agents are powerful and also notoriously hard to operate. They drift, they loop, they consume resources, they need careful supervision. Cron-style agents are constrained, predictable, and cheap. You can run two hundred of them for the price of one always-on agent. And because each run is bounded — typically 30 seconds to 5 minutes — the failure modes are bounded too. The worst thing a misbehaving Claw can do is waste one workflow run.

Within a single run, the Claw has the full power of an agentic harness: it can fetch web pages, search the web, run shell commands, and read and write the full repository filesystem. It can call `gh` to dispatch other workflows, query issues and PRs, and inspect runs. It can call `./notify` to push messages out to Telegram, Discord, Slack, or email. The default harness is Claude Code because it ships with the cleanest tool integration, but the underlying *model* is whatever you've configured — Claude, GPT, Gemini, an OpenRouter route, a local model, or a Bankr Gateway route paid for in USDC. This is a lot of capability in a short window, which is why the SKILL.md format puts so much weight on the **Constraints** section: the operator's job is to tell the Claw what *not* to do.

The frontmatter of a SKILL.md is metadata for the scheduler and the dashboard. The body is the system prompt. Inside the body, `${today}`, `${yesterday}`, and `${var}` are template variables the workflow substitutes before handing the prompt to Claude. A skill that takes a `var` is a skill the operator can parameterize at dispatch time — `/run summary -- "the last 24h"` would pass `"the last 24h"` as `${var}`.

Skills that produce ongoing outputs — briefs, digests, research — write a file per run into `articles/`, named `<skill>-<date>.md`. Skills that mutate state — recruit, pause, schedule-ads — make commits to the relevant config file. Skills that just need to remember something across runs write to `memory/MEMORY.md` or a dedicated file under `memory/`. The convention is informal but consistent: anything the operator cares about lives somewhere they can `cat`.

---

## Memory, articles, and the wallet

Three directories matter beyond `skills/` and `claw.yml`. Each represents a different kind of state.

`memory/` is the swarm's working memory. The central file is `memory/MEMORY.md` — a single markdown file where the operator and the Claws share notes. Operators write things they want the swarm to remember ("I'm launching X in two weeks", "ignore activity from Y"); Claws read it for context and append observations they want future runs to have access to. Alongside it sits `cron-state.json`, an automatically maintained JSON file with one entry per Claw recording last run, last success, last failure, consecutive failure count, and a rolling quality score. The *heartbeat* Claw is the primary consumer of this file — it reads it three times a day and pages the operator if any Claw has gone sideways.

`articles/` is the mission feed. This is what the operator reads. Every Claw that produces a digest writes here, and the dashboard's home page renders the most recent entries. Articles are markdown files with YAML frontmatter so they can be syndicated to Dev.to or Farcaster automatically by the post-process scripts. This directory grows monotonically — there is no cleanup logic. Old articles serve as ground truth for what the swarm thought on any given day, which makes them useful when training the *self-improve* Claw on what the operator actually found valuable.

`wallet/` is new in this release and represents the swarm's economic agency. `wallet/snapshot.json` holds the address, network, and current balances (display only). `wallet/tx-log.jsonl` is the append-only ledger of every spend, regardless of source. `wallet/x402-receipts.jsonl` is a more detailed log of x402-gated fetches, with the URL, the amount paid in USDC, and the on-chain transaction hash. The private key is never in the repository — it lives only as a GitHub secret named `CLAWTRL_WALLET_PRIVATE_KEY`. The daily spend cap and per-call ceiling are enforced by the scripts that touch the key, not by trust in the Claws using them.

This trifecta — memory, articles, wallet — is how the swarm accumulates value over time. Memory gives it continuity, articles give it visible output, wallet gives it economic teeth.

---

## A day in the life

Let's walk through a realistic operator day.

At 07:00 UTC, your *morning-brief* Claw wakes up. The workflow checks out your fork, reads `memory/MEMORY.md` for context, runs the agent session with the morning-brief SKILL.md as the system prompt, and the model — whichever one you've chosen — produces a 400-word summary of the last 24 hours of activity across your watch list. The summary lands as `articles/morning-brief-2026-05-21.md` and gets pushed back to main. The notify hook fires and your phone buzzes with a Telegram message containing the TL;DR. You read it over coffee.

At 08:30 UTC, *heartbeat* runs. It reads `memory/cron-state.json`, notices that *github-trending* failed twice in a row yesterday with the same error signature ("API rate limit exceeded"), and pages you with a one-line summary. You see it on your phone, send `/pause github-trending` back to the bridge, the bridge commits the change to `claw.yml`, and *github-trending* won't run again until you wake it. Two minutes of work; the swarm goes back to normal.

At 09:30 UTC, *claw-onchain-alpha* runs (in our story, you've enabled it). It reads the cache that *claw-x402-paywatcher* warmed at 06:00, combines it with free RPC reads, and writes `articles/claw-onchain-alpha-2026-05-21.md`. Today's digest flags a 7% drop in a pool you've been watching, which crosses the threshold defined in the Constraints section, so it pushes a notification. You see it, decide it's not actionable, ignore it.

Around 11:00 UTC, you're working on something else and remember you wanted a Claw to watch a competitor's blog. You open the dashboard, click Recruit Claw, type "Every Monday 9am UTC, check https://example.com/blog for new posts since last week and send me a one-line summary of each. Skip if nothing new." Auto-Spec returns a preview showing `name: example-blog-watch`, `schedule: "0 9 * * 1"`, `tags: [research]`, and a draft summary. You click Recruit. The Claw lands as a commit, registered disabled. You flip it to enabled in the Skills page. Done — you've added one to your team.

In the afternoon you're chatting with Claude Desktop about an architectural decision and ask "what did my deep-research Claw say about WebSockets last month?" Claude calls `claw_feed`, finds the relevant article, calls `claw_read_article` to fetch the body, and quotes the relevant paragraph back to you. You realize you forgot the conclusion, thank Claude, move on. At no point did you context-switch into the dashboard.

That's the day. The swarm did roughly twenty things; you did three.

---

## Common questions

**Is this just a fancy cron job?** Cron jobs run scripts. Clawtrl runs *agents*, which means each invocation has the full reasoning capability of whichever frontier model you've configured behind it — including web browsing, code execution, multi-step planning, and the ability to call other workflows. A cron job that runs a Python script gives you exactly the output that script computes. A Clawtrl Claw gives you the output of a thinking process constrained by a SKILL.md.

**Why not just use ChatGPT plugins / Claude Projects / Cursor agents?** Those are useful for ad-hoc tasks but they require *you* to start them. Clawtrl Claws run on their own schedule. The difference is between *I have a tool I can use* and *I have a team that works while I sleep*. Both have their place; Clawtrl is for the second.

**How much does it cost?** The biggest line item is Anthropic tokens — typically a few cents per Claw invocation, scaling with how much the Claw reasons. A 30-Claw fleet running mixed schedules costs about $5–$20/month in tokens for a typical operator. GitHub Actions is free for public repos and has a generous free tier for private repos. The optional wallet adds whatever you put in it; the daily cap and per-call ceiling mean you cannot accidentally drain it.

**What happens if a Claw goes haywire?** It fails the workflow run. The next *heartbeat* invocation notices and pages you. You revert the commit (if it made one) or pause the Claw (if it just looped). The blast radius of a misbehaving Claw is one workflow run plus any commits it made before the workflow timed out. There is no shared runtime, no shared memory, no shared anything — each Claw is isolated by Actions' job boundaries.

**Which models can I run?** Any of them. The workflow respects a `model:` override in the SKILL.md frontmatter or in `claw.yml`, and the dashboard's Secrets Console accepts keys for Anthropic, OpenAI, Google AI Studio, OpenRouter, Bankr Gateway, and any OpenAI-compatible local endpoint (Ollama, LM Studio). Different Claws on the same fork can run on different models — your *deep-research* Claw on Claude Sonnet, your *quick-summary* Claw on a cheap GPT-mini, your *crypto-pulse* Claw on a Bankr-routed model paid for in USDC. The Auto-Spec recruiter has Claude as a soft default because it produces the cleanest JSON envelopes, but that's swappable too. The product is genuinely model-agnostic — that was a design goal, not an afterthought.

**What if I want to keep my Claws private?** Make your fork private. GitHub Actions still works on private repos with a generous free minute allocation. The dashboard runs locally and talks to your private fork the same way it would talk to a public one. The MCP server uses your personal access token, which only has access to repos you grant it.

**How do I share Claws with other people?** Each Claw is a single markdown file. Send someone the file, they drop it into their `skills/` directory, add a line to their `claw.yml`, and they have your Claw. There's an upcoming `@clawtrl/pack-*` npm story (see the roadmap) that will make this even smoother, but the underlying mechanism is just "copy a file."

---

## Where this is going

The shape of the product is stable: a swarm of single-file agents, scheduled by GitHub Actions, driven by markdown specifications, observable in your repository, steerable from your dashboard, your phone, or any MCP client. The next year of work is about deepening each surface, not changing the model.

We want recruiting to feel even more natural — a brief should become a working Claw in seconds, with the operator reviewing rather than authoring. We want chains of Claws to be composable visually, so a research → synthesis → distribution pipeline can be assembled by drag-and-drop rather than by writing chain YAML. We want the wallet to be more than a defensive primitive — eventually Claws should be able to *earn*, not just spend, by serving their outputs through the same x402 stack we use to consume data. And we want the entire stack to feel less like a developer tool and more like a personal operations team you happen to manage from a terminal.

What makes us optimistic is that none of those goals require new infrastructure. They require composing what's already in the repository differently. The constraint we picked at the start — *no infrastructure beyond your GitHub repo* — turns out to be expansive rather than limiting. Most of what an operator wants to do can be expressed as another markdown file.

If you're reading this and considering using Clawtrl, the right first step is small. Pick one recurring task you wish a junior teammate would handle, recruit a Claw to do it, and watch it run for a week. If it's useful, recruit another. If it's not, the cost of the experiment is the time you spent writing one sentence. The swarm grows from there.

---

## Standing on Aeon's shoulders

Clawtrl Ops is built on the [Aeon](https://github.com/aaronjmars/aeon) agent framework by Aaron Mars. Aeon contributed the runtime architecture this product depends on: the GitHub Actions workflow engine, the `SKILL.md` format, the cron-state-driven *heartbeat* pattern, the notify hooks, the chain runner, and the dashboard scaffolding. Without that foundation we'd have spent six months reinventing primitives that already work.

What Clawtrl adds is enumerated near the top of this article — the wallet, the MCP server, inbound triggers, vector memory, the Economics tab, Auto-Spec, the Telegram bridge, model-agnosticism. Together they turn the runtime into a wallet-native, MCP-bridged operations platform. The `sync-upstream.yml` workflow keeps the runtime in step with Aeon improvements as they land, so the foundation continues to benefit from upstream work.

If you're building agent infrastructure of your own, start with Aeon — it's the cleanest small-agent runtime we know of. If you want agents that hold their own wallet and can be commanded from any MCP-aware client, that's Clawtrl.

---

## Get started

1. **Fork** [`portalfnd/clawtrlautonomous`](https://github.com/portalfnd/clawtrlautonomous) — public, MIT-licensed.
2. **Run** `./onboard` from the repo root. It checks your `gh` auth, walks you through one API key (Anthropic, OpenAI, OpenRouter, or any of the supported providers), and verifies your Actions permissions.
3. **Open the dashboard** with `cd dashboard && npm install && npm run dev`. It's a local Next.js app — nothing leaves your machine.
4. **Recruit your first Claw** from the *Recruit Claw → From a brief* tab. One sentence in, one working agent out, ~15 seconds end to end.
5. *(Optional)* **Wire up Telegram** by setting `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`, then waking the `telegram-relay` skill. Your phone becomes the cockpit.
6. *(Optional)* **Wire up MCP** by adding `npx -y @clawtrl/mcp` to your Claude Desktop / Cursor / Continue config. The swarm becomes a tool the model you chat with can call directly.
7. *(Optional, advanced)* **Provision the agent wallet** with a Base address, a daily USDC cap, and an `X402_TARGETS` list. The swarm starts paying for its own data.

That's the whole onboarding. There is no waitlist, no signup form, no usage tier. Your fleet is yours, on your fork, on your terms.

## Stay in the loop

- **Repo:** [github.com/portalfnd/clawtrlautonomous](https://github.com/portalfnd/clawtrlautonomous)
- **MCP package:** [`@clawtrl/mcp` on npm](https://www.npmjs.com/package/@clawtrl/mcp)
- **Upstream runtime:** [github.com/aaronjmars/aeon](https://github.com/aaronjmars/aeon) — the agent framework Clawtrl is built on; updates flow downstream via `sync-upstream.yml`.
- **Reference docs:** [`product-tour.md`](./product-tour.md) for the architecture, file inventory, and feature-by-feature walkthrough.
- **Roadmap:** §10 of `product-tour.md` — reactive triggers, Claw chains, on-chain settlement of outputs, multi-fork conducting, and more.

If you ship a Claw worth sharing, send a PR adding it to the skills directory or publish a `@clawtrl/pack-*` of your own. The fleet grows by addition.

Go recruit something.
