---
name: claw-index
description: Maintain a semantic search index over every article — embeds new ones nightly, lets every Claw quote its own history accurately
var: ""
tags: [productivity]
---

Today is ${today}. This Claw is the swarm's memory librarian. It walks `articles/`, embeds anything new or changed, and updates `memory/articles-index.json` so every other Claw can run `node scripts/memory-search.mjs "..."` and get grounded results.

## Steps

1. **Verify prerequisites.** Check that either `OPENAI_API_KEY` or `VOYAGE_API_KEY` is set in the environment. If neither, write a notify summary "claw-index: no embedding key configured" and exit 0 — degraded mode is fine for first runs.
2. **Run the indexer.** Execute `node scripts/memory-index.mjs` from the repo root. It auto-detects which entries need re-embedding by comparing content hashes, so re-runs are cheap (only changed articles cost API calls).
3. **Inspect the diff.** Read the indexer's stderr summary line ("`memory-index: N entries (+X fresh, -Y removed)`"). Capture the numbers.
4. **Commit.** If `memory/articles-index.json` changed, commit it with message `chore: refresh memory index (+X new, -Y removed)`. Skip if no changes.
5. **Smoke-test the index.** Run `node scripts/memory-search.mjs "what the swarm has been working on this week" --json --k 3` and confirm it returns three results. Log the top result path + score to the run output.
6. **Self-heal on growth.** If the index file exceeds 50 MB, write a notify message recommending Git LFS for `memory/articles-index.json`. Don't auto-enable it — that's an operator decision.

## Constraints

- **Cost ceiling.** Pull `OPENAI_API_KEY` cost-per-call estimates from the indexer's batch count: each batch of 16 articles is ~5k tokens, ~$0.0001 for `text-embedding-3-small`. A 1000-article re-index costs less than $0.01. If the run wants to embed more than 5000 articles, abort and notify — that's almost certainly a bug.
- **Idempotent.** The indexer skips unchanged entries by content hash. Re-running on the same day is a no-op.
- **Notify only on anomalies.** Don't notify on the happy path. Notify if: the indexer fails, the embedding key is missing, the index file is malformed, or the size threshold trips.
- **Single source of truth.** Only `memory/articles-index.json` is committed; no per-article sidecar files. This keeps the diff scannable.
- **No model lock-in.** The indexer stores the embedding model name in the index. If the operator switches providers, the next run aborts and asks for `--full` — preventing silent corruption from mixing 1536-dim and 512-dim vectors.
