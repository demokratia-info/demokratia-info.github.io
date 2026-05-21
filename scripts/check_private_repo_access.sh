#!/usr/bin/env bash
set -euo pipefail

repo="demokratia-info/democracy-paper-suggestions-private"
required_files=("Authors.MD" "suggest_queue.csv")
attempts="${PRIVATE_REPO_CHECK_ATTEMPTS:-5}"
sleep_seconds="${PRIVATE_REPO_CHECK_SLEEP_SECONDS:-20}"

run_check() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "GitHub CLI 'gh' is not available on PATH." >&2
    return 1
  fi

  # Use the organization account when it is configured. This is intentionally
  # non-fatal so the following checks can print the real auth/permission error.
  gh auth switch -h github.com -u demokratia-info >/dev/null 2>&1 || true
  gh auth setup-git -h github.com >/dev/null 2>&1 || true

  echo "Checking GitHub authentication..."
  gh auth status -h github.com >/dev/null

  echo "Checking private repo permission for ${repo}..."
  permission="$(
    gh repo view "${repo}" \
      --json viewerPermission \
      --jq '.viewerPermission'
  )"

  case "${permission}" in
    ADMIN|MAINTAIN|WRITE)
      ;;
    *)
      echo "Private repo permission is '${permission}', but WRITE or ADMIN is required." >&2
      return 1
      ;;
  esac

  for file in "${required_files[@]}"; do
    echo "Checking private file metadata: ${file}"
    gh api "repos/${repo}/contents/${file}" --jq '{name:.name,size:.size,sha:.sha}' >/dev/null
  done

  echo "Checking authenticated git access to private repo..."
  git ls-remote "https://github.com/${repo}.git" refs/heads/main >/dev/null

  echo "Private repo access OK (${repo}, permission: ${permission})."
}

for attempt in $(seq 1 "${attempts}"); do
  if run_check; then
    exit 0
  fi

  if [[ "${attempt}" -lt "${attempts}" ]]; then
    echo "Private repo access check failed on attempt ${attempt}/${attempts}; retrying in ${sleep_seconds}s..." >&2
    sleep "${sleep_seconds}"
  fi
done

echo "Private repo access check failed after ${attempts} attempts." >&2
exit 1
