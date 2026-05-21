#!/usr/bin/env bash
set -euo pipefail

required_user="demokratia-info"
public_repo="demokratia-info/demokratia-info.github.io"
private_repo="demokratia-info/democracy-paper-suggestions-private"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI 'gh' is not available on PATH." >&2
  exit 1
fi

echo "Checking active GitHub authentication..."
gh auth status -h github.com --active >/dev/null

active_login="$(gh api user --jq '.login')"
if [[ "${active_login}" != "${required_user}" ]]; then
  echo "Active GitHub account is '${active_login}', but ${required_user} is required." >&2
  echo "This script does not run 'gh auth switch'. Fix the active account outside the automation." >&2
  exit 1
fi

for repo in "${public_repo}" "${private_repo}"; do
  permission="$(gh repo view "${repo}" --json viewerPermission --jq '.viewerPermission')"
  case "${permission}" in
    ADMIN|MAINTAIN|WRITE)
      ;;
    *)
      echo "Repository ${repo} permission is '${permission}', but WRITE or ADMIN is required." >&2
      exit 1
      ;;
  esac
done

echo "Current GitHub auth OK (${required_user}; required repo access present)."
