#!/usr/bin/env python3
"""Send editor-approved author notices through Gmail SMTP.

Default mode is a dry run. Use --send only after configuring credentials in the
local environment or in a private .env file outside this public repository.
"""

from __future__ import annotations

import argparse
import os
import smtplib
import ssl
import time
from collections import defaultdict
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from pathlib import Path

from author_notice_common import (
    AUTHOR_NOTICE_HISTORY_HEADER,
    AUTHOR_NOTICE_QUEUE_HEADER,
    FAILED_STATUS,
    READY_STATUS,
    SENT_STATUS,
    author_key,
    ensure_row_columns,
    now_israel,
    read_csv_dicts,
    read_or_create_csv,
    row_identity,
    valid_email,
    with_columns,
    write_csv_dicts,
)


DEFAULT_REPLY_TO = "demokratia@tau.ac.il"
DEFAULT_CC = "demokratia@tau.ac.il"


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text or text.startswith("#") or "=" not in text:
            continue
        key, value = text.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        os.environ.setdefault(key, value)


def env(name: str, fallback: str = "") -> str:
    return os.environ.get(name, fallback).strip()


def mail_settings() -> dict[str, str | int]:
    smtp_user = env("AUTHOR_NOTICE_SMTP_USER")
    return {
        "host": env("AUTHOR_NOTICE_SMTP_HOST", "smtp.gmail.com"),
        "port": int(env("AUTHOR_NOTICE_SMTP_PORT", "587")),
        "user": smtp_user,
        "password": env("AUTHOR_NOTICE_SMTP_PASSWORD"),
        "from": env("AUTHOR_NOTICE_MAIL_FROM", formataddr(("Demokratia", smtp_user)) if smtp_user else ""),
        "reply_to": env("AUTHOR_NOTICE_REPLY_TO", DEFAULT_REPLY_TO),
        "cc": env("AUTHOR_NOTICE_CC", DEFAULT_CC),
    }


def require_send_settings(settings: dict[str, str | int]) -> None:
    missing = [
        name
        for name in ("user", "password", "from", "reply_to")
        if not settings.get(name)
    ]
    if missing:
        joined = ", ".join(f"AUTHOR_NOTICE_{name.upper()}" for name in missing)
        raise SystemExit(f"Missing mail configuration: {joined}")


def grouped_ready_rows(rows: list[dict[str, str]]) -> list[list[dict[str, str]]]:
    groups: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        if row.get("status") != READY_STATUS:
            continue
        email = (row.get("email") or "").strip().lower()
        if not valid_email(email):
            row["status"] = FAILED_STATUS
            row["error"] = "invalid_or_missing_email"
            continue
        groups[(row.get("author_key", ""), email)].append(row)
    return [groups[key] for key in sorted(groups)]


def author_display_name(rows: list[dict[str, str]]) -> str:
    first = rows[0]
    return first.get("name_en") or first.get("name_he") or "Professor"


def paper_lines(rows: list[dict[str, str]], hebrew: bool) -> list[str]:
    lines = []
    for index, row in enumerate(rows, 1):
        title = row.get("paper_title_he") if hebrew else row.get("paper_title_en")
        title = title or row.get("paper_title_en") or row.get("paper_title_he") or row.get("paper_slug")
        lines.append(f"{index}. {title}\n   {row.get('paper_url', '')}")
    return lines


def compose_body(rows: list[dict[str, str]]) -> str:
    name = author_display_name(rows)
    hebrew_papers = "\n".join(paper_lines(rows, hebrew=True))
    english_papers = "\n".join(paper_lines(rows, hebrew=False))

    return f"""שלום {name},

באתר "הנגשת מידע בנושאי דמוקרטיה" פרסמנו תמצית/תמציות בעברית של מאמר/ים אקדמיים שלך:

{hebrew_papers}

נשמח מאוד לקבל הערות או תיקונים. אם יש בתמצית טעות, חוסר דיוק, ניסוח מטעה, או נקודה חשובה שכדאי להוסיף, אפשר להשיב להודעה זו או לכתוב אל demokratia@tau.ac.il.

אם אינך מעוניין/ת שהתמצית תופיע באתר, אפשר להודיע לנו ונפעל להסיר אותה במהירות.

בתודה,
צוות אתר Demokratia

---

Dear {name},

We published Hebrew summary page(s) for your academic paper(s) on the Demokratia website:

{english_papers}

We would be grateful for any comments or corrections. If the summary contains an error, an inaccuracy, a misleading formulation, or an important point that should be added, please reply to this message or write to demokratia@tau.ac.il.

If you prefer that the summary be removed from the website, please let us know and we will remove it promptly.

Thank you,
The Demokratia website team
"""


def compose_message(rows: list[dict[str, str]], settings: dict[str, str | int]) -> EmailMessage:
    recipient = rows[0]["email"].strip().lower()
    message = EmailMessage()
    message["Subject"] = "תמציות מאמריך באתר Demokratia / Your paper summaries on Demokratia"
    message["From"] = str(settings["from"])
    message["To"] = recipient
    if settings.get("cc"):
        message["Cc"] = str(settings["cc"])
    message["Reply-To"] = str(settings["reply_to"])
    message["Message-ID"] = make_msgid(domain="demokratia-info.github.io")
    message.set_content(compose_body(rows))
    return message


