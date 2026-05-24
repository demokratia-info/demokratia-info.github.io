#!/usr/bin/env python3
"""Prepare the private author-notice queue without sending email."""

from __future__ import annotations

import argparse
from pathlib import Path

from author_notice_common import (
    ACTIVE_STATUSES,
    AUTHOR_NOTICE_COLUMNS,
    AUTHOR_NOTICE_HISTORY_HEADER,
    AUTHOR_NOTICE_QUEUE_HEADER,
    BLOCKED_STATUS,
    PENDING_STATUS,
    author_key,
    ensure_row_columns,
    first_url,
    is_blocked_author,
    israel_date,
    load_public_papers,
    load_site_base_url,
    now_israel,
    read_csv_dicts,
    read_or_create_csv,
    row_identity,
    valid_email,
    with_columns,
    write_csv_dicts,
)


def truthy(value: str) -> bool:
    return str(value or "").strip().casefold() in {"1", "true", "yes", "y"}


def current_paper_count(row: dict[str, str]) -> int:
    try:
        return int(str(row.get("Current Site Papers") or "0").strip() or "0")
    except ValueError:
        return 0


def author_is_queueable(row: dict[str, str]) -> bool:
    if is_blocked_author(row):
        return False
    if not valid_email(row.get("Email", "")):
        return False
    if current_paper_count(row) <= 0:
        return False
    source = row.get("Email Source URL") or first_url(row.get("Notes and Search Terms", ""))
    return bool(source)


def update_author_notice_columns(rows: list[dict[str, str]]) -> int:
    changed = 0
    today = israel_date()
    for row in rows:
        before = dict(row)
        if is_blocked_author(row):
            row["Contact Status"] = "blocked"
            row["Author Notice Pending"] = "0"
        elif valid_email(row.get("Email", "")):
            if not row.get("Email Source URL"):
                row["Email Source URL"] = first_url(row.get("Notes and Search Terms", ""))
            if row.get("Email Source URL"):
                row["Email Verified"] = row.get("Email Verified") or "yes"
                row["Email Last Checked At"] = row.get("Email Last Checked At") or today
                row["Contact Status"] = row.get("Contact Status") or "ok"
            else:
                row["Email Verified"] = row.get("Email Verified") or "needs_source"
                row["Contact Status"] = row.get("Contact Status") or "email_unverified"
        elif row.get("Email"):
            row["Email Verified"] = "invalid"
            row["Contact Status"] = row.get("Contact Status") or "email_unverified"
        else:
            row["Contact Status"] = row.get("Contact Status") or ""

        if author_is_queueable(row):
            row["Author Notice Pending"] = row.get("Author Notice Pending") or "1"
        elif not truthy(row.get("Author Notice Pending", "")):
            row["Author Notice Pending"] = row.get("Author Notice Pending") or "0"

        if row != before:
            changed += 1
    return changed


