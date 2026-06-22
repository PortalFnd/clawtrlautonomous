---
name: telegram-relay
description: Two-way Telegram bridge — poll for operator commands and execute them
var: ""
tags: [ops]
---

Today is ${today}. Poll Telegram for new operator commands since the last run, dispatch them against this Clawtrl Ops repo, and reply.

This skill is a thin wrapper around `scripts/telegram-relay.sh` so the same logic powers both the cron mode (this skill) and the burst-mode workflow (`telegram-burst.yml`). Don't duplicate command-handling here — fix it in the script.

## Required secrets

- `TELEGRAM_BOT_TOKEN` — from @BotFather
- `TELEGRAM_CHAT_ID` — your chat id; **only** messages from this chat are honored

If either is unset, exit silently with status 0. The relay is opt-in.

## Steps

1. Verify both env vars are set. If not, log `telegram-relay: not configured` and exit 0.
2. Run one poll cycle:

   ```bash
   bash scripts/telegram-relay.sh
   ```

   The script reads `memory/telegram-relay/state.json` for the offset, calls `getUpdates` (short poll, `timeout=0`), dispatches each authorized command, replies, and persists the new offset.

3. The outer workflow's commit step will pick up `memory/telegram-relay/state.json` and any `claw.yml` mutations the script made (`/pause`, `/wake`).

## Constraints

- Stay silent on quiet polls (`0 new messages` is fine in logs, no Telegram traffic).
- Never echo `TELEGRAM_BOT_TOKEN` or `CLAWTRL_WALLET_PRIVATE_KEY` in replies.
- ACL: the script drops any message whose `chat.id` doesn't equal `TELEGRAM_CHAT_ID`.
- For high-frequency operators, enable burst mode by triggering `.github/workflows/telegram-burst.yml` manually or with the `/wake telegram-burst` command pattern.
