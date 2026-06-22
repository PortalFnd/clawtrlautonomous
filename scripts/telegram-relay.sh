#!/usr/bin/env bash
# telegram-relay — single poll cycle.
#
# Polls Telegram getUpdates, dispatches each authorized command to the fleet,
# and replies. Idempotent state in memory/telegram-relay/state.json.
#
# Required env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
# Optional env: TELEGRAM_POLL_TIMEOUT (default 0; burst mode uses 30)
# Required tools: curl, jq, gh, git, python3

set -euo pipefail

: "${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN not set}"
: "${TELEGRAM_CHAT_ID:?TELEGRAM_CHAT_ID not set}"
TIMEOUT="${TELEGRAM_POLL_TIMEOUT:-0}"

API="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}"
STATE_DIR="memory/telegram-relay"
STATE_FILE="${STATE_DIR}/state.json"

mkdir -p "$STATE_DIR"
[ -f "$STATE_FILE" ] || echo '{"last_update_id": 0}' > "$STATE_FILE"
OFFSET=$(jq -r '.last_update_id // 0' "$STATE_FILE")
NEXT=$((OFFSET + 1))

RESP=$(curl -sf -G "${API}/getUpdates" \
  --data-urlencode "offset=$NEXT" \
  --data-urlencode "timeout=$TIMEOUT" \
  --data-urlencode 'allowed_updates=["message"]' \
  --max-time $((TIMEOUT + 10)) || true)

if [ -z "$RESP" ] || [ "$(echo "$RESP" | jq -r '.ok // false')" != "true" ]; then
  echo "telegram-relay: no response or not-ok"
  exit 0
fi

COUNT=$(echo "$RESP" | jq '.result | length')
if [ "$COUNT" -eq 0 ]; then
  echo "telegram-relay: 0 new messages"
  exit 0
fi

# --- Reply helper ---
send_reply() {
  local chat="$1" mid="$2" text="$3"
  [ -z "$text" ] && return 0
  curl -sf -X POST "${API}/sendMessage" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --arg c "$chat" --arg t "${text:0:4000}" --argjson m "${mid:-null}" \
      '{chat_id: $c, text: $t, reply_to_message_id: $m, parse_mode: "Markdown"}')" \
    > /dev/null || echo "telegram-relay: sendMessage failed"
}

# --- Command handlers ---
cmd_status() {
  local rows
  rows=$(gh run list --workflow=claw.yml --limit 5 \
    --json name,status,conclusion,createdAt 2>/dev/null \
    | jq -r '.[] | "• \(.name) — \(.conclusion // .status) (\(.createdAt | split("T")[0]))"')
  echo "*Last 5 runs*"; echo "${rows:-(none)}"
}

cmd_run() {
  local skill="$1" var="${2:-}"
  if [ -z "$skill" ]; then echo "Usage: /run <skill> [-- var]"; return; fi
  if [ ! -d "skills/$skill" ]; then echo "Unknown skill: \`$skill\`"; return; fi
  local args=("workflow" "run" "claw.yml" "-f" "skill=$skill")
  [ -n "$var" ] && args+=("-f" "var=$var")
  if gh "${args[@]}" >/dev/null 2>&1; then echo "Dispatched \`$skill\`"
  else echo "Dispatch failed for \`$skill\`"; fi
}

toggle_skill() {
  local name="$1" val="$2"
  python3 - "$name" "$val" <<'PY' || return 1
import sys, re, pathlib
name, val = sys.argv[1], sys.argv[2]
p = pathlib.Path('claw.yml')
src = p.read_text()
pat = re.compile(r'^(\s*' + re.escape(name) + r':\s*\{[^}]*?enabled:\s*)(true|false)', re.M)
new, n = pat.subn(lambda m: m.group(1) + val, src, count=1)
sys.exit(0 if n and (p.write_text(new) or True) else 1)
PY
}