def queue_rows_for_author(
    author: dict[str, str],
    papers: list[dict[str, str]],
    existing_by_identity: dict[tuple[str, str], dict[str, str]],
    created_at: str,
) -> tuple[list[dict[str, str]], int]:
    key = author_key(author)
    rows: list[dict[str, str]] = []
    added = 0

    for paper in papers:
        identity = (key, paper["paper_slug"])
        existing = existing_by_identity.get(identity)
        if existing:
            continue

        row = {
            "created_at": created_at,
            "updated_at": created_at,
            "author_key": key,
            "name_he": author.get("Name in Hebrew", ""),
            "name_en": author.get("Name in English", ""),
            "affiliation": author.get("Affiliation", ""),
            "email": author.get("Email", "").strip().lower(),
            "email_source_url": author.get("Email Source URL") or first_url(author.get("Notes and Search Terms", "")),
            "paper_slug": paper["paper_slug"],
            "paper_title_he": paper["paper_title_he"],
            "paper_title_en": paper["paper_title_en"],
            "paper_url": paper["paper_url"],
            "status": PENDING_STATUS,
            "approved_at": "",
            "sent_at": "",
            "error": "",
            "editor_notes": "",
        }
        rows.append(row)
        existing_by_identity[identity] = row
        added += 1
    return rows, added


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--private-dir",
        type=Path,
        default=Path("../democracy-paper-suggestions-private"),
        help="Path to the private operational repository.",
    )
    parser.add_argument("--authors-csv", default="Authors.csv")
    parser.add_argument("--queue-csv", default="author_notice_queue.csv")
    parser.add_argument("--history-csv", default="author_notice_history.csv")
    parser.add_argument("--papers-dir", type=Path, default=Path("_papers"))
    parser.add_argument("--site-json", type=Path, default=Path("_data/site.json"))
    parser.add_argument(
        "--include-all-existing",
        action="store_true",
        help="Queue all current non-blocked authors with reliable email and site papers.",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Write the private Authors.csv and author_notice_queue.csv files.",
    )
    args = parser.parse_args()

    private_dir = args.private_dir
    authors_path = private_dir / args.authors_csv
    queue_path = private_dir / args.queue_csv
    history_path = private_dir / args.history_csv

    author_fields, author_rows = read_csv_dicts(authors_path)
    author_fields, inserted_author_columns = with_columns(author_fields, AUTHOR_NOTICE_COLUMNS)
    ensure_row_columns(author_rows, author_fields)

    updated_author_rows = update_author_notice_columns(author_rows)

    queue_fields, queue_rows = read_or_create_csv(queue_path, AUTHOR_NOTICE_QUEUE_HEADER)
    queue_fields, _ = with_columns(queue_fields, AUTHOR_NOTICE_QUEUE_HEADER)
    ensure_row_columns(queue_rows, queue_fields)
    history_fields, history_rows = read_or_create_csv(history_path, AUTHOR_NOTICE_HISTORY_HEADER)

    base_url = load_site_base_url(args.site_json)
    public_papers_by_author = load_public_papers(args.papers_dir, base_url)
    existing_by_identity = {
        row_identity(row): row
        for row in queue_rows
        if row.get("author_key") and row.get("paper_slug")
    }
    for row in history_rows:
        identity = row_identity(row)
        if identity[0] and identity[1]:
            existing_by_identity.setdefault(identity, row)

    created_at = now_israel()
    added_rows: list[dict[str, str]] = []
    queueable_authors = 0
    blocked_with_email = 0

    for author in author_rows:
        key = author_key(author)
        if not key:
            continue
        if is_blocked_author(author) and author.get("Email"):
            blocked_with_email += 1
            for paper in public_papers_by_author.get(key, []):
                identity = (key, paper["paper_slug"])
                if identity not in existing_by_identity:
                    blocked_row = {
                        "created_at": created_at,
                        "updated_at": created_at,
                        "author_key": key,
                        "name_he": author.get("Name in Hebrew", ""),
                        "name_en": author.get("Name in English", ""),
                        "affiliation": author.get("Affiliation", ""),
                        "email": author.get("Email", "").strip().lower(),
                        "email_source_url": author.get("Email Source URL") or first_url(author.get("Notes and Search Terms", "")),
                        "paper_slug": paper["paper_slug"],
                        "paper_title_he": paper["paper_title_he"],
                        "paper_title_en": paper["paper_title_en"],
                        "paper_url": paper["paper_url"],
                        "status": BLOCKED_STATUS,
                        "approved_at": "",
                        "sent_at": "",
                        "error": "",
                        "editor_notes": "blocked_author_never_email",
                    }
                    added_rows.append(blocked_row)
                    existing_by_identity[identity] = blocked_row
            continue

        papers = public_papers_by_author.get(key, [])
        if not papers:
            continue
        if not author_is_queueable(author):
            continue
        queueable_authors += 1
        if args.include_all_existing or truthy(author.get("Author Notice Pending", "")):
            rows, added_for_author = queue_rows_for_author(author, papers, existing_by_identity, created_at)
            added_rows.extend(rows)
            if added_for_author:
                author["Author Notice Pending"] = "1"

    next_queue_rows = queue_rows + added_rows

    print(
        {
            "authors": len(author_rows),
            "inserted_author_columns": inserted_author_columns,
            "updated_author_rows": updated_author_rows,
            "queueable_authors_with_site_papers": queueable_authors,
            "blocked_authors_with_email": blocked_with_email,
            "existing_queue_rows": len(queue_rows),
            "added_queue_rows": len(added_rows),
            "next_queue_rows": len(next_queue_rows),
            "write": args.write,
        }
    )

    if not args.write:
        return

    write_csv_dicts(authors_path, author_fields, author_rows)
    write_csv_dicts(queue_path, queue_fields, next_queue_rows)
    if not history_path.exists():
        write_csv_dicts(history_path, history_fields, history_rows)


if __name__ == "__main__":
    main()
