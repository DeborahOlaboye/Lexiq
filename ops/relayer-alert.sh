#!/usr/bin/env bash
#
# Tells you on Telegram when the relayer needs topping up.
#
# The relayer pays for guest and signed-in rounds. Running it dry does not break the site, but
# it does quietly stop free rounds — first for guests, then for everyone — so the useful moment
# to hear about it is well before that, while there is still runway to act.
#
# Install on the server:
#   1. Message @BotFather on Telegram, /newbot, copy the token.
#   2. Message your new bot once, then open
#        https://api.telegram.org/bot<TOKEN>/getUpdates
#      and copy "chat":{"id":<THIS NUMBER>}.
#   3. sudo install -m 700 relayer-alert.sh /opt/lexiq/ops/relayer-alert.sh
#   4. sudo tee /etc/lexiq-alert.env >/dev/null <<'EOF'
#        TELEGRAM_TOKEN=123456:ABC...
#        TELEGRAM_CHAT_ID=987654321
#      EOF
#      sudo chmod 600 /etc/lexiq-alert.env
#   5. crontab -e, then:
#        */15 * * * * /opt/lexiq/ops/relayer-alert.sh >>/var/log/lexiq-alert.log 2>&1
#
# Test it end to end without waiting for a real drop:
#   WARN_OVERRIDE=999 /opt/lexiq/ops/relayer-alert.sh
set -uo pipefail

HEALTH_URL="${HEALTH_URL:-https://playlexiq.xyz/api/health}"
STATE_FILE="${STATE_FILE:-/var/lib/lexiq/relayer-alert.state}"
# While low, repeat at most this often, so a cron every 15 minutes does not become 96 messages.
REPEAT_HOURS="${REPEAT_HOURS:-12}"

[ -f /etc/lexiq-alert.env ] && . /etc/lexiq-alert.env
: "${TELEGRAM_TOKEN:?set TELEGRAM_TOKEN in /etc/lexiq-alert.env}"
: "${TELEGRAM_CHAT_ID:?set TELEGRAM_CHAT_ID in /etc/lexiq-alert.env}"

mkdir -p "$(dirname "$STATE_FILE")"

notify() {
  curl -sS --max-time 20 -o /dev/null \
    -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=$1" \
    --data-urlencode "parse_mode=HTML"
}

# A health endpoint that is low on funds still answers 200; one that is down answers nothing.
# Both matter, so treat an unreachable endpoint as its own alert rather than as "fine".
body="$(curl -sS --max-time 25 "$HEALTH_URL")" || body=""
if [ -z "$body" ]; then
  last_down="$(sed -n 's/^down //p' "$STATE_FILE" 2>/dev/null || true)"
  now=$(date +%s)
  if [ -z "$last_down" ] || [ $((now - last_down)) -ge $((REPEAT_HOURS * 3600)) ]; then
    notify "⚠️ <b>Lexiq health check failed</b>%0ANo response from ${HEALTH_URL}"
    printf 'down %s\n' "$now" > "$STATE_FILE"
  fi
  exit 1
fi

# jq if present, otherwise fall back to grep so this works on a bare box.
if command -v jq >/dev/null 2>&1; then
  celo=$(printf '%s' "$body"    | jq -r '.relay.celo // empty')
  warn=$(printf '%s' "$body"    | jq -r '.relay.warnCelo // empty')
  left=$(printf '%s' "$body"    | jq -r '.relay.roundsLeft // empty')
  state=$(printf '%s' "$body"   | jq -r '.relay.state // "unknown"')
  today=$(printf '%s' "$body"   | jq -r '.relay.roundsToday // 0')
else
  celo=$(printf  '%s' "$body" | grep -o '"celo":[0-9.]*'        | head -1 | cut -d: -f2)
  warn=$(printf  '%s' "$body" | grep -o '"warnCelo":[0-9.]*'    | head -1 | cut -d: -f2)
  left=$(printf  '%s' "$body" | grep -o '"roundsLeft":[0-9]*'   | head -1 | cut -d: -f2)
  state=$(printf '%s' "$body" | grep -o '"state":"[a-z-]*"'     | head -1 | cut -d'"' -f4)
  today=$(printf '%s' "$body" | grep -o '"roundsToday":[0-9]*'  | head -1 | cut -d: -f2)
fi

[ -n "${WARN_OVERRIDE:-}" ] && warn="$WARN_OVERRIDE"

if [ -z "$celo" ] || [ -z "$warn" ]; then
  echo "$(date +%Y-%m-%dT%H:%M:%S%z) could not read relay.celo/warnCelo from health" >&2
  exit 1
fi

low=$(awk -v c="$celo" -v w="$warn" 'BEGIN { print (c < w) ? 1 : 0 }')
prev_state="$(sed -n 's/^level //p' "$STATE_FILE" 2>/dev/null || true)"
prev_at="$(sed -n 's/^at //p' "$STATE_FILE" 2>/dev/null || true)"
now=$(date +%s)

if [ "$low" = "1" ]; then
  # Alert on the way down, then only every REPEAT_HOURS so it stays worth reading.
  due=1
  if [ "$prev_state" = "low" ] && [ -n "$prev_at" ] && [ $((now - prev_at)) -lt $((REPEAT_HOURS * 3600)) ]; then
    due=0
  fi
  if [ "$due" = "1" ]; then
    notify "🪫 <b>Lexiq relayer is low</b>%0A%0ABalance: <b>${celo} CELO</b> (warn at ${warn})%0A~${left} relayed rounds left%0ARelayed today: ${today}%0AStatus: <b>${state}</b>%0A%0ATop up: <code>0x9CB49e92D3E6EDfC4F8DCA3e5a20C5b142FC4237</code>"
    printf 'level low\nat %s\n' "$now" > "$STATE_FILE"
  fi
  echo "$(date +%Y-%m-%dT%H:%M:%S%z) low ${celo} CELO (warn ${warn}) alerted=${due}"
else
  # Say so once when it comes back, so a top-up gets an acknowledgement rather than silence.
  if [ "$prev_state" = "low" ] || grep -q '^down ' "$STATE_FILE" 2>/dev/null; then
    notify "✅ <b>Lexiq relayer topped up</b>%0ABalance: <b>${celo} CELO</b> (~${left} rounds)"
  fi
  printf 'level ok\nat %s\n' "$now" > "$STATE_FILE"
  echo "$(date +%Y-%m-%dT%H:%M:%S%z) ok ${celo} CELO (warn ${warn})"
fi
