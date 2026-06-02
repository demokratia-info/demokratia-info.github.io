#!/usr/bin/env python3
"""Prune visitor-submitted private data after the retention window.

Default mode is a dry run. Use --write from the heartbeat automation after
private repository access has been verified.
"""

from __future__ import annotations

import argparse
import csv
import os
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo


ISRAEL_TZ = ZoneInfo("Asia/Jerusalem")
DEFAULT_RETENTION_DAYS = 90
VISITOR_CSV_FILES = {
    "suggest_queue.csv": ("submitted_at", "submitted_date"),
    "suggest_confirmation_queue.csv": ("submitted_at", "submitted_date", "expires_at", "confirmed_at", "reported_at", "queue_added_at"),
    "page_feedback_queue.csv": ("submitted_at", "submitted_date", "applied_at"),
    "page_feedback_history.csv": ("submitted_at", "submitted_date", "processed_at", "applied_at"),
}


@dataclass
class CsvPruneResult:
    path: Path
    kept: int
    removed: int
    unparseable: int
    removed_photo_paths: set[str]


def parse_timestamp(value: str) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None

    if text.endswith("Z"):
        text = text[:-1] + "+00:00"

    for candidate in (text, text.replace(" ", "T")):
        try:
            parsed = datetime.fromisoformat(candidate)
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=ISRAEL_TZ)
            return parsed.astimezone(ISRAEL_TZ)
        except ValueError:
            pass

    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S%z", "%Y-%m-%d"):
        try:
            parsed = datetime.strptime(text, fmt)
            if parsed.tzinfo is None:
                return datetime.combine(parsed.date(), time.min, tzinfo=ISRAEL_TZ)
            return parsed.astimezone(ISRAEL_TZ)
        except ValueError:
            pass

    return None


def row_timestamp(row: dict[str, str], fields: tuple[str, ...]) -> datetime | None:
    for field in fields:
        parsed = parse_timestamp(row.get(field, ""))
        if parsed:
            return parsed
    return None


def read_csv_rows(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def write_csv_rows(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fieldnames})


def prune_csv(path: Path, fields: tuple[str, ...], cutoff: datetime, write: bool) -> CsvPruneResult:
    if not path.exists():
        return CsvPruneResult(path=path, kept=0, removed=0, unparseable=0, removed_photo_paths=set())

    fieldnames, rows = read_csv_rows(path)
    kept: list[dict[str, str]] = []
    removed_photo_paths: set[str] = set()
    unparseable = 0
    removed = 0

    for row in rows:
        timestamp = row_timestamp(row, fields)
        if timestamp is None:
            kept.append(row)
            unparseable += 1
            continue
        if timestamp < cutoff:
            removed += 1
            photo_path = row.get("suggested_photo_path", "").strip()
            if photo_path:
                removed_photo_paths.add(photo_path)
            continue
        kept.append(row)

    if write and removed:
        write_csv_rows(path, fieldnames, kept)

    return CsvPruneResult(
        path=path,
        kept=len(kept),
        removed=removed,
        unparseable=unparseable,
        removed_photo_paths=removed_photo_paths,
    )


def photo_timestamp(path: Path) -> datetime | None:
    for part in path.parts:
        if len(part) == 10 and part[4] == "-" and part[7] == "-":
            try:
                parsed_date = date.fromisoformat(part)
                return datetime.combine(parsed_date, time.min, tzinfo=ISRAEL_TZ)
            except ValueError:
                pass

    try:
        return datetime.fromtimestamp(path.stat().st_mtime, tz=ISRAEL_TZ)
    except OSError:
        return None


def safe_private_photo_path(private_dir: Path, relative_path: str) -> Path | None:
    text = str(relative_path or "").strip()
    if not text or text.startswith("/") or ".." in Path(text).parts:
        return None
    path = (private_dir / text).resolve()
    try:
        path.relative_to(private_dir.resolve())
    except ValueError:
        return None
    if "page_feedback_photos" not in path.parts:
        return None
    return path


def prune_photos(
    private_dir: Path,
    removed_photo_paths: set[str],
    cutoff: datetime,
    write: bool,
) -> tuple[int, int]:
    candidates: set[Path] = set()
    photo_root = private_dir / "page_feedback_photos"

    for relative_path in removed_photo_paths:
        path = safe_private_photo_path(private_dir, relative_path)
        if path:
            candidates.add(path)

    if photo_root.exists():
        for path in photo_root.rglob("*"):
            if not path.is_file():
                continue
            timestamp = photo_timestamp(path)
            if timestamp and timestamp < cutoff:
                candidates.add(path)

    existing = [path for path in sorted(candidates) if path.exists() and path.is_file()]
    if write:
        for path in existing:
            path.unlink()
        remove_empty_dirs(photo_root)

    return len(existing), len(candidates) - len(existing)


def remove_empty_dirs(root: Path) -> None:
    if not root.exists():
        return
    for path in sorted((p for p in root.rglob("*") if p.is_dir()), reverse=True):
        try:
            path.rmdir()
        except OSError:
            pass
    try:
        root.rmdir()
    except OSError:
        pass


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--private-dir", type=Path, default=Path("../democracy-paper-suggestions-private"))
    parser.add_argument("--retention-days", type=int, default=DEFAULT_RETENTION_DAYS)
    parser.add_argument("--write", action="store_true", help="Actually delete old rows/photos. Default is dry-run.")
    parser.add_argument("--dry-run", action="store_true", help="Preview pruning without writing. This is the default.")
    args = parser.parse_args()

    private_dir = args.private_dir.resolve()
    if args.retention_days <= 0:
        raise SystemExit("--retention-days must be positive")
    if not private_dir.exists():
        raise SystemExit(f"Private directory not found: {private_dir}")

    now = datetime.now(ISRAEL_TZ)
    cutoff = now - timedelta(days=args.retention_days)
    all_removed_photo_paths: set[str] = set()
    results: list[CsvPruneResult] = []

    for filename, fields in VISITOR_CSV_FILES.items():
        result = prune_csv(private_dir / filename, fields, cutoff, args.write)
        results.append(result)
        all_removed_photo_paths.update(result.removed_photo_paths)

    photos_removed, photos_missing = prune_photos(private_dir, all_removed_photo_paths, cutoff, args.write)

    print(f"{'WRITE' if args.write else 'DRY-RUN'} private visitor data retention cleanup")
    print(f"Private directory: {private_dir}")
    print(f"Retention days: {args.retention_days}")
    print(f"Cutoff: {cutoff.isoformat()}")
    for result in results:
        print(
            f"{result.path.name}: removed={result.removed} kept={result.kept} "
            f"unparseable_kept={result.unparseable}"
        )
    print(f"page_feedback_photos: removed={photos_removed} missing_referenced={photos_missing}")

    if not args.write:
        print("Dry run only; no files changed.")


if __name__ == "__main__":
    main()
