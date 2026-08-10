#!/usr/bin/env python3
"""Update the private Authors.csv Current Site Papers column.

The script intentionally accepts the private Authors.csv path as an argument so the
private file never needs to be copied into this public repository.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path


TITLE_PREFIXES = re.compile(r"^(prof\.?|dr\.?|adv\.?|mr\.?|ms\.?|mrs\.?)\s+", re.I)
COLUMN_NAME = "Current Site Papers"
NAME_COLUMN = "Name in English"
NOTES_COLUMN = "Notes and Search Terms"


def normalize_name(value: str) -> str:
    text = unicodedata.normalize("NFKC", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) not in {"Cf", "Mn"})
    text = text.replace("’", "'").replace("‘", "'").replace("`", "'")
    text = "".join("-" if unicodedata.category(ch) == "Pd" else ch for ch in text)
    text = re.sub(r"\s+", " ", text).strip()
    text = TITLE_PREFIXES.sub("", text)
    text = text.casefold()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^\w\s'-]", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


def collect_public_author_counts(papers_dir: Path) -> Counter[str]:
    counts: Counter[str] = Counter()
    for path in sorted(papers_dir.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        try:
            data = json.loads(text.split("---", 2)[1])
        except (IndexError, json.JSONDecodeError) as exc:
            raise SystemExit(f"Could not parse {path}: {exc}") from exc

        names: set[str] = set()
        for item in data.get("sourceAuthors") or data.get("authors") or []:
            name = item.get("name") if isinstance(item, dict) else item
            normalized = normalize_name(str(name or ""))
            if normalized:
                names.add(normalized)
        counts.update(names)
    return counts


def with_count_column(fieldnames: list[str]) -> tuple[list[str], bool]:
    if COLUMN_NAME in fieldnames:
        return fieldnames, False

    updated = list(fieldnames)
    if NOTES_COLUMN in updated:
        updated.insert(updated.index(NOTES_COLUMN), COLUMN_NAME)
    else:
        updated.append(COLUMN_NAME)
    return updated, True


def update_authors_csv(authors_path: Path, counts: Counter[str]) -> dict[str, int | bool]:
    with authors_path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            raise SystemExit(f"{authors_path} is empty or missing a CSV header")

        original_fieldnames = list(reader.fieldnames)
        if NAME_COLUMN not in original_fieldnames:
            raise SystemExit(f"{authors_path} is missing required column: {NAME_COLUMN}")

        fieldnames, inserted_column = with_count_column(original_fieldnames)
        rows = list(reader)

    changed_count_cells = 0
    nonzero_rows = 0

    for row in rows:
        name = row.get(NAME_COLUMN, "")
        count = counts.get(normalize_name(name), 0) if name else 0
        if str(row.get(COLUMN_NAME, "")) != str(count):
            changed_count_cells += 1
        row[COLUMN_NAME] = str(count)
        if count:
            nonzero_rows += 1

    with authors_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    return {
        "author_rows": len(rows),
        "changed_count_cells": changed_count_cells,
        "rows_with_nonzero_count": nonzero_rows,
        "inserted_column": inserted_column,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("authors_csv", type=Path, help="Path to private Authors.csv")
    parser.add_argument("--papers-dir", type=Path, default=Path("_papers"))
    args = parser.parse_args()

    counts = collect_public_author_counts(args.papers_dir)
    stats = update_authors_csv(args.authors_csv, counts)
    stats["public_papers"] = len(list(args.papers_dir.glob("*.md")))
    stats["unique_public_author_names"] = len(counts)
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
