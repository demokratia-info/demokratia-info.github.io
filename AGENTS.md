# Codex Agent Instructions

Read `OPENAI_ACCOUNT_HANDOVER.md`, `HANDOFF.md`, and `README.md` before changing this repository.

This repository is the Jekyll source for the Hebrew democracy summaries site. Do not manually edit generated HTML, `_site/`, or `pagefind/`. Shared layout changes belong in `_layouts/`, `_includes/`, `_data/site.json`, and `assets/css/site.css`.

For paper additions:

- Read `Authors.MD` before searching. Prioritize relevant non-duplicate papers by listed authors, but do not add out-of-scope papers only because the author is listed.
- Use `_data/paper_index.json` as the primary duplicate and ordering index.
- Nightly updates should review at most the first pending row from the private `demokratia-info/democracy-paper-suggestions-private` `suggest_queue.csv`, first come first served. Accept it only if it fits the site's subject criteria and liberal-democratic spirit and is not a duplicate. Remove the processed suggestion row from the private queue whether accepted or rejected, and do not expose submitter name, email, or IP hash in public files or reports.
- Nightly updates should then consume enough rows from `paper_queue.csv` to reach the normal 10-paper nightly batch. Remove those rows only after adding the papers, and rebuild a fresh 100-paper queue only when the queue has fewer rows than needed at the start.
- Add one source file per paper under `_papers/`.
- Use existing topic IDs from `_data/topics.json` unless a durable new topic is really needed.
- Add or reuse 800x600 landscape JPEG paper images and keep `image_catalog.json` current.
- Keep `paper_queue.csv` in CSV format with `paper_name,authors,doi,topic` columns. The `topic` value should use existing topic IDs.
- Keep the public `suggest_queue.csv` as a header-only placeholder. Keep the real private suggestion queue in CSV format with `submitted_date,submitted_at,paper_name,doi,submitter_name,submitter_email,submitter_ip_hash,status,notes` columns. It may contain visitor duplicates; do not let a duplicate suggestion block the build.
- Bump `_data/site.json` `lastUpdated` and `cacheVersion` on each successful content update so returning browsers refresh stale HTML/CSS/Pagefind assets.
- Keep each new paper's `datePublished` equal to its site creation date and do not change it later; use `dateModified`/`lastUpdatedHe` for later edits. The red `חדש!` badge is based on `datePublished` and `_data/site.json` `newBadgeDays`.
- New summaries should follow the admin GEO brief: deeper democratic-liberal analysis, verified numbers only, 2-3 short translated quotes when source text supports them, and at least 10 FAQ-style question/answer sections.
- Regenerate the compact index with `python3 scripts/validate_sources.py --write-index`.
- Validate with `python3 scripts/validate_sources.py` before committing; this also checks the paper queue for duplicate DOI/title and invalid topic IDs, and checks the public suggestion queue placeholder structure.

For publishing, stage only intentional changes, commit with a clear message, push `main`, and monitor the GitHub Pages workflow. `todo.md` is tracked and should be committed when it changes.
