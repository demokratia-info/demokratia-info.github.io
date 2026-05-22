# הנגשת מידע בנושאי דמוקרטיה

Static Hebrew RTL homepage and article summaries for GitHub Pages, built with Jekyll and indexed with Pagefind.

For transferring this project to another Codex/OpenAI account, start with `OPENAI_ACCOUNT_HANDOVER.md`, `HANDOFF.md`, and `AGENTS.md`.

## Source Workflow

The repository source is now Jekyll content, not hand-edited generated HTML:

- `_papers/*.md` - one Markdown/front-matter source file per paper summary.
- Private `demokratia-info/democracy-paper-suggestions-private` `Authors.csv` - optional preferred and blocked author list for the nightly scan. It is private because it may contain sensitive editorial preferences or contact details.
- `paper_queue.csv` - editable nightly queue of upcoming papers. It uses `paper_name,authors,doi,topic` columns; the nightly automation consumes the first needed rows to reach 10 new papers total and removes them after the corresponding paper pages are added.
- `suggest_queue.csv` - header-only public placeholder for compatibility. The operational visitor suggestion queue lives in the private repository `demokratia-info/democracy-paper-suggestions-private` because it contains names and email addresses.
- Private `demokratia-info/democracy-paper-suggestions-private` `page_feedback_queue.csv` - visitor page comments, correction suggestions, optional suggested photo metadata, and optional contact details. It must stay private.
- `_data/site.json` - site-level settings.
- `_data/topics.json` - topic taxonomy and topic metadata. Paper membership is read from each paper's `topics` list.
- `_data/paper_index.json` - compact generated index for duplicate checks and nightly updates. Regenerate it from `_papers/*.md`; do not edit it manually.
- `_layouts/` and `_includes/` - shared page templates.
- `_includes/analytics.html` - site-wide GoatCounter analytics snippet.
- `assets/css/site.css` - shared visual styling.
- `assets/js/suggest-paper.js` - browser behavior for the public paper suggestion form.
- `assets/js/page-feedback.js` - browser behavior for page correction/comment submissions.
- `assets/topic-icons/` and `html_qa/` - topic icons and article images.
- `workers/suggest-paper-worker.js` - optional Cloudflare Worker endpoint that receives public suggestions and page feedback, then appends them to the private CSV queues.
- `scripts/validate_sources.py` - source validator and paper-index generator.

Codex nightly updates should read the private `demokratia-info/democracy-paper-suggestions-private` `suggest_queue.csv`, private `page_feedback_queue.csv`, the private `Authors.csv`, and the public `paper_queue.csv`, then use `_data/paper_index.json` for duplicate checks. Review at most the first pending visitor paper suggestion from the private queue each night, in first-come-first-served order. Accept it only if it fits the website's subject and liberal-democratic spirit, is not a duplicate, and has no source author marked `blocked` in private `Authors.csv`; accepted suggestions count toward the nightly batch. Remove the processed suggestion row from the private queue whether accepted or rejected, and report the decision without exposing submitter details. Process page-feedback rows only after an editor marks them `approved_for_update`; verify every factual correction against the paper/source before changing a public page, and process any approved suggested photo only after validating that it is suitable for the paper, then mark the private row `applied` or `rejected`. Add each new paper's source authors who are members of academic institutions or clear scholarly research institutes to private `Authors.csv` with priority `normal` when they are not already listed, including verified affiliation, profile URL, ORCID, and email when available from official public pages. After public `_papers` changes are complete, refresh private `Authors.csv` `Current Site Papers` with `python3 scripts/update_author_site_counts.py /path/to/private/Authors.csv`. Then use enough rows from `paper_queue.csv` to reach the normal 10-paper nightly batch.

Run `scripts/check_private_repo_access.sh` before private queue or author-policy work. The script checks that `gh` is using the `demokratia-info` account, confirms write-capable permission on the private repository, verifies the private file paths without printing private contents, and checks authenticated git access.

For unattended local automations, keep GitHub auth simple: the active `gh`
account must already be `demokratia-info`. Run
`scripts/refresh_automation_github_auth.sh` before `gh` or remote Git commands;
it verifies the active account and required public/private repo access without
running `gh auth switch`, using the old `tal69` account, or relying on copied
automation `gh-auth` directories.

