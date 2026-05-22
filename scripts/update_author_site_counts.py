#!/usr/bin/env python3
"""Update the private Authors.MD Current Site Papers column.

The script intentionally accepts the private Authors.MD path as an argument so the
private file never needs to be copied into this public repository.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path


TITLE_PREFIXES = re.compile(r"^(prof\.?|dr\.?|adv\.?|mr\.?|ms\.?|mrs\.?)\s+", re.I)
AUTHOR_ROW = re.compile(r"^\|\s*(high|normal|low|blocked)\s*\|")
COLUMN_NAME = "Current Site Papers"


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


def split_md_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def format_md_row(cells: list[str]) -> str:
    return "| " + " | ".join(cells) + " |"


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


def update_authors_table(authors_path: Path, counts: Counter[str]) -> dict[str, int | bool]:
    lines = authors_path.read_text(encoding="utf-8").splitlines()
    output: list[str] = []
    author_rows = 0
    changed_count_cells = 0
    nonzero_rows = 0
    inserted_column = False

    for line in lines:
        if line.startswith("| Priority |"):
            cells = split_md_row(line)
            if COLUMN_NAME not in cells:
                cells.insert(6, COLUMN_NAME)
                inserted_column = True
            output.append(format_md_row(cells))
            continue

        if line.startswith("| --- |"):
            cells = split_md_row(line)
            if len(cells) == 7:
                cells.insert(6, "---")
            output.append(format_md_row(cells))
            continue

        if AUTHOR_ROW.match(line):
            cells = split_md_row(line)
            if len(cells) == 7:
                cells.insert(6, "")
            if len(cells) != 8:
                raise SystemExit(f"Unexpected Authors.MD table row width {len(cells)}: {line[:180]}")

            count = counts.get(normalize_name(cells[2]), 0) if cells[2] else 0
            if cells[6] != str(count):
                changed_count_cells += 1
            cells[6] = str(count)
            author_rows += 1
            if count:
                nonzero_rows += 1
            output.append(format_md_row(cells))
            continue

        output.append(line)

    authors_path.write_text("\n".join(output) + "\n", encoding="utf-8")
    return {
        "author_rows": author_rows,
        "changed_count_cells": changed_count_cells,
        "rows_with_nonzero_count": nonzero_rows,
        "inserted_column": inserted_column,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("authors_md", type=Path, help="Path to private Authors.MD")
    parser.add_argument("--papers-dir", type=Path, default=Path("_papers"))
    args = parser.parse_args()

    counts = collect_public_author_counts(args.papers_dir)
    stats = update_authors_table(args.authors_md, counts)
    stats["public_papers"] = len(list(args.papers_dir.glob("*.md")))
    stats["unique_public_author_names"] = len(counts)
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
