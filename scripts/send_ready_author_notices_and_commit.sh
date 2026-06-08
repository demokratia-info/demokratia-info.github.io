#!/usr/bin/env bash
set -euo pipefail

umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_REPO="${PUBLIC_REPO:-$(cd "$SCRIPT_DIR/.." && pwd)}"
PRIVATE_REPO="${PRIVATE_REPO:-$(cd "$PUBLIC_REPO/../democracy-paper-suggestions-private" && pwd)}"
LOCK_FILE="${AUTHOR_NOTICE_LOCK_FILE:-$HOME/.codex/automations/demokratia-private-repo.lock}"
MAX_AUTHORS="${AUTHOR_NOTICE_MAX_AUTHORS:-10}"

mkdir -p "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another Demokratia private-repo automation is active; skipping author notices this run."
  exit 0
fi

cd "$PUBLIC_REPO"

if [[ ! -d "$PRIVATE_REPO/.git" ]]; then
  echo "ERROR: private repo not found at $PRIVATE_REPO"
  exit 10
fi

if ! git -C "$PRIVATE_REPO" diff --quiet || ! git -C "$PRIVATE_REPO" diff --cached --quiet; then
  echo "Private repo has local changes; skipping author notices to avoid mixing work."
  git -C "$PRIVATE_REPO" status --short
  exit 0
fi

git -C "$PRIVATE_REPO" pull --ff-only origin main

ready_rows="$(python3 - "$PRIVATE_REPO/author_notice_queue.csv" <<'PY'
import csv
import sys

with open(sys.argv[1], newline="", encoding="utf-8") as handle:
    rows = list(csv.DictReader(handle))

print(sum(1 for row in rows if (row.get("status") or "").strip() == "ready_to_send"))
PY
)"

if (( ready_rows == 0 )); then
  echo "No ready_to_send author notice rows found."
  exit 0
fi

before="$(git -C "$PRIVATE_REPO" rev-parse --short HEAD)"
echo "Sending ready author notices: ready_rows=$ready_rows max_authors=$MAX_AUTHORS"

AUTHOR_NOTICE_MAX_AUTHORS="$MAX_AUTHORS" \
  python3 scripts/send_author_notices.py \
    --send \
    --quiet \
    --private-dir "$PRIVATE_REPO"

if git -C "$PRIVATE_REPO" diff --quiet -- Authors.csv author_notice_queue.csv author_notice_history.csv; then
  echo "Author notice mailer made no private repo changes."
  exit 0
fi

git -C "$PRIVATE_REPO" add Authors.csv author_notice_queue.csv author_notice_history.csv

if git -C "$PRIVATE_REPO" diff --cached --quiet; then
  echo "Author notice private files are unchanged after staging."
  exit 0
fi

git -C "$PRIVATE_REPO" commit -m "Send approved author notices"
git -C "$PRIVATE_REPO" push origin main
after="$(git -C "$PRIVATE_REPO" rev-parse --short HEAD)"
echo "Author notice private bookkeeping pushed: $before..$after"
