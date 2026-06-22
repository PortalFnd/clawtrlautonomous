# clawtrl-autonomous Plan

`clawtrl-autonomous` is the PortalFND autonomous Claw layer: a forkable, zero-infrastructure system for scheduled research, repo operations, market monitoring, and safe on-chain workflows.

## Product Direction

- **Clawtrl-first identity:** All user-facing docs, dashboard surfaces, templates, and examples should feel native to Clawtrl.
- **Zero-infra autonomy:** Keep the single-repo + GitHub Actions model.
- **Safety-first execution:** On-chain execution must start read-only, then dry-run, then capped execution with audit logs.
- **Forkable by default:** Users should be able to fork, configure `claw.yml`, add secrets, and run.
- **Upstream-compatible where useful:** Avoid breaking inherited Aeon workflow internals until replacements are ready.

## First Native Templates

1. **DeFi Guardian Claw** — read-only wallet, token, and protocol monitoring.
2. **Daily Narrative Claw** — market narrative tracking and content-ready intelligence.
3. **Repo Guardian Claw** — PR, issue, release, and security monitoring.

## First Native Skills

1. `claw-wallet-guardian`
2. `claw-safe-execute`
3. `daily-claw-brief`
4. `claw-repo-guardian`
5. `claw-defi-rebalancer`

## Safety Defaults

```yaml
safety:
  execution_enabled: false
  dry_run_first: true
  emergency_pause: false
  max_tx_value_usd: 50
  require_approval_above_usd: 100
  allowed_chains:
    - base
  allowed_contracts: []
  allowed_tokens: []
```

## Dashboard Direction

- Rename team language to Claw/fleet language.
- Add autonomy domain cards.
- Highlight read-only vs execution-capable skills.
- Add safety status panel before enabling on-chain skills.
- Add a PortalFND/Clawtrl onboarding path.
- Pull Base wallet telemetry into the command deck (balances, caps, autopay, recent tx)

## Clawtrl Wallet Integration

- Mirror `PortalFND/hermes-openclaw-skills/clawtrl-wallet` as the canonical wallet runtime.
- Surface live data via `telemetry/clawtrl-wallet.json` (tracked by wallet skill) and `/api/wallet`.
- Render wallet health in the dashboard, including spending caps, autopay state, and recent payments.
- Document env flags (`CLAWTRL_WALLET_*`) so forks can inject read-only or execution-ready wallets.
- Pair with `claw-wallet-guardian` and `claw-safe-execute` skills for monitoring vs action.
