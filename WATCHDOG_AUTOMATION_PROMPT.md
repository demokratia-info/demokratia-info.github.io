# Daily Democracy Push Watchdog Automation Prompt

Use this prompt when recreating the 09:00 watchdog automation in another OpenAI/Codex account.

Recommended schedule: daily at 09:00 Asia/Jerusalem.

Recommended working directory: `/Users/talraviv/Documents/DemocracyWebSite/github_pages_publish`.

Recommended execution environment: `local`.

Local GitHub authentication for automations should prefer the dedicated
non-keychain config directory `/Users/talraviv/.codex/automations/daily-democracy-paper-additions/gh-auth` when it
exists. Before GitHub CLI commands, `git ls-remote`, `git push`, workflow
monitoring, or other remote GitHub operations, export
`GH_CONFIG_DIR=/Users/talraviv/.codex/automations/daily-democracy-paper-additions/gh-auth` after running
`scripts/refresh_automation_github_auth.sh`, then unset `GH_TOKEN` and
`GITHUB_TOKEN` for subsequent commands. Do not print or copy any token.

```text
Check whether the nightly democracy website update committed locally but failed to push or deploy.

Work in `/Users/talraviv/Documents/DemocracyWebSite/github_pages_publish`. The public website repository is `demokratia-info/demokratia-info.github.io`, and the live site URL is `https://demokratia-info.github.io/`. Start by reading `/Users/talraviv/.codex/automations/daily-democracy-paper-additions/memory.md` and this automation's memory file if those files exist. Then run `git status --short --branch`, `git rev-parse HEAD`, and `git ls-remote origin refs/heads/main`.

At the start of the run, run `scripts/refresh_automation_github_auth.sh`. If
`/Users/talraviv/.codex/automations/daily-democracy-paper-additions/gh-auth/hosts.yml` exists after that, run
`export GH_CONFIG_DIR=/Users/talraviv/.codex/automations/daily-democracy-paper-additions/gh-auth` and `unset
GH_TOKEN GITHUB_TOKEN`, then keep that environment in force for all `gh` commands
and remote Git operations.

This watchdog must not create paper content, edit source files, stage files, or make commits. Its job is only to verify and recover publishing for work that already exists locally.

If the checkout is on `main` and local `HEAD` is ahead of `origin/main`, push the existing local commits with `git push origin main`. If the checkout is detached but local `HEAD` clearly contains the intended nightly commit, use `git push origin HEAD:main`. Retry the push up to 5 total attempts, waiting about 30 seconds between transient network failures such as DNS, timeout, connection reset, or GitHub unavailable. Stop immediately and report the exact blocker for interactive credentials, permissions denial, non-fast-forward rejection, or any ambiguous branch state.

After any push, verify that `origin/main` equals local `HEAD` using `git rev-parse HEAD` and `git ls-remote origin refs/heads/main`. Then check the GitHub Pages workflow with `gh run list --repo demokratia-info/demokratia-info.github.io --workflow pages.yml --limit 5`; if a run for the pushed commit is in progress, watch it when possible. If deployment succeeds, smoke-check the live site with `curl https://demokratia-info.github.io/` for a title or URL from the newest paper in `_data/paper_index.json`.

If local `HEAD` already equals `origin/main`, do not push. Instead verify the latest Pages workflow status and smoke-check the live homepage when practical.

Report only the useful result: pushed and deployed, already up to date, still waiting, or blocked with exact command output.
```
