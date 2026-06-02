# Demokratia Info Website

This repository contains the public Jekyll source for the Demokratia Info website.

The public repo should contain only website source, public content, build scripts, and generic contributor guidance. Operational handover notes, automation prompts, runbooks, private queues, editor workflows, author-contact records, and other internal instructions live in the private `democracy-paper-suggestions-private` repository.

## Public Source Layout

- `_papers/` - public paper summary source files.
- `_data/` - public site metadata and generated public indexes.
- `_layouts/` and `_includes/` - Jekyll templates.
- `assets/` - public CSS, JavaScript, icons, and supporting assets.
- `html_qa/` - public article images.
- `scripts/` - public validation, retention-cleanup, and build-support scripts.
- `topics/` - public topic pages.

## Local Checks

After editing paper sources or queue data, run:

```sh
python3 scripts/validate_sources.py
```

For a local Jekyll build:

```sh
bundle install
bundle exec jekyll build
```

GitHub Actions remains the canonical deployment build for the public website.
