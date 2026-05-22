#!/usr/bin/env python3
"""Validate Jekyll source data and maintain the compact paper index."""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
PAPERS_DIR = ROOT / "_papers"
DATA_DIR = ROOT / "_data"
PAPER_INDEX_PATH = DATA_DIR / "paper_index.json"
PAPER_QUEUE_PATH = ROOT / "paper_queue.csv"
SUGGEST_QUEUE_PATH = ROOT / "suggest_queue.csv"
ARTICLE_IMAGE_SIZE = (800, 600)
MAX_TOPIC_IMAGE_RUN = 2
MIN_SECTION_SENTENCES = 2
QUEUE_REQUIRED_COLUMNS = ("paper_name", "authors", "doi", "topic")
SUGGEST_QUEUE_REQUIRED_COLUMNS = (
    "submitted_date",
    "submitted_at",
    "paper_name",
    "doi",
    "submitter_name",
    "submitter_email",
    "submitter_ip_hash",
    "status",
    "notes",
)

REQUIRED_PAPER_KEYS = {
    "layout",
    "title",
    "titleHe",
    "descriptionHe",
    "summaryHe",
    "authorsCardHe",
    "authorsHtml",
    "paperTitle",
    "sourceAuthors",
    "topics",
    "keywords",
    "image",
    "datePublished",
    "dateModified",
    "lastUpdatedHe",
    "oneLinerHtml",
    "sections",
    "slug",
    "file",
    "permalink",
    "paper_url",
    "sortKey",
}


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, dict[str, str]]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        attr_map = {key.lower(): (value or "") for key, value in attrs}
        href = attr_map.get("href", "")
        if href:
            self.links.append((href, attr_map))


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001 - validation should report path context
        raise ValueError(f"{path.relative_to(ROOT)} is not valid JSON: {exc}") from exc


def load_paper(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError(f"{path.relative_to(ROOT)} is missing opening front matter marker")
    end = text.find("\n---", 4)
    if end == -1:
        raise ValueError(f"{path.relative_to(ROOT)} is missing closing front matter marker")
    try:
        data = json.loads(text[4:end])
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"{path.relative_to(ROOT)} front matter is not valid JSON: {exc}") from exc
    data["_sourcePath"] = path
    return data


def clean_local_ref(ref: str) -> Path | None:
    if not ref or re.match(r"^[a-z][a-z0-9+.-]*:", ref, flags=re.I):
        return None
    clean = ref.split("#", 1)[0].split("?", 1)[0].lstrip("/")
    if not clean:
        return None
    return ROOT / clean


def jpeg_dimensions(path: Path) -> tuple[int, int] | None:
    data = path.read_bytes()
    if len(data) < 4 or data[:2] != b"\xff\xd8":
        return None
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        while i < len(data) and data[i] == 0xFF:
            i += 1
        if i >= len(data):
            break
        marker = data[i]
        i += 1
        if marker in {0xD8, 0xD9, 0x01} or 0xD0 <= marker <= 0xD7:
            continue
        if i + 2 > len(data):
            break
        length = int.from_bytes(data[i : i + 2], "big")
        if length < 2 or i + length > len(data):
            break
        if marker in {
            0xC0,
            0xC1,
            0xC2,
            0xC3,
            0xC5,
            0xC6,
            0xC7,
            0xC9,
            0xCA,
            0xCB,
            0xCD,
            0xCE,
            0xCF,
        }:
            height = int.from_bytes(data[i + 3 : i + 5], "big")
            width = int.from_bytes(data[i + 5 : i + 7], "big")
            return width, height
        i += length
    return None


def source_author_names(source_authors: Any) -> list[str]:
    names: list[str] = []
    if not isinstance(source_authors, list):
        return names
    for author in source_authors:
        if isinstance(author, dict) and author.get("name"):
            names.append(str(author["name"]))
        elif isinstance(author, str):
            names.append(author)
    return names


