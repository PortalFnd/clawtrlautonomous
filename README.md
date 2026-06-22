# clawtrl-autonomous

**Autonomous Claws that never sleep.**

Configure once, push to GitHub, and let your Claw run scheduled research, repo maintenance, market monitoring, content workflows, and future on-chain automations without servers or babysitting.

`clawtrl-autonomous` is a PortalFND-owned autonomous agent system built from the original Aeon framework and rebranded around Clawtrl-native operations.

---

## What Is This?

`clawtrl-autonomous` is a zero-infrastructure autonomous agent framework for recurring background work.

It runs from one GitHub repo using GitHub Actions. Configuration, skills, memory, outputs, logs, and self-healing state all live inside the repo, so every action is auditable and version-controlled.

The goal is simple:

> Fork it, configure it, push it, and let your Claw handle the work.

---

## What Can You Use It For?

### Autonomous DeFi and Wallet Monitoring

Use a Claw to watch wallets, protocols, token exposure, and market conditions on a schedule.

Examples:

- **Wallet health:** Track balances, exposure, stablecoin buffers, and unusual movement.
- **DeFi monitoring:** Watch Base/EVM protocols, liquidity, yield, and risk signals.
- **Risk alerts:** Detect liquidation risk, threshold breaks, suspicious approvals, or portfolio drift.
- **Daily reports:** Generate a daily Claw brief with portfolio, market, and protocol context.
- **Audit trails:** Store proposed actions and monitoring results in repo memory.

Initial execution defaults should stay read-only or dry-run until users explicitly enable higher-risk actions.

### Daily Research and Intelligence

Run recurring research loops without prompting an agent every morning.

Examples:

- **Market narratives:** Track AI agents, Base, x402, DeFi, and protocol trends.
- **Token watchlists:** Monitor tokens, unlocks, price moves, and ecosystem momentum.
- **Competitor research:** Watch launches, repos, announcements, and ecosystem movement.
- **Operator briefs:** Produce morning, evening, weekly, or campaign-specific reports.

### Repo Guardian Automation

Use Claw as a background maintainer for GitHub projects.

Examples:

- **PR reviews:** Review pull requests on a schedule or dispatch.
- **Issue triage:** Summarize, label, and prioritize issues.
- **Repo pulse:** Track pushes, releases, stale work, and health signals.
- **Security checks:** Run dependency, vulnerability, and workflow security scans.
- **Changelogs:** Draft release notes and weekly ship logs.

### Social and Community Automation

Turn research and repo activity into content drafts.

Examples:

- **X drafts:** Convert briefs into posts or threads.
- **Telegram/Discord updates:** Summarize important changes for community channels.
- **Launch content:** Prepare Product Hunt, Show HN, and announcement copy.
- **Weekly recaps:** Create community updates from repo and market activity.

### Autonomous Fleets

Run specialized Claws for different jobs.

Examples:

- **Wallet Guardian Claw**
- **Research Claw**
- **Repo Guardian Claw**
- **Social Claw**
- **DeFi Strategy Claw**
- **Protocol Monitor Claw**

Each Claw can have its own schedule, enabled skills, memory, outputs, and notification channel.

---

## Why This Exists

Most AI agent tools are interactive. They wait for you to approve tool calls, review changes, and keep pushing the workflow forward.

`clawtrl-autonomous` is for recurring work that should run while you are away:

- **Daily briefs**
- **Repo monitoring**
- **Issue triage**
- **Portfolio checks**
- **Market alerts**
- **Scheduled content**
- **Self-maintenance**

It is not meant to replace interactive coding agents. It is the autonomous background layer that keeps watching, writing, checking, and reporting when you are not there.

---

## How It Works

1. Configure skills in `claw.yml`.
2. Launch the local dashboard with `./claw`.
3. Add secrets through GitHub Secrets.
4. Enable skills and schedules.
5. Push the config.
6. GitHub Actions runs skills on cron, dispatch, chain, or reactive triggers.
7. Outputs and memory are committed back to the repo.
8. Health checks and repair skills detect failures and improve broken workflows.

No VPS. No Docker. No Kubernetes. No external backend required.

---

## Quick Start

### Prerequisites

- **Node.js 20+**
- **GitHub CLI (`gh`) authenticated locally**
- **A GitHub repo under PortalFND or your chosen organization**
- **Claude OAuth token or Anthropic API key**

### Local Setup

```bash
git clone https://github.com/portalfnd/clawtrlautonomous.git
cd clawtrlautonomous
./claw
```

