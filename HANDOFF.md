# Democracy Website Codex Handoff

Prepared on 2026-05-17 for continuing this project from another OpenAI Codex account.
Refreshed on 2026-05-20 for handoff to a new OpenAI Pro x20 account.

## Project Snapshot

- GitHub repo: `https://github.com/demokratia-info/demokratia-info.github.io.git`
- Branch: `main`
- Live site: `https://demokratia-info.github.io/`
- Source directory on this machine: `/Users/talraviv/Documents/DemocracyWebSite/github_pages_publish`
- Current public source commit at refreshed handoff: check the latest `main` commit with `git rev-parse HEAD` or GitHub.
- Current content count: 52 paper summaries, 5 topics.
- Current public queue: 91 queued papers remain in `paper_queue.csv`.
- Latest source validation after the 10-paper wet-run check: `python3 scripts/validate_sources.py` passed with 52 papers and 5 topics.
- Latest GitHub Pages deploy should be checked after each push with `gh run list --repo demokratia-info/demokratia-info.github.io --workflow pages.yml --limit 5`.

This is a Jekyll source repository. Generated pages are built by GitHub Actions and should not be maintained manually.

## What The Site Contains

The site publishes Hebrew plain-language summaries of academic papers by Israeli researchers about liberal democracy, rights, institutions, constitutionalism, rule of law, courts, civil society, democratic backsliding, equality, and related subjects.

The site is right-to-left Hebrew, uses shared Jekyll layouts, includes Pagefind search, GoatCounter analytics, Open Graph tags, JSON-LD, an accessibility page, topic pages, paper pages, a CARRD/Tel Aviv University split header logo, and a standard Hebrew disclaimer at the bottom of paper pages.

## Important Source Files

- `README.md` - user-facing source workflow and build notes.
- `AGENTS.md` - short instructions for future Codex agents.
- Private `demokratia-info/democracy-paper-suggestions-private` `Authors.csv` - optional preferred and blocked author list for nightly scans. It also has a `Current Site Papers` column, refreshed from public `_papers` metadata with `python3 scripts/update_author_site_counts.py /path/to/private/Authors.csv`. It is private and must not be committed to this public repo.
- `paper_queue.csv` - editable queue of upcoming nightly papers; nightly automation consumes enough first rows to reach 10 new papers total and removes them after adding those papers.
- `suggest_queue.csv` - header-only public placeholder. The real visitor suggestion queue is private at `demokratia-info/democracy-paper-suggestions-private`.
- Private `demokratia-info/democracy-paper-suggestions-private` `page_feedback_queue.csv` - visitor correction/comment queue with optional contact details and optional suggested paper-photo metadata. It must stay private.
- `_papers/*.md` - one paper summary per Markdown/front matter file.
- `_data/site.json` - site-level settings, including `homepageLatestCount`, `topicPageSize`, `lastUpdated`, image-version labels, and the standard disclaimer.
- `_data/topics.json` - topic taxonomy. Paper membership is read from each paper file's `topics` list.
- `_data/paper_index.json` - generated compact paper index for fast duplicate and ordering checks. Do not hand edit.
- `_layouts/` and `_includes/` - shared page templates.
- `_includes/analytics.html` - site-wide GoatCounter snippet.
- `_includes/site_logo.html` - centered split CARRD/Tel Aviv University logo.
- `assets/css/site.css` - shared styling.
- `assets/js/suggest-paper.js` - public paper suggestion form behavior.
- `assets/js/page-feedback.js` - public page feedback form behavior.
- `assets/topic-icons/` - topic icons.
- `html_qa/` - paper graphics, currently expected to be 800x600 landscape JPEGs.
- `image_catalog.json` - internal metadata for image reuse and homepage-image avoidance.
- `workers/suggest-paper-worker.js` - Cloudflare Worker reference endpoint for receiving public suggestions and page feedback, then appending to private queues.
- `scripts/validate_sources.py` - main validator and paper-index generator.
- `.github/workflows/pages.yml` - GitHub Pages build and deploy workflow.
- `todo.md` - user-maintained project task list; track and commit changes.

Build artifacts `_site/`, `pagefind/`, `.npm-cache/`, and local dependency folders are not committed.

## Deployment Flow

GitHub Actions is the canonical deploy path:

1. Push source changes to `main`.
2. Workflow `Build and deploy Jekyll site` runs.
3. It builds Jekyll into `_site`.
4. It runs Pagefind inside `_site`.
5. It deploys `_site` to GitHub Pages.

Useful commands:

```sh
git status --short --branch
python3 scripts/validate_sources.py
gh run list --repo demokratia-info/demokratia-info.github.io --workflow pages.yml --limit 5
```

Local Jekyll may fail on this machine if Ruby/Bundler is not configured. Do not block normal work on local Jekyll if source validation passes and the GitHub Actions workflow succeeds.

## Adding Papers

Use this sequence for manual or automated paper additions:

