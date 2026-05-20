# OpenAI Account Handover

Prepared for moving this project to the new OpenAI Pro x20 account.

## What Moves And What Does Not

The project source moves through GitHub and the local checkout. The OpenAI/Codex account state does not automatically move.

You need to recreate in the new OpenAI account:

- Codex access to this local folder.
- GitHub access through either the GitHub connector or the local `gh` CLI.
- The two recurring automations: nightly update at 04:00 and watchdog at 09:00.
- Any private automation memory you want preserved.

You do not need to recreate:

- The public website repository.
- The private suggestion and author-policy repository.
- The Cloudflare Worker, unless you also move Cloudflare ownership.
- GitHub Pages settings.

## Current Project State

- Public repo: `demokratia-info/demokratia-info.github.io`
- Public remote: `https://github.com/demokratia-info/demokratia-info.github.io.git`
- Live site: `https://demokratia-info.github.io/`
- Private suggestion and author-policy repo: `demokratia-info/democracy-paper-suggestions-private`
- Worker endpoint: `https://democracy-paper-suggestions.democracy-info.workers.dev`
- Local checkout on this Mac: `/Users/talraviv/Documents/DemocracyWebSite/github_pages_publish`
- Current public commit: check the latest `main` commit with `git rev-parse HEAD` or GitHub.
- Current paper count after the 10-paper wet run: 52
- Public queue remaining after the 10-paper wet run: 91 queued papers

## First Login Checklist

1. Sign in to Codex with the new OpenAI Pro x20 account.
2. Open this folder in Codex:

```sh
cd /Users/talraviv/Documents/DemocracyWebSite/github_pages_publish
```

3. Confirm GitHub access. On this Mac, the `gh` CLI is already authenticated as `demokratia-info`; a new OpenAI account can still use that local shell authentication unless you intentionally log it out.

```sh
gh auth status
gh repo view demokratia-info/demokratia-info.github.io --json viewerPermission
gh repo view demokratia-info/democracy-paper-suggestions-private --json viewerPermission
```

Expected permission for both repos: `ADMIN` or another level that can read, write, and push.

4. Run the handover preflight:

```sh
./scripts/handover_preflight.sh
```

5. If using Codex GitHub connector instead of only local `gh`, connect the new OpenAI account to GitHub and grant access to both repos:

- `demokratia-info/demokratia-info.github.io`
- `demokratia-info/democracy-paper-suggestions-private`

6. Do not paste visitor names, emails, IP hashes, or private author-policy notes into Codex chat. The automation may read the private queue and private `Authors.MD`, but reports should mention only whether the first suggestion was accepted or rejected and whether any blocked-author exclusion was applied.

## Required Local Tools

The minimum tools for routine operation are:

- Git
- GitHub CLI: `gh`
- Python 3
- Ruby/Bundler/Jekyll for optional local builds
- Node/npm for Pagefind and Cloudflare Wrangler tasks
- Wrangler only when updating/deploying the suggestion Worker

Source validation does not require Ruby:

```sh
python3 scripts/validate_sources.py
```

On this Mac, the reliable local Jekyll build command is:

```sh
/Users/talraviv/.rbenv/versions/3.3.4/bin/ruby -S bundle exec jekyll build
```

Plain `bundle exec jekyll build` may use Apple Ruby 2.6 and fail. GitHub Actions remains the canonical deployment build.

## Recreate The Automations

Automations are account-local. The old account's automations will not run from the new OpenAI account unless recreated.

Create these two automations in the new account:

| Name | Time | Environment | Working Directory | Prompt |
| --- | --- | --- | --- | --- |
| Daily democracy paper additions | 04:00 Asia/Jerusalem every day | local | `/Users/talraviv/Documents/DemocracyWebSite/github_pages_publish` | `AUTOMATION_PROMPT.md` |
| Daily democracy push watchdog | 09:00 Asia/Jerusalem every day | local | `/Users/talraviv/Documents/DemocracyWebSite/github_pages_publish` | `WATCHDOG_AUTOMATION_PROMPT.md` |

Use a local execution environment, not a worktree, for the nightly update. Local runs leave recoverable edits in the normal checkout if a run fails.

Recommended model settings:

- Nightly update: strongest available model in the new account, high or extra-high reasoning.
- Watchdog: same model or a smaller one, medium reasoning.

## First New-Account Wet Check

After recreating the automations, run one manual or wet check before trusting the 04:00 schedule:

```sh
git status --short --branch
python3 scripts/validate_sources.py
./scripts/handover_preflight.sh
```

If you want to test the full path, ask Codex in the new account to run the nightly procedure wet and add 10 summaries. It should:

1. Review at most one private suggestion.
2. Read private `Authors.MD`, reject or skip blocked authors, and consume the first non-blocked rows from `paper_queue.csv`.
3. Add `_papers/*.md` files.
4. Bump `_data/site.json` `cacheVersion`.
5. Regenerate `_data/paper_index.json`.
6. Validate.
7. Commit.
8. Push `main`.
9. Watch the GitHub Pages workflow.
10. Smoke-check `https://demokratia-info.github.io/`.

## Recovery Rules

If a run fails after creating files but before pushing:

- Do not start a second paper-generation run immediately.
- Check `git status --short --branch`.
- Complete, validate, commit, and push the existing local changes.
- Use the 09:00 watchdog only for push/deploy recovery; it must not create content.

If push fails due to DNS or transient network issues:

- Retry a few times.
- If local `HEAD` is ahead of `origin/main`, the watchdog can safely push later.

If private queue or private `Authors.MD` access fails:

- Do not use the public `suggest_queue.csv`; it is only a header placeholder.
- Continue from `paper_queue.csv` only if the public repo is otherwise clean and usable and private `Authors.MD` is accessible for blocked-author checks.
- Report the exact private access blocker.

## Files To Read First

The new account should read these before making changes:

- `HANDOFF.md`
- `README.md`
- `AGENTS.md`
- `AUTOMATION_PROMPT.md`
- `WATCHDOG_AUTOMATION_PROMPT.md`
- `_data/paper_index.json`
- `paper_queue.csv`
- `image_catalog.json`
- Private `demokratia-info/democracy-paper-suggestions-private` `Authors.MD`
