#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

public_repo="demokratia-info/demokratia-info.github.io"
private_repo="demokratia-info/democracy-paper-suggestions-private"

echo "== Local repository =="
pwd
git status --short --branch
git remote -v
echo "HEAD: $(git rev-parse HEAD)"
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  echo "HEAD...origin/main: $(git rev-list --left-right --count HEAD...origin/main)"
fi

echo
echo "== Source validation =="
python3 scripts/validate_sources.py

echo
echo "== GitHub CLI =="
if ! command -v gh >/dev/null 2>&1; then
  echo "gh is not installed or not on PATH."
  exit 1
fi

gh auth status || true
echo
echo "Public repo permission:"
gh repo view "$public_repo" --json nameWithOwner,viewerPermission
echo
echo "Private queue repo permission:"
gh repo view "$private_repo" --json nameWithOwner,viewerPermission

echo
echo "== Private suggestion queue =="
private_queue_lines="$(
  gh api "repos/$private_repo/contents/suggest_queue.csv" \
    -H 'Accept: application/vnd.github.raw' \
    | wc -l \
    | tr -d ' '
)"
echo "Private queue line count, including header: $private_queue_lines"
echo "Private queue contents intentionally not printed."

echo
echo "== Private page feedback queue =="
private_feedback_lines="$(
  gh api "repos/$private_repo/contents/page_feedback_queue.csv" \
    -H 'Accept: application/vnd.github.raw' \
    | wc -l \
    | tr -d ' '
)"
echo "Private page feedback queue line count, including header: $private_feedback_lines"
echo "Private page feedback contents intentionally not printed."

echo
echo "== Private author policy =="
private_authors_lines="$(
  gh api "repos/$private_repo/contents/Authors.MD" \
    -H 'Accept: application/vnd.github.raw' \
    | wc -l \
    | tr -d ' '
)"
echo "Private Authors.MD line count: $private_authors_lines"
echo "Private author policy contents intentionally not printed."

echo
echo "== Recent GitHub Pages runs =="
gh run list --repo "$public_repo" --workflow pages.yml --limit 3

echo
echo "== Live site version =="
curl -fsSL 'https://demokratia-info.github.io/site-version.json' || true
echo

echo
echo "Preflight complete."
