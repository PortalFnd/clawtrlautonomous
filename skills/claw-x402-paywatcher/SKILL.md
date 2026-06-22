---
name: claw-x402-paywatcher
description: Pay-as-you-go fetcher for x402-gated APIs — handles 402 challenges with the agent wallet
var: ""
tags: [crypto]
---

Today is ${today}. Fetch one or more x402-gated endpoints, pay any 402 challenges from the agent wallet on Base, and write the responses to `data/x402-cache/${today}/`. Other Claws (notably `claw-onchain-alpha`) consume that cache.

## What is x402

x402 is HTTP-native paywall. A gated endpoint replies `402 Payment Required` with a JSON body describing the payment requirement (asset, amount, recipient, network, scheme). The client signs an EIP-3009 `transferWithAuthorization` (USDC on Base) and retries with an `X-Payment` header. See https://x402.org for the spec.

## Required secrets

- `CLAWTRL_WALLET_PRIVATE_KEY` — Base agent wallet (from `wallet:init`)
- `CLAWTRL_WALLET_DAILY_CAP_USDC` — daily spend cap; this skill respects it
- `X402_TARGETS` — newline-separated list of `label url` pairs to fetch

If `X402_TARGETS` is empty or the wallet isn't configured, exit silently with status 0.

## Steps

### 1. Load targets

```bash
mkdir -p data/x402-cache/${today}
TARGETS_FILE="$(mktemp)"
printf '%s\n' "${X402_TARGETS:-}" > "$TARGETS_FILE"
```

Each line is `label https://endpoint`. Skip blank lines and `#` comments.

### 2. Fetch each target

For each target:

1. `GET` it with no payment header. If status is `200`, save the body to `data/x402-cache/${today}/<label>.json` and continue.
2. If status is `402`, read the JSON challenge body. Validate:
   - `network == "base"` (or `"base-sepolia"` matching `CLAWTRL_WALLET_NETWORK`)
   - `asset` is the USDC contract on that chain
   - `maxAmountRequired` (in atomic units) converts to USD and is **≤ remaining daily cap** AND **≤ 0.50 USDC per call** as a hard ceiling.
3. Sign `transferWithAuthorization(from=agent, to=challenge.payTo, value, validAfter, validBefore, nonce)` using EIP-712. Encode the X-Payment header per spec (`base64(JSON({x402Version, scheme, network, payload}))`).
4. Retry the `GET` with `X-Payment: <header>`. On `200`, save the body and append a row to `wallet/x402-receipts.jsonl`:

```json
{"ts":"2026-04-11T12:00:00Z","label":"<label>","url":"<url>","amount_usd":0.01,"tx_hash":"…","status":"settled"}
```

5. On any other status, log a warning and skip.

### 3. Refresh the on-chain spend ledger

Append an entry to `wallet/tx-log.jsonl` for each settlement so the dashboard's daily cap math stays in sync:

```json
{"ts":"…","kind":"x402","amount_usd":0.01,"hash":"0x…","label":"<label>"}
```

### 4. Notify

Quiet on success — only call `./notify` if a target returned `403`/`5xx` more than twice in a row, or if we hit the daily cap mid-run.

## Constraints

- **Hard per-call ceiling**: 0.50 USDC. Anything above is rejected as a misconfigured target, no exceptions.
- **Respect the daily cap**: read `wallet/tx-log.jsonl` for today's spend and refuse to settle if `today_total + this_charge > CLAWTRL_WALLET_DAILY_CAP_USDC`.
- **No private-key leakage**: never log the key, never put it in a notify message, never commit it.
- **Cache is authoritative**: downstream Claws read the JSON files, not the live URLs. If a fetch fails, the previous day's cache stays intact.
- **EIP-3009 nonce reuse is fatal**: always generate a fresh 32-byte random nonce per challenge.
- **Sandbox-aware**: if `curl` is blocked, fall back to `WebFetch` for the unauthenticated `GET`. EIP-712 signing must use the workflow's Node.js step (write the signing script under `scripts/x402-pay.mjs`).