1. Read `README.md`, the private `demokratia-info/democracy-paper-suggestions-private` `suggest_queue.csv`, private `page_feedback_queue.csv`, private `Authors.csv`, public `paper_queue.csv`, `_data/paper_index.json`, `_data/topics.json`, `_data/site.json`, and `image_catalog.json`.
2. For nightly runs, review at most the first pending row of the private `suggest_queue.csv` first. Accept it only if it fits the site criteria and liberal-democratic spirit, is not a duplicate, and has no source author marked `blocked`; remove the processed suggestion row from the private queue whether accepted or rejected.
3. Process private page-feedback rows only when the editor has marked them `approved_for_update`; verify every correction against the source before changing a public page, then mark private rows `applied` or `rejected`.
4. Fill the remaining normal 10-paper nightly batch from the first non-blocked rows of `paper_queue.csv`; remove blocked queue rows without counting them toward the batch, and rebuild a fresh 100-paper queue when fewer than the needed curated rows are available at the start.
5. Check `_data/paper_index.json`, `paper_queue.csv`, the private `suggest_queue.csv`, and private `Authors.csv` for duplicate DOI, slug, title, author, theme, and blocked-author exclusions.
6. Add a new `_papers/*.md` file with JSON front matter between `---` markers.
7. Give new papers larger numeric `sortKey` values than existing records, usually `YYYYMMDD0001`, `YYYYMMDD0002`, etc. The index sorts descending by `sortKey`.
8. Assign one or more existing topic IDs from `_data/topics.json`.
9. Link author names only when the author identity is certain and the link is an official academic profile or clearly maintained academic home page. Before leaving a name unlinked, reuse matching URLs from existing `_papers/*.md`, then check DOI/publisher metadata, ORCID links, institutional directories, personal academic sites, and quoted-name searches with affiliation or paper title; report unresolved names instead of guessing.
10. Make external paper and author links open in a new tab with `target="_blank"` and `rel="noopener noreferrer"` in stored HTML fields.
11. Add a newly sourced or generated 800x600 landscape JPEG in `html_qa/`; do not reuse an existing site image for a new paper.
12. Update `image_catalog.json`.
13. Remove consumed rows from the private `suggest_queue.csv` and/or public `paper_queue.csv`.
14. Bump `_data/site.json` `lastUpdated` and `cacheVersion` so returning browsers refresh after deploy. Set `datePublished` only when the page is created; use `dateModified`/`lastUpdatedHe` for later edits. `newBadgeDays` controls how long `חדש!` appears after `datePublished`.
15. Run `python3 scripts/validate_sources.py --write-index`.
16. Run `python3 scripts/validate_sources.py`.
17. Commit and push source changes only.

Do not edit generated root HTML pages, `_site/`, or `pagefind/` by hand.

## Homepage Spotlight

The homepage spotlight count is controlled by `_data/site.json`:

```json
"homepageLatestCount": 6
```

The nightly automation does not need to know this count for layout. It only needs to avoid reusing images currently appearing in the newest 6 homepage cards, because repeated images at the top of the site look bad.

The first three homepage cards get high-priority image loading in the shared layout. Later cards are lazy-loaded.

## Images

Paper images should be:

- 800x600 landscape JPEG.
- Similar in style to the current better images.
- Polished editorial illustration, not crude cartoon or flat clip art.
- Warm cream and ochre tones, muted teal/deep-blue accents, Mediterranean civic architecture, dignified human figures when useful, natural light, symbolic but concrete composition.
- No text, letters, logos, flags, watermarks, UI widgets, or pasted-looking layers.

Before creating a new image, check `image_catalog.json` so the new image is not a repeat of an existing site image.

## Site-Wide Features

- Search: Pagefind is generated by GitHub Actions after Jekyll builds `_site`.
- Analytics: GoatCounter snippet lives in `_includes/analytics.html`.
- Logo: `_includes/site_logo.html` uses the transparent CARRD/Tel Aviv University image. The upper part links to `https://carrdtau.sites.tau.ac.il/` in the same tab; the lower TAU part links to `https://www.tau.ac.il/` in the same tab.
- Paper footer: the full Hebrew disclaimer is stored in `_data/site.json` as `readingNoteHe`.
- Last updated: paper pages show the last-updated value from the source data.
- Browser refresh: shared page heads load versioned CSS/Pagefind assets and compare the page's `cacheVersion` with `/site-version.json`; stale pages reload once with a `site_version` query parameter.
- New badge: cards show the red `חדש!` label for papers whose `datePublished` page-creation date is inside `_data/site.json` `newBadgeDays`, currently 3 calendar days.
- Suggest a paper: the homepage footer links to `/suggest-paper.html` with the Hebrew label `הצע מאמר`. The form is English, requires paper title, DOI, submitter name, and email, and redirects home 5 seconds after a successful submission. GitHub Pages needs a server-side endpoint for real CSV writes; configure `_data/site.json` `suggestPaperEndpoint` after deploying `workers/suggest-paper-worker.js`.
- Page feedback: every public page footer links to `/page-feedback.html` with the Hebrew label `הצעות לתיקונים והערות`. The form accepts Hebrew or English comments, an optional suggested photo, optional email, optional phone, and an optional editor password. It posts to `_data/site.json` `pageFeedbackEndpoint`, and the Worker appends rows to private `page_feedback_queue.csv`; original uploaded photos are stored only in the private operational repository. A correct editor password writes the row as `approved_for_update`; an empty or incorrect password is ignored and writes ordinary `pending` feedback. The Worker must never store the password.
- Accessibility: `accessibility.html` exists; `todo.md` still notes that public accessibility contact details are needed.