If `paper_queue.csv` has fewer rows than needed at the start, Codex should prepare a fresh 100 relevant non-duplicate queued papers using the same criteria, with private `Authors.csv` as a priority and blocklist signal, before consuming the first needed rows. Authors marked `high`, `normal`, or `low` are priority signals only; authors marked `blocked` are hard exclusions for visitor suggestions, current queue rows, and new queue candidates.

After selecting papers, Codex nightly updates should add new papers as `_papers/*.md` files, add a new unique image for every new paper, update `image_catalog.json`, update the private `suggest_queue.csv` when a suggestion is processed, update public `paper_queue.csv`, bump `_data/site.json` `lastUpdated` and `cacheVersion`, regenerate `_data/paper_index.json`, refresh `_data/homepage_high_fit_sample.json` with `python3 scripts/sample_homepage_high_fit.py --write`, and then commit/push. Never recycle, copy, or reassign an existing site picture/photo for a new paper. Use a deliberate mixture of newly generated paper-specific images and newly obtained Wikimedia/Commons photographs, all resized or cropped to 800x600, and keep Wikimedia source/license metadata in `image_catalog.json`. Each paper `image` object must include `fitness`, one of `high`, `standard`, or `low`, for the specific image-paper tuple. Only `high` images appear near the top of the paper summary page and are eligible for the homepage sample; be conservative and use `standard` unless the image is clearly and specifically matched to the paper. Images should follow the older warm editorial or documentary civic style with people, institutions, documents, civic rooms, public spaces, depth, and texture; avoid flat vector icons, isolated scales/buildings, abstract blobs, sparse diagrams, generated text, logos, watermarks, and other schematic graphics. Update `_data/topics.json` only when adding or changing a topic. They should not edit generated HTML pages manually.

Each paper source has a stable `sortKey`. New papers should receive larger `sortKey` values, such as `YYYYMMDD0001`, `YYYYMMDD0002`, and `YYYYMMDD0010`, so the newest papers sort first without rewriting older paper files.

The shared head includes a cache-refresh check against `site-version.json`. When deployed `cacheVersion` differs from the version in a user's cached page, the browser reloads that page once with a `site_version` query parameter. Use a new `cacheVersion` value for every content deploy, for example `2026-05-20-nightly`.

Paper pages distinguish creation from later edits. `datePublished` is the date the page was first created on this site and should not change later; `dateModified` and `lastUpdatedHe` describe the latest edit/update. The red `חדש!` badge is creation-date based, not position-based: `_data/site.json` `newBadgeDays` controls the window, and cards show the badge only when `datePublished` falls within that many calendar days of the build date.

## Visitor Paper Suggestions

The homepage footer links to `/suggest-paper.html` with the Hebrew label `הצע מאמר`. The public page is in English and asks for four required fields: paper title, DOI number, submitter name, and submitter email. After a successful submission, the page shows a thank-you message for 5 seconds and then redirects to the homepage.

GitHub Pages cannot write to CSV files or enforce IP/source limits by itself. The form posts to `_data/site.json` `suggestPaperEndpoint`; when that value is empty, the form is visible but submissions are disabled. Deploy `workers/suggest-paper-worker.js` and set `suggestPaperEndpoint` to the Worker URL to make the form live.

The Worker enforces the two-suggestions-per-source-per-Israel-calendar-day limit and writes accepted submissions to the private repository's `suggest_queue.csv`. It stores a daily salted hash of the source IP rather than the raw IP address. When a mail server is available, add email verification before the Worker writes a row or before the nightly automation accepts a suggested paper.

## Page Corrections And Comments

Every public page footer links to `/page-feedback.html` with the Hebrew label `הצעות לתיקונים והערות`. The link passes the source page URL and title to the form. Visitors can submit comments in Hebrew or English, may upload an optional suggested photo for the paper, choose whether they are the paper author, another researcher, or prefer not to share, and may optionally add an email address or phone number. The form also includes an optional editor-password field. If that field matches the Worker editor password, the row is written with status `approved_for_update`; if it is empty or incorrect, the password field is ignored and the row is handled as ordinary `pending` feedback.