def build_paper_index(papers: list[dict[str, Any]]) -> dict[str, Any]:
    entries = []
    for paper in sorted(papers, key=lambda item: item["sortKey"], reverse=True):
        image = paper.get("image", {})
        entries.append(
            {
                "slug": paper["slug"],
                "file": paper["file"],
                "permalink": paper["permalink"],
                "sortKey": paper["sortKey"],
                "titleHe": paper["titleHe"],
                "paperTitle": paper["paperTitle"],
                "authorsCardHe": paper["authorsCardHe"],
                "sourceAuthors": source_author_names(paper.get("sourceAuthors")),
                "journal": paper.get("journal", ""),
                "dateText": paper.get("dateText", ""),
                "doiUrl": paper.get("doiUrl", ""),
                "topics": paper["topics"],
                "image": {
                    "src": image.get("src", ""),
                    "altHe": image.get("altHe", ""),
                },
                "datePublished": paper["datePublished"],
                "dateModified": paper["dateModified"],
                "summaryHe": paper["summaryHe"],
            }
        )
    return {
        "version": 1,
        "description": "Compact duplicate-checking and nightly-update index generated from _papers/*.md. Do not edit by hand; run scripts/validate_sources.py --write-index.",
        "paperCount": len(entries),
        "papers": entries,
    }