## Nightly Automation Handoff

The current Codex automation is local to the original account and machine. A different OpenAI Codex account will need to recreate it. For the new OpenAI Pro x20 account, start with `OPENAI_ACCOUNT_HANDOVER.md`.

Current local automation file:

```text
/Users/talraviv/.codex/automations/daily-democracy-paper-additions/automation.toml
```

Current automation memory file:

```text
/Users/talraviv/.codex/automations/daily-democracy-paper-additions/memory.md
```

Current automation state:

- Automation name: `Daily democracy paper additions`
- Status: `ACTIVE`
- Schedule: daily at 04:00 Asia/Jerusalem
- Working directory in the automation: live local repository `/Users/talraviv/Documents/DemocracyWebSite/github_pages_publish`
- Execution environment: `local`, so failed runs leave recoverable edits in the normal checkout
- Model requested: `gpt-5.5`
- Reasoning effort: `xhigh`

A ready-to-use prompt based on the current automation is copied into `AUTOMATION_PROMPT.md` for recreation in the new account. The 09:00 watchdog prompt is copied into `WATCHDOG_AUTOMATION_PROMPT.md`. The memory files themselves are not in this repo; if preserving run history matters, copy the local memory files or summarize their latest entries into the new account's automation memory.

Latest successful wet-run check added three papers and pushed commit `e819c6d`:

- Akirav - democratic backsliding and the constitutional blitz.
- Neubauer-Shani and Friedman - political scientists' mediated engagement during democratic backsliding.
- Neubauer-Shani - political scientists and the civic studies debate.

The automation has since been redesigned to consume `paper_queue.csv` before doing any new broad paper search.

## New Account Setup Checklist

1. Sign in to the new OpenAI Pro x20 Codex account.
2. Read `OPENAI_ACCOUNT_HANDOVER.md` first; it has the current account migration checklist and a preflight script.
3. Ensure the GitHub account or connector has access to `demokratia-info/demokratia-info.github.io` and the private suggestion queue `demokratia-info/democracy-paper-suggestions-private`.
4. Clone the repo or open the local folder:

```sh
git clone https://github.com/demokratia-info/demokratia-info.github.io.git
cd demokratia-info.github.io
```

5. Check GitHub CLI/auth if local push and workflow monitoring are needed:

```sh
gh auth status
gh repo view demokratia-info/demokratia-info.github.io
```

6. Validate source:

```sh
python3 scripts/validate_sources.py
```

7. Run the bundled handover preflight:

```sh
./scripts/handover_preflight.sh
```

8. Recreate the 04:00 daily automation using `AUTOMATION_PROMPT.md`.
9. Recreate the 09:00 watchdog automation using `WATCHDOG_AUTOMATION_PROMPT.md`.
10. After the first new-account automation run, confirm:

```sh
git status --short --branch
python3 scripts/validate_sources.py
gh run list --repo demokratia-info/demokratia-info.github.io --workflow pages.yml --limit 5
```

## Known Caveats

- The live source is the nested `github_pages_publish` directory in the local Dropbox workspace. The top-level `DemocracyWebSite` folder is not itself the publish repo.
- GitHub authentication and OpenAI/Codex authentication are separate.
- Local Jekyll can be unavailable even when GitHub Actions builds correctly. On this Mac, the reliable command is `/Users/talraviv/.rbenv/versions/3.3.4/bin/ruby -S bundle exec jekyll build`; plain `bundle` may use Apple Ruby 2.6 and fail.
- Dropbox-backed Git checkouts can sometimes show `.git/index.lock` issues. If this happens, inspect carefully before deleting a lock file; only remove it when no Git process is running.
- Do not commit generated `_site/`, `pagefind/`, `.npm-cache/`, or dependency folders.
- The handoff files are excluded from Jekyll output, but they are still repo files.

## Current Todo Notes

See `todo.md`. At handoff, the main remaining themes are:

- Domain under `tau.ac.il`.
- Contact/about pages and a contact mailbox.
- More search engine and AI-crawler visibility work.
- PR/search promotion and social media promotion.
- Possible Arabic translation.
- Author affiliations and author notification/opt-out workflow.
- Accessibility improvements, especially public accessibility contact details.