def send_message(message: EmailMessage, settings: dict[str, str | int]) -> None:
    context = ssl.create_default_context()
    with smtplib.SMTP(str(settings["host"]), int(settings["port"]), timeout=30) as smtp:
        smtp.ehlo()
        smtp.starttls(context=context)
        smtp.ehlo()
        smtp.login(str(settings["user"]), str(settings["password"]))
        smtp.send_message(message)


def append_history(
    history_rows: list[dict[str, str]],
    rows: list[dict[str, str]],
    processed_at: str,
    action: str,
    message_id: str,
) -> None:
    for row in rows:
        history = {column: row.get(column, "") for column in AUTHOR_NOTICE_QUEUE_HEADER}
        history["processed_at"] = processed_at
        history["action"] = action
        history["message_id"] = message_id
        history_rows.append(history)


def update_authors_after_send(
    authors: list[dict[str, str]],
    rows: list[dict[str, str]],
    sent_at: str,
    error: str = "",
) -> None:
    key = rows[0].get("author_key", "")
    slugs = sorted({row.get("paper_slug", "") for row in rows if row.get("paper_slug")})
    for author in authors:
        if author_key(author) != key:
            continue
        if error:
            author["Last Author Notice Error"] = error
        else:
            author["Author Notice Pending"] = "0"
            author["Last Author Notice Sent At"] = sent_at
            author["Last Author Notice Paper Slugs"] = ";".join(slugs)
            author["Last Author Notice Error"] = ""
        return


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--private-dir", type=Path, default=Path("../democracy-paper-suggestions-private"))
    parser.add_argument("--env-file", type=Path, default=Path.home() / ".demokratia_author_mail.env")
    parser.add_argument("--send", action="store_true", help="Actually send email. Default is dry-run.")
    parser.add_argument("--dry-run", action="store_true", help="Preview ready rows without sending. This is the default.")
    parser.add_argument("--max-authors", type=int, default=int(env("AUTHOR_NOTICE_MAX_AUTHORS", "10") or "10"))
    parser.add_argument("--pause-seconds", type=float, default=float(env("AUTHOR_NOTICE_PAUSE_SECONDS", "3") or "3"))
    parser.add_argument("--only-author", default="", help="Optional normalized/name substring filter for testing.")
    args = parser.parse_args()

    load_env_file(args.env_file)
    settings = mail_settings()
    if args.send:
        require_send_settings(settings)

    authors_path = args.private_dir / "Authors.csv"
    queue_path = args.private_dir / "author_notice_queue.csv"
    history_path = args.private_dir / "author_notice_history.csv"

    author_fields, authors = read_csv_dicts(authors_path)
    author_fields, _ = with_columns(author_fields, [
        "Author Notice Pending",
        "Last Author Notice Sent At",
        "Last Author Notice Paper Slugs",
        "Last Author Notice Error",
    ])
    ensure_row_columns(authors, author_fields)

    queue_fields, queue_rows = read_or_create_csv(queue_path, AUTHOR_NOTICE_QUEUE_HEADER)
    history_fields, history_rows = read_or_create_csv(history_path, AUTHOR_NOTICE_HISTORY_HEADER)
    ensure_row_columns(queue_rows, queue_fields)
    ensure_row_columns(history_rows, history_fields)

    groups = grouped_ready_rows(queue_rows)
    if args.only_author:
      needle = args.only_author.casefold()
      groups = [
          rows for rows in groups
          if needle in (rows[0].get("name_en", "") + " " + rows[0].get("name_he", "") + " " + rows[0].get("author_key", "")).casefold()
      ]
    groups = groups[: max(0, args.max_authors)]

    if not groups:
        print("No ready_to_send author notice rows found.")
        return

    sent_identities: set[tuple[str, str]] = set()
    failed = 0
    sent = 0

    for rows in groups:
        message = compose_message(rows, settings)
        print(f"{'SEND' if args.send else 'DRY-RUN'} {message['To']} ({len(rows)} paper(s))")
        print(f"  From: {message['From']}")
        print(f"  Reply-To: {message['Reply-To']}")
        print(f"  Cc: {message.get('Cc', '')}")
        print(f"  Subject: {message['Subject']}")

        processed_at = now_israel()
        message_id = str(message["Message-ID"])
        if args.send:
            try:
                send_message(message, settings)
            except Exception as exc:  # noqa: BLE001 - preserve SMTP failure text for local operator.
                failed += 1
                error = str(exc).replace("\n", " ")[:500]
                for row in rows:
                    row["status"] = FAILED_STATUS
                    row["error"] = error
                    row["updated_at"] = processed_at
                append_history(history_rows, rows, processed_at, "send_failed", message_id)
                update_authors_after_send(authors, rows, processed_at, error)
                print(f"  FAILED: {error}")
                continue

            sent += 1
            for row in rows:
                row["status"] = SENT_STATUS
                row["sent_at"] = processed_at
                row["updated_at"] = processed_at
                row["error"] = ""
                sent_identities.add(row_identity(row))
            append_history(history_rows, rows, processed_at, "sent", message_id)
            update_authors_after_send(authors, rows, processed_at)
            if args.pause_seconds > 0:
                time.sleep(args.pause_seconds)

    if args.send:
        remaining_queue_rows = [
            row for row in queue_rows
            if row_identity(row) not in sent_identities
        ]
        write_csv_dicts(authors_path, author_fields, authors)
        write_csv_dicts(queue_path, queue_fields, remaining_queue_rows)
        write_csv_dicts(history_path, history_fields, history_rows)

    print({"sent_author_groups": sent, "failed_author_groups": failed, "dry_run": not args.send})


if __name__ == "__main__":
    main()