def canonical_json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def normalize_text_key(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def normalize_doi(value: Any) -> str:
    doi = str(value or "").strip().rstrip("/")
    doi = re.sub(r"^https?://(?:dx\.)?doi\.org/", "https://doi.org/", doi, flags=re.I)
    return doi.lower()


def split_queue_topics(value: str) -> list[str]:
    return [topic.strip() for topic in re.split(r"[;|]", value) if topic.strip()]


def validate_html_links(label: str, html: str, errors: list[str]) -> None:
    parser = LinkParser()
    parser.feed(html)
    for href, attrs in parser.links:
        if not href.startswith(("http://", "https://")):
            continue
        rel_tokens = set(attrs.get("rel", "").split())
        if attrs.get("target") != "_blank" or not {"noopener", "noreferrer"} <= rel_tokens:
            errors.append(f"{label}: external link {href} must use target=\"_blank\" and rel=\"noopener noreferrer\"")


def strip_html(value: str) -> str:
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", value))).strip()


def sentence_count(value: str) -> int:
    text = strip_html(value)
    if not text:
        return 0
    endings = re.findall(r"[.!?؟]+(?=\s|$|[\"”׳״])", text)
    return len(endings) or 1


def validate_paper(paper: dict[str, Any], topic_ids: set[str], errors: list[str]) -> None:
    source_path = paper["_sourcePath"]
    label = source_path.relative_to(ROOT)

    missing = sorted(REQUIRED_PAPER_KEYS - set(paper))
    if missing:
        errors.append(f"{label}: missing required fields: {', '.join(missing)}")

    slug = paper.get("slug")
    expected_file = f"{slug}.html" if slug else None
    if paper.get("layout") != "paper":
        errors.append(f"{label}: layout must be paper")
    if paper.get("title") != paper.get("titleHe"):
        errors.append(f"{label}: title should match titleHe")
    if expected_file and paper.get("file") != expected_file:
        errors.append(f"{label}: file should be {expected_file}")
    if expected_file and paper.get("paper_url") != expected_file:
        errors.append(f"{label}: paper_url should be {expected_file}")
    if expected_file and paper.get("permalink") != f"/{expected_file}":
        errors.append(f"{label}: permalink should be /{expected_file}")
    if not isinstance(paper.get("sortKey"), int):
        errors.append(f"{label}: sortKey must be an integer")
    else:
        expected_published = str(paper["sortKey"])[:8]
        expected_published = f"{expected_published[:4]}-{expected_published[4:6]}-{expected_published[6:8]}"
        if paper.get("datePublished") != expected_published:
            errors.append(f"{label}: datePublished should match sortKey date {expected_published}")
    if paper.get("datePublished") and paper.get("dateModified") and paper["dateModified"] < paper["datePublished"]:
        errors.append(f"{label}: dateModified cannot be earlier than datePublished")

    topics = paper.get("topics")
    if not isinstance(topics, list) or not topics:
        errors.append(f"{label}: topics must be a non-empty list")
    else:
        for topic_id in topics:
            if topic_id not in topic_ids:
                errors.append(f"{label}: unknown topic id {topic_id}")

    image = paper.get("image")
    if not isinstance(image, dict) or not image.get("src") or not image.get("altHe"):
        errors.append(f"{label}: image must include src and altHe")
    else:
        image_path = clean_local_ref(image["src"])
        if image_path is None or not image_path.exists():
            errors.append(f"{label}: missing image {image.get('src')}")
        elif image_path.suffix.lower() in {".jpg", ".jpeg"}:
            dimensions = jpeg_dimensions(image_path)
            if dimensions != ARTICLE_IMAGE_SIZE:
                errors.append(f"{label}: image {image.get('src')} is {dimensions}, expected {ARTICLE_IMAGE_SIZE}")

    validate_html_links(f"{label} authorsHtml", str(paper.get("authorsHtml", "")), errors)
    validate_html_links(f"{label} oneLinerHtml", str(paper.get("oneLinerHtml", "")), errors)
    for index, section in enumerate(paper.get("sections", []), start=1):
        if not isinstance(section, dict):
            errors.append(f"{label}: section {index} must be an object")
            continue
        if not section.get("headingHe"):
            errors.append(f"{label}: section {index} missing headingHe")
        paragraphs = section.get("paragraphsHtml")
        if not isinstance(paragraphs, list) or not paragraphs:
            errors.append(f"{label}: section {index} paragraphsHtml must be a non-empty list")
            continue
        section_text = " ".join(str(paragraph) for paragraph in paragraphs)
        if sentence_count(section_text) < MIN_SECTION_SENTENCES:
            errors.append(f"{label}: section {index} must include at least {MIN_SECTION_SENTENCES} complete sentences")
        for paragraph_index, paragraph in enumerate(paragraphs, start=1):
            validate_html_links(f"{label} section {index} paragraph {paragraph_index}", str(paragraph), errors)


def validate_paper_queue(papers: list[dict[str, Any]], topic_ids: set[str], errors: list[str]) -> None:
    if not PAPER_QUEUE_PATH.exists():
        errors.append("paper_queue.csv is missing")
        return

    try:
        with PAPER_QUEUE_PATH.open(encoding="utf-8-sig", newline="") as queue_file:
            reader = csv.DictReader(queue_file)
            fieldnames = reader.fieldnames or []
            missing_columns = [column for column in QUEUE_REQUIRED_COLUMNS if column not in fieldnames]
            if missing_columns:
                errors.append(f"paper_queue.csv: missing required columns: {', '.join(missing_columns)}")
                return
            rows = list(reader)
    except csv.Error as exc:
        errors.append(f"paper_queue.csv is not valid CSV: {exc}")
        return

    existing_titles = {
        normalize_text_key(paper.get("paperTitle")): paper["_sourcePath"]
        for paper in papers
        if normalize_text_key(paper.get("paperTitle"))
    }
    existing_dois = {
        normalize_doi(paper.get("doiUrl")): paper["_sourcePath"]
        for paper in papers
        if normalize_doi(paper.get("doiUrl"))
    }
    seen_titles: dict[str, int] = {}
    seen_dois: dict[str, int] = {}

    for row_number, row in enumerate(rows, start=2):
        if row.get(None):
            errors.append(f"paper_queue.csv row {row_number}: too many CSV fields")
            continue

        paper_name = str(row.get("paper_name", "")).strip()
        authors = str(row.get("authors", "")).strip()
        doi = str(row.get("doi", "")).strip()
        topic_value = str(row.get("topic", "")).strip()

        if not paper_name:
            errors.append(f"paper_queue.csv row {row_number}: paper_name is required")
        if not authors:
            errors.append(f"paper_queue.csv row {row_number}: authors is required")
        if not doi:
            errors.append(f"paper_queue.csv row {row_number}: doi is required")
        if not topic_value:
            errors.append(f"paper_queue.csv row {row_number}: topic is required")

        title_key = normalize_text_key(paper_name)
        doi_key = normalize_doi(doi)
        if title_key:
            if title_key in existing_titles:
                errors.append(
                    f"paper_queue.csv row {row_number}: paper_name already exists in "
                    f"{existing_titles[title_key].relative_to(ROOT)}"
                )
            if title_key in seen_titles:
                errors.append(f"paper_queue.csv row {row_number}: duplicate paper_name also used on row {seen_titles[title_key]}")
            seen_titles.setdefault(title_key, row_number)
        if doi_key:
            if doi_key in existing_dois:
                errors.append(
                    f"paper_queue.csv row {row_number}: doi already exists in "
                    f"{existing_dois[doi_key].relative_to(ROOT)}"
                )
            if doi_key in seen_dois:
                errors.append(f"paper_queue.csv row {row_number}: duplicate doi also used on row {seen_dois[doi_key]}")
            seen_dois.setdefault(doi_key, row_number)

        for topic_id in split_queue_topics(topic_value):
            if topic_id not in topic_ids:
                errors.append(f"paper_queue.csv row {row_number}: unknown topic id {topic_id}")


def validate_suggest_queue(errors: list[str]) -> None:
    if not SUGGEST_QUEUE_PATH.exists():
        errors.append("suggest_queue.csv is missing")
        return

    try:
        with SUGGEST_QUEUE_PATH.open(encoding="utf-8-sig", newline="") as queue_file:
            reader = csv.DictReader(queue_file)
            fieldnames = reader.fieldnames or []
            missing_columns = [column for column in SUGGEST_QUEUE_REQUIRED_COLUMNS if column not in fieldnames]
            if missing_columns:
                errors.append(f"suggest_queue.csv: missing required columns: {', '.join(missing_columns)}")
                return
            rows = list(reader)
    except csv.Error as exc:
        errors.append(f"suggest_queue.csv is not valid CSV: {exc}")
        return

    for row_number, row in enumerate(rows, start=2):
        if row.get(None):
            errors.append(f"suggest_queue.csv row {row_number}: too many CSV fields")
            continue

        submitted_date = str(row.get("submitted_date", "")).strip()
        submitted_at = str(row.get("submitted_at", "")).strip()
        paper_name = str(row.get("paper_name", "")).strip()
        doi = str(row.get("doi", "")).strip()
        submitter_name = str(row.get("submitter_name", "")).strip()
        submitter_email = str(row.get("submitter_email", "")).strip()
        submitter_ip_hash = str(row.get("submitter_ip_hash", "")).strip()
        status = str(row.get("status", "")).strip()

        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", submitted_date):
            errors.append(f"suggest_queue.csv row {row_number}: submitted_date must be YYYY-MM-DD")
        if not submitted_at:
            errors.append(f"suggest_queue.csv row {row_number}: submitted_at is required")
        if not paper_name:
            errors.append(f"suggest_queue.csv row {row_number}: paper_name is required")
        doi_key = normalize_doi(doi)
        if not doi:
            errors.append(f"suggest_queue.csv row {row_number}: doi is required")
        elif not re.fullmatch(r"(?:https://doi\.org/)?10\.\d{4,9}/\S+", doi_key):
            errors.append(f"suggest_queue.csv row {row_number}: doi must look like a DOI")
        if not submitter_name:
            errors.append(f"suggest_queue.csv row {row_number}: submitter_name is required")
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", submitter_email):
            errors.append(f"suggest_queue.csv row {row_number}: submitter_email must be a valid email address")
        if not re.fullmatch(r"[0-9a-f]{64}", submitter_ip_hash):
            errors.append(f"suggest_queue.csv row {row_number}: submitter_ip_hash must be a 64-character SHA-256 hex hash")
        if status not in {"pending", "hold", "accepted", "rejected"}:
            errors.append(f"suggest_queue.csv row {row_number}: status must be pending, hold, accepted, or rejected")


def validate_topic_image_runs(papers: list[dict[str, Any]], topics: list[dict[str, Any]], errors: list[str]) -> None:
    ordered_papers = sorted(papers, key=lambda paper: paper["sortKey"], reverse=True)
    for topic in topics:
        topic_id = topic.get("id")
        if not topic_id:
            continue

        run_start = 0
        previous_src: str | None = None
        topic_papers = [paper for paper in ordered_papers if topic_id in paper.get("topics", [])]
        for index, paper in enumerate([*topic_papers, None]):
            image_src = None if paper is None else paper.get("image", {}).get("src")
            if index == 0:
                previous_src = image_src
                continue
            if image_src == previous_src:
                continue

            run_length = index - run_start
            if previous_src and run_length > MAX_TOPIC_IMAGE_RUN:
                run_slugs = ", ".join(str(item.get("slug")) for item in topic_papers[run_start:index])
                errors.append(
                    f"_data/topics.json: topic {topic_id} has {run_length} consecutive cards using "
                    f"{previous_src}; maximum is {MAX_TOPIC_IMAGE_RUN}. Affected papers: {run_slugs}"
                )
            run_start = index
            previous_src = image_src


def validate_sources(write_index: bool) -> int:
    errors: list[str] = []

    try:
        site_data = load_json(DATA_DIR / "site.json")
        topics_data = load_json(DATA_DIR / "topics.json")
    except ValueError as exc:
        print(exc, file=sys.stderr)
        return 1

    topics = topics_data.get("topics", [])
    topic_ids = {topic.get("id") for topic in topics if topic.get("id")}
    if len(topic_ids) != len(topics):
        errors.append("_data/topics.json: topic IDs must be present and unique")
    for topic in topics:
        for key in ("id", "page", "titleHe", "shortTitleHe", "descriptionHe", "image", "imageAltHe", "keywords"):
            if key not in topic:
                errors.append(f"_data/topics.json: topic {topic.get('id', '<unknown>')} missing {key}")
        topic_image = clean_local_ref(str(topic.get("image", "")))
        if topic_image is None or not topic_image.exists():
            errors.append(f"_data/topics.json: topic {topic.get('id')} missing image {topic.get('image')}")

    papers: list[dict[str, Any]] = []
    for path in sorted(PAPERS_DIR.glob("*.md")):
        try:
            papers.append(load_paper(path))
        except ValueError as exc:
            errors.append(str(exc))

    if not papers:
        errors.append("_papers: no paper files found")

    seen: dict[str, dict[Any, Path]] = {
        "slug": {},
        "file": {},
        "permalink": {},
        "sortKey": {},
        "doiUrl": {},
    }
    for paper in papers:
        validate_paper(paper, topic_ids, errors)
        source_path = paper["_sourcePath"]
        for key, values in seen.items():
            value = paper.get(key)
            if key == "doiUrl" and not value:
                continue
            if value in values:
                errors.append(f"{source_path.relative_to(ROOT)}: duplicate {key} also used by {values[value].relative_to(ROOT)}")
            else:
                values[value] = source_path

    validate_paper_queue(papers, topic_ids, errors)
    validate_suggest_queue(errors)
    validate_topic_image_runs(papers, topics, errors)

    paper_count = site_data.get("paperCount")
    if paper_count is not None and paper_count != len(papers):
        errors.append(f"_data/site.json: paperCount is {paper_count}, but found {len(papers)} papers")

    index = build_paper_index(papers)
    if write_index:
        PAPER_INDEX_PATH.write_text(canonical_json(index), encoding="utf-8")
    elif not PAPER_INDEX_PATH.exists():
        errors.append("_data/paper_index.json is missing; run scripts/validate_sources.py --write-index")
    else:
        try:
            existing_index = load_json(PAPER_INDEX_PATH)
            if existing_index != index:
                errors.append("_data/paper_index.json is stale; run scripts/validate_sources.py --write-index")
        except ValueError as exc:
            errors.append(str(exc))

    if errors:
        print("Validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Validation passed: {len(papers)} papers, {len(topics)} topics")
    if write_index:
        print(f"Wrote {PAPER_INDEX_PATH.relative_to(ROOT)}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write-index", action="store_true", help="regenerate _data/paper_index.json from _papers/*.md")
    args = parser.parse_args()
    return validate_sources(write_index=args.write_index)


if __name__ == "__main__":
    raise SystemExit(main())
