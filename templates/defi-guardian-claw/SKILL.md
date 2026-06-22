# DeFi Guardian Claw

## Purpose

Create a read-only autonomous Claw that monitors wallet health, DeFi exposure, token movement, and risk signals.

## Inputs

- Wallet address or watchlist
- Chain focus, defaulting to Base/EVM
- Optional token watchlist
- Optional alert thresholds

## Behavior

1. Inspect configured wallet and protocol context using available data sources.
2. Summarize balances, exposures, notable token movement, and risk signals.
3. Highlight liquidation, approval, threshold, or portfolio drift concerns.
4. Write a concise operator report.
5. Notify only when action or attention is needed.

## Safety

This template is read-only by default. Do not propose transaction execution unless paired with a future `claw-safe-execute` skill and explicit user configuration.

## Output

Write results to `.outputs/defi-guardian-claw.md` and relevant state to `memory/clawtrl/defi-guardian.json`.
