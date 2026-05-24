# Unified Website Heartbeat Automation Prompt

Use this prompt for the single Codex heartbeat automation that runs every three hours in this chat.

Schedule: 00:05, 03:05, 06:05, 09:05, 12:05, 15:05, 18:05, and 21:05 Asia/Jerusalem.

Working directory: `/Users/talraviv/Documents/DemocracyWebSite/github_pages_publish`.

Execution environment: this chat heartbeat, so blockers and completed work are reported back here.

```text
Run the unified Demokratia website heartbeat from `/Users/talraviv/Documents/DemocracyWebSite/github_pages_publish`.

The required first command is:

curl -fsS --max-time 20 https://api.github.com/rate_limit

If that command fails, stop immediately before reading private data, running repo scripts, using GitHub CLI, staging, committing, or pushing. Report the exact network/DNS error.

Use only the `demokratia-info` GitHub account. Do not use the old `tal69` account, do not run `gh auth switch`, and do not change authentication accounts. At the start, run `scripts/refresh_automation_github_auth.sh` from the public website checkout. It must confirm that the active GitHub account is `demokratia-info` and that both the public and private repositories are writable. If another account is active, stop and report the blocker instead of switching accounts.

Before reading or cloning the private repository, run `scripts/check_private_repo_access.sh` from the public website checkout. This preflight checks private repository access without printing private contents. If it fails, retry up to 5 total attempts with short waits. If it still fails, stop and report the exact credential, DNS/network, permission, or private-file blocker.

First, always run the page-feedback revision phase described in `APPROVED_FEEDBACK_AUTOMATION_PROMPT.md`. Process rows marked `approved_for_update`, including any approved suggested paper-photo replacement, leave `pending` untouched, and remove rows that are still marked `rejected` from the private feedback queue as handled without changing the public website. Before removing any applied or rejected feedback row from `page_feedback_queue.csv`, append it to private `page_feedback_history.csv` with a `processed_at` timestamp that records the actual Israel-time processing time. This gives editors a window to change a rejected row back to `pending` or `approved_for_update` before the next automation pass. Never expose submitter email, phone, IP hash, private comments, uploaded original photos, or private editor notes in public files, public commit messages, or public reports.

After the feedback phase, check the current Israel time with `TZ=Asia/Jerusalem date '+%Y-%m-%d %H:%M:%S %Z'`.

Only when the scheduled heartbeat run is the 00:05 Asia/Jerusalem run, perform the daily paper-addition phase described in `AUTOMATION_PROMPT.md`. Use that file as the source of truth for paper criteria, image rules, queue handling, source validation, commits, pushes, and workflow checks. The normal daily paper target remains the target stated in `AUTOMATION_PROMPT.md` unless the user explicitly changes it.

During the 00:05 run, after paper additions and any approved feedback revisions are reflected in the public paper sources, run `python3 scripts/sample_homepage_high_fit.py --write` so `_data/homepage_high_fit_sample.json` contains six sampled papers whose `image.fitness` is `high`. Include that file in the public commit whenever it changes.

Also during the 00:05 run, after private `Authors.csv` `Current Site Papers` counts are refreshed, run `python3 scripts/prepare_author_notice_queue.py --include-all-existing --write --private-dir /path/to/private/repo` from the public website checkout. This only updates private author-notice metadata and queues missing non-blocked author-paper notice rows in `pending_editor_release` status; it must never send email. Author-notice sending is a separate local action performed only by `python3 scripts/send_author_notices.py --send`, and only after the website editor marks rows as `ready_to_send` on `/author-mailer.html`.

On every non-00:05 run, including 03:05, 06:05, 09:05, 12:05, 15:05, 18:05, and 21:05, do not add new papers, consume `paper_queue.csv`, rebuild the paper queue, process `suggest_queue.csv`, or update private `Authors.csv`. Those actions belong only to the 00:05 paper-addition pass. Non-midnight runs should only apply approved feedback revisions, append handled feedback rows to `page_feedback_history.csv`, and remove handled rows from `page_feedback_queue.csv`.

Non-midnight feedback runs are approved-feedback-scoped. If an approved row identifies a problem on one page only, edit only that page and required generated metadata. If the commenter explicitly points out that the same problem appears on many pages, and the editor approved that row, the run may perform a focused site-wide cleanup for that specific problem. Keep that cleanup narrowly tied to the approved comment: do not run unrelated audits, style rewrites, or quality passes, and do not invent facts, citations, names, or interpretations merely to broaden the cleanup. In the report, document the pattern searched for, the files changed, and why each class of change follows from the approved comment.

Run validation appropriate to the files changed. For public website source changes, run `python3 scripts/validate_sources.py --write-index`, then `python3 scripts/validate_sources.py`; if local Jekyll is available, run `bundle exec jekyll build`. Commit and push public changes only when public source files changed. Commit and push private queue/history changes separately in the private repository. Watch or check the GitHub Pages workflow when public changes are pushed, and smoke-check affected live pages when possible.

If there are no approved feedback rows, no rejected feedback rows to remove, and the run is not the 00:05 paper-addition pass, make no commits and report that there was nothing to apply.
```