cmd_pause() {
  local skill="$1"
  [ -z "$skill" ] && { echo "Usage: /pause <skill>"; return; }
  if toggle_skill "$skill" "false"; then
    git add claw.yml && git commit -m "ops(telegram): pause $skill" >/dev/null 2>&1 && git push >/dev/null 2>&1 || true
    echo "Paused \`$skill\`"
  else echo "Skill not found in claw.yml: \`$skill\`"; fi
}

cmd_wake() {
  local skill="$1"
  [ -z "$skill" ] && { echo "Usage: /wake <skill>"; return; }
  if toggle_skill "$skill" "true"; then
    git add claw.yml && git commit -m "ops(telegram): wake $skill" >/dev/null 2>&1 && git push >/dev/null 2>&1 || true
    echo "Woke \`$skill\`"
  else echo "Skill not found in claw.yml: \`$skill\`"; fi
}

cmd_wallet() {
  if [ -f wallet/snapshot.json ]; then
    jq -r '"*Wallet*\naddress: `\(.address // "—")`\nnetwork: \(.network // "—")\nETH: \(.ethBalance // "—")\nUSDC: \(.usdcBalance // "—")"' wallet/snapshot.json
  else echo "No wallet snapshot yet."; fi
}

cmd_feed() {
  local n="${1:-5}"; case "$n" in ''|*[!0-9]*) n=5 ;; esac
  local files
  files=$(ls -t articles/ 2>/dev/null | head -"$n")
  if [ -z "$files" ]; then echo "No articles yet."; return; fi
  echo "*Latest articles*"; echo "$files" | sed 's|^|• |'
}

cmd_help() {
  cat <<'EOF'
*Clawtrl Ops — Telegram*
/status — last 5 runs
/run <skill> [-- var] — dispatch a skill
/pause <skill> — disable in claw.yml
/wake <skill> — enable in claw.yml
/wallet — wallet snapshot
/feed [n] — latest articles
/recruit <brief> — see dashboard
/help — this list
EOF
}

handle() {
  local text="${1:-}"
  local cmd rest
  cmd=$(echo "$text" | awk '{print tolower($1)}')
  rest=$(echo "$text" | cut -s -d' ' -f2-)
  case "$cmd" in
    /status)  cmd_status ;;
    /run)     local skill="${rest%%[[:space:]]*}"; local var="${rest#"$skill"}"; var="${var# }"; var="${var#-- }"; cmd_run "$skill" "$var" ;;
    /pause)   cmd_pause "${rest%% *}" ;;
    /wake)    cmd_wake "${rest%% *}" ;;
    /wallet)  cmd_wallet ;;
    /feed)    cmd_feed "${rest%% *}" ;;
    /recruit) echo "Auto-Spec needs the dashboard. Open Recruit Claw → From a brief." ;;
    /help|/start) cmd_help ;;
    *)        echo "Unknown command. /help for the list." ;;
  esac
}

# --- Main loop over results ---
NEW_OFFSET=$OFFSET
while read -r MSG; do
  UID=$(echo "$MSG" | jq -r '.update_id')
  CHAT=$(echo "$MSG" | jq -r '.message.chat.id // empty')
  MID=$(echo "$MSG" | jq -r '.message.message_id // empty')
  TEXT=$(echo "$MSG" | jq -r '.message.text // empty')
  NEW_OFFSET=$UID

  if [ "$CHAT" != "$TELEGRAM_CHAT_ID" ]; then
    echo "telegram-relay: skip foreign chat $CHAT"
    continue
  fi
  if [ -z "$TEXT" ]; then continue; fi

  REPLY=$(handle "$TEXT" 2>&1 || true)
  send_reply "$CHAT" "$MID" "$REPLY"
done < <(echo "$RESP" | jq -c '.result[]')

# Persist new offset.
if [ "$NEW_OFFSET" != "$OFFSET" ]; then
  jq --argjson v "$NEW_OFFSET" '.last_update_id = $v' "$STATE_FILE" > "${STATE_FILE}.tmp" \
    && mv "${STATE_FILE}.tmp" "$STATE_FILE"
fi

echo "telegram-relay: processed $COUNT messages, offset=$NEW_OFFSET"