The form posts to `_data/site.json` `pageFeedbackEndpoint`, currently the same Worker URL as paper suggestions plus `/page-feedback`. The Worker writes accepted rows to private `page_feedback_queue.csv`, stores optional original photo uploads privately under `page_feedback_photos/`, stores the submitter-role choice as `submitter_role`, and stores only a daily salted hash of the source IP, not the raw IP address. It must never store the editor password. Contact fields, free-text comments, role choices, and original uploaded photos must never be committed to this public repository.

Editors should review private feedback rows and mark only actionable rows `approved_for_update`. The editor page can show a password-protected preview of a suggested photo. Nightly automation should act only on approved rows, verify the correction against the source paper or reliable metadata, validate any suggested photo as landscape, crop minor aspect-ratio differences to 4:3, convert accepted photos to 800x600 JPEG, update the relevant public source page when safe, and then mark the private row `applied` or `rejected`. Approved user-uploaded photos are always considered `high` fitness for that paper, so they appear near the top of the summary page after publication.

Because the real `suggest_queue.csv`, `page_feedback_queue.csv`, uploaded page-feedback photos, and private `Authors.csv` may contain sensitive information, they must stay in `demokratia-info/democracy-paper-suggestions-private` or another private store. Do not commit visitor-submitted rows, original uploaded feedback photos, or the private author policy file to this public website repository.

## Summary Writing Guidance

New paper summaries should follow the admin GEO brief: no model preamble or sign-off; a clear H1-style `titleHe`; an optional `subtitleHe` only when it adds a substantive democratic-liberal angle, never when it merely repeats the English paper title or a generic "Hebrew summary" phrase; organized metadata for authors, venue, date, volume/issue when available, and DOI/source link; a deeper analytical `summaryHe`/`oneLinerHtml` that foregrounds the paper's democratic-liberal, rights, legal, institutional, social, or economic implications; only verified numbers/statistics from the paper or source metadata; short translated direct quotes only when source text is available, the quote is important, and the translation is faithful to the exact source passage. Do not repeat the metadata as body text with boilerplate lines such as `רשומת המקור מציינת...` or `המקור פורסם...`, and do not add generic filler sections such as `מה נושא המאמר?`, `האם המאמר משפטי או פוליטי?`, `מה לא נכון להסיק מן התמצית?`, `איזו מסקנה לא כדאי להסיק מהר מדי?`, `למי המאמר רלוונטי?`, `איך אפשר להשתמש במאמר במחקר נוסף?`, `המסגור הזה נשען על כותרת המקור...`, `כדי לשמור על נאמנות למקור...`, `השימושיות הזאת מוגבלת לקריאה זהירה במאמר עצמו...`, or `השורה התחתונה צריכה להיקרא...`. Do not include translated quotes from memory, secondary descriptions, inferred content, or uncertain wording. Prefer placing a verified quote near the answer it supports; and add at least 10 natural question/answer sections using realistic search or AI-chat questions. Question headings should stand alone with a question mark and should not start with `שאלות ותשובות:`.
Do not repeat the English `paperTitle` in the first body sentence after it has already appeared in the article metadata. Use a reliable Hebrew translation of the paper title when useful, or write around the subject/research question when a faithful title translation is uncertain.

## Build and Deploy

GitHub Actions builds and deploys the site:

1. `bundle exec jekyll build`
2. `npx -y pagefind --site _site --output-subdir pagefind`
3. upload `_site` to GitHub Pages

For local testing:

```sh
bundle install
bundle exec jekyll build
npm_config_cache="$PWD/.npm-cache" npx -y pagefind --site _site --output-subdir pagefind
rm -rf .npm-cache
```

Use a Ruby version compatible with the `github-pages` gem for local builds. The GitHub Actions workflow is the canonical deployment build.

## Source Validation

Regenerate the compact paper index after changing `_papers/*.md`:

```sh
python3 scripts/validate_sources.py --write-index
```

Check source consistency before committing:

```sh
python3 scripts/validate_sources.py
```

This also checks `paper_queue.csv` for duplicate queued titles/DOIs, queue entries already present on the site, and invalid topic IDs. It checks the public placeholder `suggest_queue.csv` for the required header. The generated `_site/` directory and `pagefind/` output are build artifacts and are not committed.
