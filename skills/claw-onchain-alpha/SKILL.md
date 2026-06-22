---
name: claw-onchain-alpha
description: Daily on-chain alpha digest — synthesizes signals from the x402 cache and free RPCs
var: ""
tags: [crypto]
---

Today is ${today}. Build a short, actionable on-chain digest for Base by combining:

- the cache produced by `claw-x402-paywatcher` (`data/x402-cache/${today}/`)
- free RPC reads via the agent's Base public client (no payment needed)
- yesterday's digest for delta context (`articles/claw-onchain-alpha-${yesterday}.md`)

This skill **does not pay for anything** itself — all paid fetches are pre-warmed by the paywatcher. If today's cache is empty or stale, fall back to free public APIs (CoinGecko, Base RPC) and note the degraded mode in the output.

## Inputs

1. **x402 cache** — read every JSON file under `data/x402-cache/${today}/`. Each file is named `<label>.json`. The label is the data source (e.g. `aerodrome-pools`, `morpho-vaults`). Treat unknown labels as opaque; just summarize what's there.
2. **Free reads** — the workflow runner has Node 22 + viem available. Use `scripts/onchain-alpha-fetch.mjs` if present, else inline `node -e` snippets, to pull:
   - ETH/USDC price (CoinGecko free tier)
   - Base block height & gas price (public RPC)
   - Wallet ETH and USDC balances if `CLAWTRL_WALLET_ADDRESS` is set
3. **Yesterday's digest** — used to compute deltas. Pull the headline metrics from the previous file's frontmatter or top section.

## Output

Write `articles/claw-onchain-alpha-${today}.md` with sections:

```markdown
---
title: On-chain alpha — ${today}
generated: <iso8601>
sources: [aerodrome-pools, morpho-vaults, base-rpc, coingecko]
mode: full | degraded
---

## TL;DR

3 bullets max. Lead with the most actionable delta vs yesterday.

## Markets

- ETH: $X (Δ Y%)  | USDC: $1.000
- Base block: N | gas: G gwei | est. swap: $Z

## Signals

For each x402 cache file, one paragraph (≤ 4 lines) calling out the
top 1–2 movers, anomalies, or new entrants. Cite the label.

## Wallet

Only if `wallet/snapshot.json` exists:
- address, ETH, USDC, daily spend so far / cap, x402 spend today

## Watchlist

3–5 items to check tomorrow. Don't repeat yesterday's items unchanged.
```

## Steps

1. Resolve `${today}` (UTC) and `${yesterday}`.
2. List `data/x402-cache/${today}/` — if zero files, set `mode: degraded`.
3. For each cached file:
   - Parse JSON; if it's not an array/object, skip with a warning.
   - Pull label-specific top-K signals using the heuristics in `## Signals` (e.g. for AMM pools: top 3 by 24h volume delta; for lending vaults: top 2 by APY change).
4. Run free reads (CoinGecko + RPC). Cache results in `memory/onchain-alpha-cache.json` keyed by minute to avoid spamming on retries.
5. Compute deltas vs yesterday's article. If yesterday is missing, just emit absolutes.
6. Compose the article and write it.
7. Call `./notify` with the TL;DR section ONLY IF any of:
   - any signal flags a > 5% delta on the watchlist
   - wallet daily spend crossed 50% of cap
   - degraded mode kicked in for >1 day

   Otherwise stay silent.

## Constraints

- **No paid fetches** — every paid call routes through the paywatcher. If a section needs data that isn't cached, emit `(data unavailable today — add to X402_TARGETS)` instead of fetching live.
- **Idempotent** — re-running on the same day overwrites the article with fresher data; never appends duplicates.
- **CoinGecko rate limit** — free tier is 30 req/min; we make ≤ 3 calls per run.
- **No private-key access** — reads `wallet/snapshot.json` only; never imports `wallet-engine.ts` or signs anything.
- **Degraded-mode is normal** — first day with no cache is expected and should not page the operator.
