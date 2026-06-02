# Website Form Worker

GitHub Pages is static, so the public forms cannot append to private CSV queues or enforce IP/source limits by themselves. This Cloudflare Worker is the server-side endpoint for both public forms.

The Worker:

- accepts paper suggestions at the Worker root path, stores them first in private `suggest_confirmation_queue.csv`, sends a confirmation email, and appends a row to private `suggest_queue.csv` only after the submitter clicks the confirmation link;
- exposes email-link actions at `/confirm-suggestion?token=...` and `/report-suggestion?token=...`; reporting marks the pending row as `reported_not_submitter` and does not add it to the review queue;
- accepts page correction/comment submissions at `/page-feedback` and appends accepted rows to private `page_feedback_queue.csv`;
- accepts an optional suggested paper photo with a page-feedback submission, validates it as a landscape JPEG/PNG/WebP image, and stores the original upload privately for editor review;
- lets editors optionally include the editor password with a page-feedback submission; a correct password writes the row as `approved_for_update`, while an empty or incorrect password is ignored and the row remains ordinary `pending` feedback;
- exposes a password-protected editor API at `/admin/page-feedback` for listing feedback rows and changing their status;
- exposes a lightweight password check at `/admin/page-feedback/auth` for the page-specific summary editor on `page-feedback.html`;
- exposes password-protected recent handled feedback at `/admin/page-feedback/history?hours=48`, sourced from `page_feedback_history.csv`;
- exposes a password-protected editor photo endpoint at `/admin/page-feedback/photo`;
- exposes a password-protected author-notice editor API at `/admin/author-notices` for listing queued author notice rows and marking selected rows as `ready_to_send`;
- keeps page feedback contact fields and submitter-role disclosure optional in effect; the role defaults to `other_or_prefer_not`;
- stores only a daily salted hash of the submitter IP, not the raw IP address;
- allows up to five paper-suggestion confirmation requests and five page-feedback submissions per source per Israel calendar day;
- writes the queues through the GitHub Contents API.

Paper suggestions require an email provider. Configure either `RESEND_API_KEY` for the Resend HTTP API, or `CONFIRMATION_EMAIL_WEBHOOK_URL` for a custom mail-sending webhook. Also set `CONFIRMATION_MAIL_FROM`; `CONFIRMATION_MAIL_REPLY_TO` and `CONFIRMATION_REPORT_TO` default to the Demokratia admin address when omitted. If no email provider is configured, the Worker rejects paper suggestions and does not write pending or active queue rows.

`suggest_confirmation_queue.csv` uses this header:

```csv
submitted_date,submitted_at,paper_name,doi,authors,submitter_name,submitter_email,submitter_ip_hash,token_hash,expires_at,status,email_sent_at,confirmed_at,reported_at,queue_added_at,notes
```

The raw confirmation token is never stored; only `token_hash` is stored. `status` is one of `awaiting_confirmation`, `email_failed`, `confirmed`, `reported_not_submitter`, or `expired`.

`suggest_queue.csv` uses this header:

```csv
submitted_date,submitted_at,paper_name,doi,submitter_name,submitter_email,submitter_ip_hash,status,notes,authors
```

The `doi` and `authors` fields are optional for paper suggestions; when a DOI is provided, the Worker validates that it looks like a DOI. Rows appear in `suggest_queue.csv` only after email confirmation.

`page_feedback_queue.csv` uses this header:

```csv
submitted_date,submitted_at,page_url,page_title,page_slug,paper_title,doi,comment,submitter_email,submitter_phone,submitter_ip_hash,status,editor_notes,applied_at,suggested_photo_path,suggested_photo_name,suggested_photo_type,suggested_photo_size,suggested_photo_width,suggested_photo_height,submitter_role
```

The unified heartbeat automation must run the feedback-revision phase every three hours. It applies rows that the editor has explicitly marked `approved_for_update`, leaves `pending` rows untouched, and removes rows still marked `rejected` as handled during the next processor run. Paper additions run only during the heartbeat's 00:05 Asia/Jerusalem pass.

When the heartbeat removes applied or rejected feedback rows from `page_feedback_queue.csv`, it must first append them to private `page_feedback_history.csv`. The history file uses this header:

```csv
submitted_date,submitted_at,page_url,page_title,page_slug,paper_title,doi,comment,submitter_email,submitter_phone,submitter_ip_hash,status,editor_notes,applied_at,suggested_photo_path,suggested_photo_name,suggested_photo_type,suggested_photo_size,suggested_photo_width,suggested_photo_height,submitter_role,processed_at,processing_notes
```

`processed_at` must contain the actual Israel-time processing timestamp, not just the scheduled run date.

`author_notice_queue.csv` uses this header:

```csv
created_at,updated_at,author_key,name_he,name_en,affiliation,email,email_source_url,paper_slug,paper_title_he,paper_title_en,paper_url,status,approved_at,sent_at,error,editor_notes
```

The editor API only changes notice-row status. It never sends email. The local sending script sends only rows marked `ready_to_send`, copies `demokratia@tau.ac.il`, sets `Reply-To: demokratia@tau.ac.il`, and appends delivery attempts to private `author_notice_history.csv`.

## Deploy

Copy `wrangler.toml.example` to `wrangler.toml`, then set secrets:

```sh
cd workers
wrangler secret put GITHUB_TOKEN
wrangler secret put IP_HASH_SECRET
wrangler secret put EDITOR_PASSWORD
wrangler secret put CONFIRMATION_TOKEN_SECRET
wrangler secret put RESEND_API_KEY
wrangler deploy
```

`GITHUB_TOKEN` needs permission to write repository contents. `CONFIRMATION_TOKEN_SECRET` signs paper-suggestion confirmation tokens. `RESEND_API_KEY` is used to send confirmation/report emails through Resend; alternatively set `CONFIRMATION_EMAIL_WEBHOOK_URL` and optional `CONFIRMATION_EMAIL_WEBHOOK_TOKEN` for a custom mailer. `EDITOR_PASSWORD` protects the editor API and enables optional editor approval from the page-feedback form; alternatively use `EDITOR_PASSWORD_SHA256` with the SHA-256 hex digest of the password. The page-feedback form never stores the submitted password. `FEEDBACK_PHOTO_DIR` defaults to `page_feedback_photos`, and `PAGE_FEEDBACK_PHOTO_MAX_BYTES` defaults to 8388608. After deployment, copy the Worker URL into `_data/site.json` as `suggestPaperEndpoint`, use the same URL plus `/page-feedback` as `pageFeedbackEndpoint`, use the same URL plus `/admin/page-feedback` as `feedbackEditorEndpoint`, and use the same URL plus `/admin/author-notices` as `authorNoticeEditorEndpoint`.

If this repository is public, remember that names, emails, phone numbers, and free-text comments committed to CSV files are visible in GitHub history even though the files are excluded from the built Jekyll site. For private handling of personal data, point `GITHUB_REPO`, `QUEUE_PATH`, and `FEEDBACK_QUEUE_PATH` at a private repository and adjust the nightly automation to read those private queues.
