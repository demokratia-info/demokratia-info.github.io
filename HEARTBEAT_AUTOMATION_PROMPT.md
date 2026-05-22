# Unified Website Heartbeat Automation Prompt

Use this prompt for the single Codex heartbeat automation that runs four times daily in this chat.

Schedule: 00:05, 06:05, 12:05, and 18:05 Asia/Jerusalem.

Working directory: `/Users/talraviv/Documents/DemocracyWebSite/github_pages_publish`.

Execution environment: this chat heartbeat, so blockers and completed work are reported back here.

```text
Run the unified Demokratia website heartbeat from `/Users/talraviv/Documents/DemocracyWebSite/github_pages_publish`.

The required first command is:

curl -fsS --max-time 20 https://api.github.com/rate_limit

If that command fails, stop immediately before reading private data, running repo scripts, using GitHub CLI, staging, committing, or pushing. Report the exact network/DNS error.

Use only the `demokratia-info` GitHub account. Do not use the old `tal69` account, do not run `gh auth switch`, and do not change authentication accounts. At the start, run `scripts/refresh_automation_github_auth.sh` from the public website checkout. It must confirm that the active GitHub account is `demokratia-info` and that both the public and private repositories are writable. If another account is active, stop and report the blocker instead of switching accounts.

Before reading or cloning the private repository, run `scripts/check_private_repo_access.sh` from the public website checkout. This preflight checks private repository access without printing private contents. If it fails, retry up to 5 total attempts with short waits. If it still fails, stop and report the exact credential, DNS/network, permission, or private-file blocker.

First, always run the page-feedback revision phase described in `APPROVED_FEEDBACK_AUTOMATION_PROMPT.md`. Process rows marked `approved_for_update`, leave `pending` untouched, and remove rows that are still marked `rejected` from the private feedback queue as handled without changing the public website. Before removing any applied or rejected feedback row from `page_feedback_queue.csv`, append it to private `page_feedback_history.csv` with a `processed_at` timestamp that records the actual Israel-time processing time. This gives editors a window to change a rejected row back to `pending` or `approved_for_update` before the next automation pass. Never expose submitter email, phone, IP hash, private comments, or private editor notes in public files, public commit messages, or public reports.

After the feedback phase, check the current Israel time with `TZ=Asia/Jerusalem date '+%Y-%m-%d %H:%M:%S %Z'`.

Only when the scheduled heartbeat run is the 00:05 Asia/Jerusalem run, perform the daily paper-addition phase described in `AUTOMATION_PROMPT.md`. Use that file as the source of truth for paper criteria, image rules, queue handling, source validation, commits, pushes, and workflow checks. The normal daily paper target remains the target stated in `AUTOMATION_PROMPT.md` unless the user explicitly changes it.

On the 06:05, 12:05, and 18:05 runs, do not add new papers, consume `paper_queue.csv`, rebuild the paper queue, process `suggest_queue.csv`, or update private `Authors.MD`. Those actions belong only to the 00:05 paper-addition pass. Non-midnight runs should only apply approved feedback revisions, append handled feedback rows to `page_feedback_history.csv`, and remove handled rows from `page_feedback_queue.csv`.

Run validation appropriate to the files changed. For public website source changes, run `python3 scripts/validate_sources.py --write-index`, then `python3 scripts/validate_sources.py`; if local Jekyll is available, run `bundle exec jekyll build`. Commit and push public changes only when public source files changed. Commit and push private queue/history changes separately in the private repository. Watch or check the GitHub Pages workflow when public changes are pushed, and smoke-check affected live pages when possible.

If there are no approved feedback rows, no rejected feedback rows to remove, and the run is not the 00:05 paper-addition pass, make no commits and report that there was nothing to apply.
```
