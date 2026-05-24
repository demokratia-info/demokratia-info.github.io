#!/usr/bin/env python3
"""Shared helpers for private author-notice CSV workflows."""

from __future__ import annotations

import csv
import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin
from zoneinfo import ZoneInfo


ISRAEL_TZ = ZoneInfo("Asia/Jerusalem")

AUTHOR_NOTICE_COLUMNS = [
    "Email Verified",
    "Email Source URL",
    "Email Last Checked At",
    "Contact Status",
    "Author Notice Pending",
    "Last Author Notice Sent At",
    "Last Author Notice Paper Slugs",
    "Last Author Notice Error",
]

AUTHOR_NOTICE_QUEUE_HEADER = [
    "created_at",
    "updated_at",
    "author_key",
    "name_he",
    "name_en",
    "affiliation",
    "email",
    "email_source_url",
    "paper_slug",
    "paper_title_he",
    "paper_title_en",
    "paper_url",
    "status",
    "approved_at",
    "sent_at",
    "error",
    "editor_notes",
]

AUTHOR_NOTICE_HISTORY_HEADER = [
    *AUTHOR_NOTICE_QUEUE_HEADER,
    "processed_at",
    "action",
    "message_id",
]

READY_STATUS = "ready_to_send"
PENDING_STATUS = "pending_editor_release"
SENT_STATUS = "sent"
FAILED_STATUS = "failed"
SKIPPED_STATUS = "skipped"
BLOCKED_STATUS = "blocked"

SENDABLE_STATUSES = {READY_STATUS}
ACTIVE_STATUSES = {PENDING_STATUS, READY_STATUS, FAILED_STATUS}
BLOCKING_CONTACT_STATUSES = {"blocked", "do_not_contact", "removal_requested", "bounced"}

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
TITLE_PREFIXES = re.compile(r"^(prof\.?|dr\.?|adv\.?|mr\.?|ms\.?|mrs\.?)\s+", re.I)
URL_PATTERN = re.compile(r"https?://[^\s,;)\]]+")


def now_israel() -> str:
    return datetime.now(ISRAEL_TZ).strftime("%Y-%m-%dT%H:%M:%S%z")


def israel_date() -> str:
    return datetime.now(ISRAEL_TZ).strftime("%Y-%m-%d")


def normalize_name(value: str) -> str:
    text = unicodedata.normalize("NFKC", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) not in {"Cf", "Mn"})
    text = text.replace("’", "'").replace("‘", "'").replace("`", "'")
    text = re.sub(r"\s+", " ", text).strip()
    text = TITLE_PREFIXES.sub("", text)
    text = text.casefold()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^\w\s'-]", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


def valid_email(value: str) -> bool:
    return bool(EMAIL_PATTERN.match(str(value or "").strip()))


def author_key(row: dict[str, str]) -> str:
    return normalize_name(row.get("Name in English") or row.get("Name in Hebrew") or "")


def is_blocked_author(row: dict[str, str]) -> bool:
    priority = (row.get("Priority") or "").strip().casefold()
    contact_status = (row.get("Contact Status") or "").strip().casefold()
    return priority == "blocked" or contact_status in BLOCKING_CONTACT_STATUSES


def first_url(value: str) -> str:
    match = URL_PATTERN.search(value or "")
    return match.group(0).rstrip(".") if match else ""


def read_csv_dicts(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            raise SystemExit(f"{path} is empty or missing a CSV header")
        return list(reader.fieldnames), list(reader)


def write_csv_dicts(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def with_columns(fieldnames: list[str], extra_columns: list[str]) -> tuple[list[str], bool]:
    updated = list(fieldnames)
    changed = False
    for column in extra_columns:
        if column not in updated:
            updated.append(column)
            changed = True
    return updated, changed


def ensure_row_columns(rows: list[dict[str, str]], fieldnames: list[str]) -> None:
    for row in rows:
        for column in fieldnames:
            row.setdefault(column, "")


def read_or_create_csv(path: Path, header: list[str]) -> tuple[list[str], list[dict[str, str]]]:
    if not path.exists():
        return list(header), []
    fieldnames, rows = read_csv_dicts(path)
    fieldnames, _ = with_columns(fieldnames, header)
    ensure_row_columns(rows, fieldnames)
    return fieldnames, rows


def load_site_base_url(site_json: Path) -> str:
    data = json.loads(site_json.read_text(encoding="utf-8"))
    return str(data.get("baseUrl") or "https://demokratia-info.github.io/").rstrip("/") + "/"


def load_public_papers(papers_dir: Path, base_url: str) -> dict[str, list[dict[str, str]]]:
    by_author: dict[str, list[dict[str, str]]] = {}
    for path in sorted(papers_dir.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        try:
            data = json.loads(text.split("---", 2)[1])
        except (IndexError, json.JSONDecodeError) as exc:
            raise SystemExit(f"Could not parse {path}: {exc}") from exc

        slug = str(data.get("slug") or path.stem)
        permalink = str(data.get("permalink") or data.get("file") or f"{slug}.html").lstrip("/")
        paper = {
            "paper_slug": slug,
            "paper_title_he": str(data.get("titleHe") or data.get("title") or ""),
            "paper_title_en": str(data.get("paperTitle") or data.get("title") or ""),
            "paper_url": urljoin(base_url, permalink),
        }
        names = set()
        for item in data.get("sourceAuthors") or data.get("authors") or []:
            name = item.get("name") if isinstance(item, dict) else item
            normalized = normalize_name(str(name or ""))
            if normalized:
                names.add(normalized)
        for normalized in names:
            by_author.setdefault(normalized, []).append(paper)
    return by_author


def row_identity(row: dict[str, str]) -> tuple[str, str]:
    return (row.get("author_key", ""), row.get("paper_slug", ""))
