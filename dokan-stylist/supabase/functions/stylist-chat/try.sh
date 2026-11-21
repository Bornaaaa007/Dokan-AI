#!/usr/bin/env bash
# Quick manual test against your deployed function.
# Usage: SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... ./try.sh "wedding outfit for a young woman, 5000 taka"
set -euo pipefail
: "${SUPABASE_URL:?set SUPABASE_URL}"; : "${SUPABASE_PUBLISHABLE_KEY:?set SUPABASE_PUBLISHABLE_KEY}"
curl -sS -X POST "$SUPABASE_URL/functions/v1/stylist-chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_PUBLISHABLE_KEY" -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  -d "$(python3 -c 'import json,sys; print(json.dumps({"message": sys.argv[1]}))' "$1")" | python3 -m json.tool