Open:

```text
http://localhost:5555
```

Then:

1. **Authenticate:** Add Claude OAuth or an Anthropic API key.
2. **Add notifications:** Configure Telegram, Discord, Slack, email, or dashboard cards.
3. **Pick skills:** Toggle on what the Claw should run.
4. **Set schedules:** Configure cron, dispatch, chains, or reactive triggers.
5. **Push:** Commit and push to GitHub.
6. **Verify:** Run `./onboard` to check secrets, workflows, memory, and notifications.

### Wallet Setup

The dashboard includes a built-in wallet setup UI. Navigate to **Treasury Vault** and click **Link Wallet**:

- **Generate New** — creates a fresh BIP-39 mnemonic, derives a private key at `m/44'/60'/0'/0/0`, and saves to `.env.local`
- **Import Key** — import an existing `0x`-prefixed private key

Alternatively, use the CLI:

```bash
npm --prefix dashboard install
npm --prefix dashboard run wallet:init
```

Credentials are stored in `dashboard/.env.local` (gitignored, chmod 600). Never commit this file.

### Wallet Security

Set a confirmation PIN to require approval for destructive wallet actions (transfers, approvals):

```bash
# In dashboard/.env.local
CLAWTRL_WALLET_CONFIRM_PIN=your-secret-pin
CLAWTRL_WALLET_DAILY_CAP_USDC=50
```

When the PIN is set, the dashboard will prompt for it before executing any transfer or approval. The address allowlist adds an additional layer — only whitelisted recipients can receive funds.

Manage the allowlist via the dashboard API:

```bash
curl -X POST http://localhost:3000/api/wallet/allowlist \
  -H "Content-Type: application/json" \
  -d '{"address":"0x...","label":"Team treasury"}'
```

### GitHub Secrets for Autonomous Execution

For skills to run autonomously on GitHub Actions, set these repo secrets:

| Secret | Purpose |
|--------|---------|
| `ANTHROPIC_API_KEY` | Powers Claude Code (required) |
| `CLAWTRL_WALLET_PRIVATE_KEY` | Wallet operations in CI |
| `CLAWTRL_WALLET_ADDRESS` | Wallet address for CI |
| `CLAWTRL_WALLET_CONFIRM_PIN` | PIN for CI wallet actions |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | Telegram notifications |
| `DISCORD_WEBHOOK_URL` | Discord notifications |
| `SLACK_WEBHOOK_URL` | Slack notifications |

---

## Configuration

The branded config file is:

```text
claw.yml
```

Example `claw.yml`:

```yaml
model: claude-sonnet-4-6

skills:
  morning-brief:
    enabled: true
    schedule: "0 8 * * *"
    var: "PortalFND, Clawtrl, Base, DeFi, autonomous agents"

  narrative-tracker:
    enabled: true
    schedule: "30 13 * * *"
    var: "AI agents, Base, x402, DeFi automation"

  on-chain-monitor:
    enabled: false
    schedule: "0 12 * * *"
    var: "base wallet health and protocol activity"

  pr-review:
    enabled: false
    schedule: "0 9 * * *"

  heartbeat:
    enabled: true
    schedule: "0 8,14,20 * * *"
```

---

## Skill Categories

`clawtrl-autonomous` ships with the inherited skill catalog and will add Clawtrl-native skills over time.

### Research and Content

- deep research
- daily digests
- paper digests
- RSS monitoring
- technical explainers
- narrative tracking

### Dev and Repo Operations

- PR reviews
- issue triage
- changelogs
- repo pulse
- vulnerability scans
- workflow security audits
- release monitoring

### Crypto and Markets

- token alerts
- market context refreshes
- DeFi monitoring
- on-chain monitoring
- token reports
- unlock monitoring
- prediction market monitoring

### Productivity

- morning briefs
- evening recaps
- weekly reviews
- idea capture
- goal tracking
- action conversion

### Meta and Self-Healing

- heartbeat
- skill health
- skill repair
- self-improve
- cost reports
- skill analytics
- fleet state

---

## Clawtrl-Native Features

### Wallet Engine

Built-in Base L2 wallet with safety guardrails:

- **ETH/USDC transfers** with confirmation PIN gating
- **Token approvals** with allowlist enforcement
- **Daily spend caps** — automatic tracking via tx-log (includes x402 payments)
- **Address allowlist** — only whitelisted recipients can receive funds
- **Transaction preview** — gas cost estimation before execution
- **`clawtrl-wallet` v1.2.4** — ERC-8128 signing proxy on port 8128, x402 autonomous payments
- **Wallet setup UI** — generate or import wallet from the dashboard

