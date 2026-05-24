# Author Notice Mailer

This workflow lets editors gradually notify authors whose papers already have Hebrew summaries on the website. It is intentionally split into three stages:

1. Prepare private queue rows from `Authors.csv` and the public `_papers` metadata.
2. Let a password-authenticated editor mark selected rows as `ready_to_send` on `/author-mailer.html`.
3. Run a local script that sends only `ready_to_send` rows.

The website editor page never sends email directly. Gmail credentials must never be committed to either repository.

## Private Files

All operational files live in the private `demokratia-info/democracy-paper-suggestions-private` repository:

- `Authors.csv`
- `author_notice_queue.csv`
- `author_notice_history.csv`

Blocked authors are never queued for sending. Rows for blocked authors, if recorded, must stay non-sendable.

## Prepare The Queue

From the public website checkout:

```sh
python3 scripts/prepare_author_notice_queue.py --include-all-existing --write
```

This command:

- adds author-notice tracking columns to private `Authors.csv` when missing;
- queues one row per current author-paper pair when the author has a valid email, a source URL for that email/profile, at least one current paper on the site, and is not blocked;
- leaves all new rows as `pending_editor_release`.

For nightly paper additions, run the same command after `Authors.csv` paper counts are refreshed. It will add missing rows for newly added paper-author pairs without resending rows already present in queue/history.

## Editor Release

Open:

```text
https://demokratia-info.github.io/author-mailer.html
```

After entering the editor password, the editor can mark selected author-paper rows as `ready_to_send`. The page writes only to the private queue through the Cloudflare Worker endpoint.

## Gmail Sending

Create a private local environment file outside the repo, for example:

```sh
cat > ~/.demokratia_author_mail.env <<'EOF'
AUTHOR_NOTICE_SMTP_HOST=smtp.gmail.com
AUTHOR_NOTICE_SMTP_PORT=587
AUTHOR_NOTICE_SMTP_USER=your.gmail.account@gmail.com
AUTHOR_NOTICE_SMTP_PASSWORD=your-google-app-password
AUTHOR_NOTICE_MAIL_FROM=Demokratia <your.gmail.account@gmail.com>
AUTHOR_NOTICE_REPLY_TO=demokratia@tau.ac.il
AUTHOR_NOTICE_CC=demokratia@tau.ac.il
AUTHOR_NOTICE_MAX_AUTHORS=10
AUTHOR_NOTICE_PAUSE_SECONDS=3
EOF
chmod 600 ~/.demokratia_author_mail.env
```

First test without sending:

```sh
python3 scripts/send_author_notices.py --dry-run --max-authors 3
```

Send only after confirming the preview:

```sh
python3 scripts/send_author_notices.py --send --max-authors 3
```

The script groups multiple ready paper rows into one email per author, sends `Cc: demokratia@tau.ac.il`, sets `Reply-To: demokratia@tau.ac.il`, appends delivery records to `author_notice_history.csv`, removes successfully sent rows from the active queue, and updates the author's last-send columns in private `Authors.csv`.

If Gmail later allows a verified `demokratia@tau.ac.il` send-as alias, `AUTHOR_NOTICE_MAIL_FROM` can be changed to:

```text
Demokratia <demokratia@tau.ac.il>
```

Until that is tested, keep Gmail as the visible sender and use the TAU address for replies.
