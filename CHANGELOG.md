# Changelog

All notable changes to Clawtrl Autonomous are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [1.0.0] — 2026-06-22

### Initial Release

Clawtrl Autonomous is a zero-infrastructure autonomous agent framework that runs on GitHub Actions. Fork it, configure skills, push, and your Claw runs scheduled research, repo maintenance, market monitoring, content workflows, and wallet operations autonomously.

**Core framework:**
- 121+ pre-built skills across research, dev, crypto, social, and productivity
- `claw.yml` configuration with per-skill cron schedules, model overrides, and variables
- GitHub Actions workflow supporting cron, manual dispatch, `repository_dispatch` webhooks, issue labels, and skill chaining
- Repo-backed memory, outputs, and self-healing state — everything version-controlled
- Notifications via Telegram, Discord, Slack, email, and dashboard feed cards
- Auto-Spec engine for AI-powered skill synthesis from natural language descriptions

**Dashboard (Next.js):**
- Fleet overview with skill status, recent runs, and health scoring
- Treasury Vault with live ETH/USDC balances, daily spend caps, and transaction history
- Wallet setup UI — generate new wallet or import existing private key via in-browser modal
- Skill management with toggle, run, delete, and auto-spec creation
- Economics panel with token usage tracking and cost analysis
- Error boundaries, styled confirm dialogs, and toast notifications

**Wallet engine:**
- ETH/USDC transfers, token approvals, and generic contract reads/writes on Base
- `clawtrl-wallet` v1.2.4 npm package integration (ERC-8128 signing proxy on port 8128)
- Daily spend caps with automatic tx-log tracking (includes x402 payments)
- Address allowlist — destructive actions only allowed to whitelisted recipients
- Transaction preview with gas cost estimation
- Wallet write auth — confirmation PIN required for destructive operations
- x402 autonomous payment support

**MCP server (`@clawtrl/mcp`):**
- `claw_list` — list all skills in the fleet
- `claw_status` — check skill health and configuration
- `claw_run` — dispatch a skill (rate-limited to 5/min)
- `claw_pause` — disable a skill
- `claw_enable` — enable a skill
- `claw_memory` — read and append to fleet memory
- Works with Claude Desktop, Cursor, Continue, Zed, and any MCP-compatible client

**Security:**
- Loopback-only API access (configurable via `CLAWTRL_DASHBOARD_ALLOWED_HOSTS`)
- CSRF protection and security headers (`X-Content-Type-Options`, `X-Frame-Options`, etc.)
- `poweredByHeader` disabled
- Wallet private keys stored in `.env.local` (gitignored, chmod 600)
- `SECURITY.md` with responsible disclosure policy
- `CONTRIBUTING.md` for open-source contributors

**Upstream sync:**
- Opt-in sync from `aaronjmars/aeon` via manual GitHub Actions trigger
- Configurable upstream repo and branch at dispatch time
- PR-based review with conflict detection