### MCP Server

The `@clawtrl/mcp` package exposes the fleet as tools to any MCP client (Claude Desktop, Cursor, Continue, Zed):

| Tool | Description |
|------|-------------|
| `claw_list` | List all skills in the fleet |
| `claw_status` | Check skill health and configuration |
| `claw_run` | Dispatch a skill (rate-limited to 5/min) |
| `claw_pause` | Disable a skill |
| `claw_enable` | Enable a skill |
| `claw_memory` | Read and append to fleet memory |

### Dashboard

Next.js dashboard at `http://localhost:5555` with:

- **Fleet Bay** — skill overview, health scores, recent runs
- **Treasury Vault** — wallet balances, spend caps, transaction history
- **Skill Studio** — toggle, run, delete, and auto-spec skill creation
- **Economics** — token usage tracking and cost analysis
- **Error boundaries** and styled confirm dialogs throughout

---

## Safety Model

`clawtrl-autonomous` is safe by default, especially around on-chain workflows.

Built-in guardrails:

- **Wallet write auth** — confirmation PIN required for all destructive operations
- **Address allowlist** — only whitelisted recipients can receive funds
- **Daily spend caps** — automatic enforcement via tx-log tracking
- **Loopback-only API** — dashboard API only accessible from localhost by default
- **CSRF protection** and security headers on all routes
- **Private keys in `.env.local`** — gitignored, chmod 600, never committed
- **GitHub Secrets** for CI — wallet keys stored as repo secrets, not in code

Safety principles:

- **Never commit private keys**
- **Use GitHub Secrets only**
- **Start with read-only skills**
- **Enable execution only when explicitly configured**
- **Use small test amounts first**
- **Write audit logs for every proposed or executed transaction**

---

## Project Structure

```text
.github/workflows/       GitHub Actions runners and schedulers
CLAUDE.md                agent operating instructions
claw.yml                 Clawtrl configuration (skills, schedules, models)
skills/                  autonomous skill definitions
skills.json              machine-readable skill catalog
templates/               starter skill templates
memory/                  persistent repo-backed memory
.outputs/                generated skill outputs
dashboard/               local Next.js dashboard
packages/mcp/            MCP server for Claude Desktop, Cursor, etc.
./claw                   launch the local Clawtrl dashboard
./onboard                setup validator
./add-skill              import skills from GitHub repos
./new-from-template      create skills from local templates
./export-skill           export a skill as a standalone markdown file
./generate-skills-json   regenerate the skills.json catalog
```

---

## Notifications

`clawtrl-autonomous` can notify through supported channels such as:

- Telegram
- Discord
- Slack
- email
- dashboard feed cards

The intended behavior is simple: stay quiet when everything is fine, alert when action or attention is needed.

---

## Roadmap

- **DeFi rebalancer skills** — portfolio rebalance plans with dry-run-first execution
- **Contract allowlists** — per-skill allowed contract and token whitelists
- **Simulation hooks** — pre-execution transaction simulation
- **Emergency pause** — fleet-wide kill switch via GitHub dispatch
- **Skill marketplace** — user-contributed Claw skills and template gallery
- **Multi-fleet support** — multiple specialized Claws from one repo

---

## Status

Production-ready. The Clawtrl identity is established, the dashboard is live, and the wallet engine is operational.

**What's included:**

- Next.js dashboard with fleet overview, wallet management, skill management, and economics
- Wallet engine (ETH/USDC transfers, daily spend caps, gas estimation, address allowlist, x402 payments)
- `clawtrl-wallet` v1.2.4 npm package integration (ERC-8128 signing proxy)
- MCP server with `claw_list`, `claw_status`, `claw_run`, `claw_pause`, `claw_enable`, `claw_memory` tools + rate limiting
- Security gate (loopback-only API, CSRF protection, security headers, wallet write auth)
- Auto-Spec engine for AI-powered skill synthesis
- 121+ pre-built skills across research, dev, crypto, social, and productivity
- Opt-in upstream sync from `aaronjmars/aeon` (manual trigger via GitHub Actions)

---

## License

MIT — see [LICENSE](LICENSE).

`clawtrl-autonomous` is built on the Aeon framework by Aaron Mars, rebranded and extended by PortalFND.
