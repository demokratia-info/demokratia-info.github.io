# Website Form Worker

GitHub Pages is static, so the public forms cannot append to private CSV queues or enforce IP/source limits by themselves. This Cloudflare Worker is the server-side endpoint for both public forms.

The Worker:

- accepts paper suggestions at the Worker root path and appends accepted rows to private `suggest_queue.csv`;
- accepts page correction/comment submissions at `/page-feedback` and appends accepted rows to private `page_feedback_queue.csv`;
- lets editors optionally include the editor password with a page-feedback submission; a correct password writes the row as `approved_for_update`, while an empty or incorrect password is ignored and the row remains ordinary `pending` feedback;
- exposes a password-protected editor API at `/admin/page-feedback` for listing feedback rows and changing their status;
- keeps page feedback contact fields optional;
- stores only a daily salted hash of the submitter IP, not the raw IP address;
- allows up to two accepted paper suggestions and five accepted page-feedback submissions per source per Israel calendar day;
- writes the queues through the GitHub Contents API.

`page_feedback_queue.csv` uses this header:

```csv
submitted_date,submitted_at,page_url,page_title,page_slug,paper_title,doi,comment,submitter_email,submitter_phone,submitter_ip_hash,status,editor_notes,applied_at
```

The unified heartbeat automation must run the feedback-revision phase four times daily. It applies rows that the editor has explicitly marked `approved_for_update`, leaves `pending` rows untouched, and removes rows still marked `rejected` as handled during the next processor run. Paper additions run only during the heartbeat's 00:05 Asia/Jerusalem pass.

When the heartbeat removes applied or rejected feedback rows from `page_feedback_queue.csv`, it must first append them to private `page_feedback_history.csv`. The history file uses this header:

```csv
submitted_date,submitted_at,page_url,page_title,page_slug,paper_title,doi,comment,submitter_email,submitter_phone,submitter_ip_hash,status,editor_notes,applied_at,processed_at,processing_notes
```

`processed_at` must contain the actual Israel-time processing timestamp, not just the scheduled run date.

## Deploy

Copy `wrangler.toml.example` to `wrangler.toml`, then set secrets:

```sh
cd workers
wrangler secret put GITHUB_TOKEN
wrangler secret put IP_HASH_SECRET
wrangler secret put EDITOR_PASSWORD
wrangler deploy
```

`GITHUB_TOKEN` needs permission to write repository contents. `EDITOR_PASSWORD` protects the editor API and enables optional editor approval from the page-feedback form; alternatively use `EDITOR_PASSWORD_SHA256` with the SHA-256 hex digest of the password. The page-feedback form never stores the submitted password. After deployment, copy the Worker URL into `_data/site.json` as `suggestPaperEndpoint`, use the same URL plus `/page-feedback` as `pageFeedbackEndpoint`, and use the same URL plus `/admin/page-feedback` as `feedbackEditorEndpoint`.

If this repository is public, remember that names, emails, phone numbers, and free-text comments committed to CSV files are visible in GitHub history even though the files are excluded from the built Jekyll site. For private handling of personal data, point `GITHUB_REPO`, `QUEUE_PATH`, and `FEEDBACK_QUEUE_PATH` at a private repository and adjust the nightly automation to read those private queues.
