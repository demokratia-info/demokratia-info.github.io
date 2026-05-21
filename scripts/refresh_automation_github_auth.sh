#!/usr/bin/env bash
set -euo pipefail

host="github.com"
required_user="demokratia-info"
public_repo="demokratia-info/demokratia-info.github.io"
private_repo="demokratia-info/democracy-paper-suggestions-private"
auth_dir="${DEMOCRATIA_GH_CONFIG_DIR:-${HOME}/.codex/gh-demokratia-auth}"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI 'gh' is not available on PATH." >&2
  exit 1
fi

validate_dedicated_config() {
  local login public_permission private_permission

  GH_CONFIG_DIR="${auth_dir}" env -u GH_TOKEN -u GITHUB_TOKEN \
    gh auth status -h "${host}" --active >/dev/null 2>&1 || return 1

  login="$(
    GH_CONFIG_DIR="${auth_dir}" env -u GH_TOKEN -u GITHUB_TOKEN \
      gh api user --jq '.login'
  )"
  [[ "${login}" == "${required_user}" ]] || return 1

  public_permission="$(
    GH_CONFIG_DIR="${auth_dir}" env -u GH_TOKEN -u GITHUB_TOKEN \
      gh repo view "${public_repo}" --json viewerPermission --jq '.viewerPermission'
  )"
  private_permission="$(
    GH_CONFIG_DIR="${auth_dir}" env -u GH_TOKEN -u GITHUB_TOKEN \
      gh repo view "${private_repo}" --json viewerPermission --jq '.viewerPermission'
  )"

  case "${public_permission}:${private_permission}" in
    *:ADMIN|*:MAINTAIN|*:WRITE)
      case "${public_permission}" in
        ADMIN|MAINTAIN|WRITE) return 0 ;;
      esac
      ;;
  esac

  return 1
}

validate_token_value() {
  local token="$1"
  local login public_permission private_permission
  login="$(
    env -u GH_CONFIG_DIR -u GITHUB_TOKEN GH_TOKEN="${token}" \
      gh api user --jq '.login'
  )" || return 1

  [[ "${login}" == "${required_user}" ]] || return 1

  public_permission="$(
    env -u GH_CONFIG_DIR -u GITHUB_TOKEN GH_TOKEN="${token}" \
      gh repo view "${public_repo}" --json viewerPermission --jq '.viewerPermission'
  )" || return 1
  private_permission="$(
    env -u GH_CONFIG_DIR -u GITHUB_TOKEN GH_TOKEN="${token}" \
      gh repo view "${private_repo}" --json viewerPermission --jq '.viewerPermission'
  )" || return 1

  case "${public_permission}" in
    ADMIN|MAINTAIN|WRITE) ;;
    *) return 1 ;;
  esac

  case "${private_permission}" in
    ADMIN|MAINTAIN|WRITE) ;;
    *) return 1 ;;
  esac
}

write_dedicated_config_with_token() {
  local token="$1"
  local tmp_hosts tmp_config

  install -d -m 700 "${auth_dir}"
  tmp_hosts="${auth_dir}/hosts.yml.tmp"
  tmp_config="${auth_dir}/config.yml.tmp"

  umask 077
  {
    printf '%s:\n' "${host}"
    printf '    oauth_token: %s\n' "${token}"
    printf '    git_protocol: https\n'
    printf '    user: %s\n' "${required_user}"
  } > "${tmp_hosts}"

  {
    printf 'git_protocol: https\n'
    printf 'prompt: enabled\n'
    printf 'prefer_editor_prompt: disabled\n'
    printf 'editor:\n'
    printf 'pager:\n'
    printf 'browser:\n'
  } > "${tmp_config}"

  mv "${tmp_hosts}" "${auth_dir}/hosts.yml"
  mv "${tmp_config}" "${auth_dir}/config.yml"
  chmod 600 "${auth_dir}/hosts.yml" "${auth_dir}/config.yml"
}

write_dedicated_config_from_env_token() {
  local var token

  for var in GH_TOKEN GITHUB_TOKEN; do
    token="${!var:-}"
    [[ -n "${token}" ]] || continue

    if validate_token_value "${token}"; then
      write_dedicated_config_with_token "${token}"
      echo "Dedicated GitHub auth refreshed from ${var} (${auth_dir})."
      return 0
    fi

    echo "${var} is set but does not authenticate as ${required_user} with required repo access." >&2
  done

  return 1
}

write_dedicated_config_from_current_auth() {
  local login token

  # Ignore any possibly invalid automation-injected token while reading the
  # user's normal gh/keyring auth.
  gh auth switch -h "${host}" -u "${required_user}" >/dev/null 2>&1 || true

  env -u GH_CONFIG_DIR -u GH_TOKEN -u GITHUB_TOKEN \
    gh auth status -h "${host}" --active >/dev/null

  login="$(
    env -u GH_CONFIG_DIR -u GH_TOKEN -u GITHUB_TOKEN \
      gh api user --jq '.login'
  )"
  if [[ "${login}" != "${required_user}" ]]; then
    echo "Active keyring GitHub account is '${login}', but ${required_user} is required." >&2
    return 1
  fi

  token="$(
    env -u GH_CONFIG_DIR -u GH_TOKEN -u GITHUB_TOKEN \
      gh auth token
  )"
  if [[ -z "${token}" ]]; then
    echo "Could not read a non-empty GitHub token for ${required_user}." >&2
    return 1
  fi

  if ! validate_token_value "${token}"; then
    echo "Current keyring token does not have required public/private repo access." >&2
    return 1
  fi

  write_dedicated_config_with_token "${token}"
}

if validate_dedicated_config; then
  echo "Dedicated GitHub auth OK (${auth_dir})."
  exit 0
fi

echo "Dedicated GitHub auth is missing or invalid; attempting refresh from current ${required_user} gh auth..." >&2
write_dedicated_config_from_env_token || write_dedicated_config_from_current_auth

if validate_dedicated_config; then
  echo "Dedicated GitHub auth refreshed (${auth_dir})."
  exit 0
fi

echo "Dedicated GitHub auth refresh failed: ${auth_dir} still cannot access required repos." >&2
exit 1
