#!/usr/bin/env python3
"""Sample homepage cards from papers whose image-paper tuple is high fit."""

from __future__ import annotations

import argparse
import hashlib
import json
import random
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover - Python 3.8 fallback only
    ZoneInfo = None  # type: ignore[assignment]


ROOT = Path(__file__).resolve().parents[1]
PAPERS_DIR = ROOT / "_papers"
DATA_DIR = ROOT / "_data"
OUTPUT_PATH = DATA_DIR / "homepage_high_fit_sample.json"
SITE_DATA_PATH = DATA_DIR / "site.json"
DEFAULT_COUNT = 6


def israel_today() -> str:
    if ZoneInfo is None:
        return datetime.now().strftime("%Y-%m-%d")
    return datetime.now(ZoneInfo("Asia/Jerusalem")).strftime("%Y-%m-%d")


def canonical_json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def load_paper(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError(f"{path.relative_to(ROOT)} is missing front matter")
    end = text.find("\n---", 4)
    if end == -1:
        raise ValueError(f"{path.relative_to(ROOT)} is missing closing front matter")
    data = json.loads(text[4:end])
    data["_sourcePath"] = path
    return data


def load_papers() -> list[dict[str, Any]]:
    return [load_paper(path) for path in sorted(PAPERS_DIR.glob("*.md"))]


def load_site_data() -> dict[str, Any]:
    if not SITE_DATA_PATH.exists():
        return {}
    return json.loads(SITE_DATA_PATH.read_text(encoding="utf-8"))


def image_hash(paper: dict[str, Any]) -> str:
    image_src = paper.get("image", {}).get("src", "")
    image_path = ROOT / str(image_src).lstrip("/")
    if not image_path.exists():
        return ""
    return hashlib.sha256(image_path.read_bytes()).hexdigest()


def image_src_key(paper: dict[str, Any]) -> str:
    return str(paper.get("image", {}).get("src", "")).strip().lstrip("/")


def image_family(paper: dict[str, Any]) -> str:
    visual_anchor = str(paper.get("image", {}).get("visualAnchor", "")).strip()
    if visual_anchor:
        return visual_anchor

    image_src = str(paper.get("image", {}).get("src", ""))
    catalog_path = ROOT / "image_catalog.json"
    if not catalog_path.exists():
        return "unknown"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    by_file = {item.get("file"): item for item in catalog.get("images", [])}
    entry = by_file.get(image_src, {})
    source_type = entry.get("sourceType")
    if source_type:
        return str(source_type)
    notes = str(entry.get("qualityNotes", "")).lower()
    if "soft painterly" in notes:
        return "editorial-illustration"
    if "generated" in notes:
        return "generated"
    return "uncatalogued"


def high_fit_candidates(papers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates = [
        paper
        for paper in papers
        if paper.get("image", {}).get("fitness") == "high" and paper.get("image", {}).get("src")
    ]
    return sorted(candidates, key=lambda paper: (paper.get("slug", ""), paper.get("sortKey", 0)))


def preferred_homepage_candidates(
    candidates: list[dict[str, Any]], site_data: dict[str, Any], count: int
) -> list[dict[str, Any]]:
    paper_image_version = str(site_data.get("paperImageVersion", "")).strip()
    if not paper_image_version:
        return candidates

    preferred = [
        paper
        for paper in candidates
        if str(paper.get("image", {}).get("version", "")).strip() == paper_image_version
    ]
    if len(preferred) >= count:
        return preferred
    return candidates


def sample_papers(candidates: list[dict[str, Any]], count: int, seed: str) -> list[dict[str, Any]]:
    if len(candidates) < count:
        raise ValueError(f"Need at least {count} high-fit image papers; found {len(candidates)}")

    rng = random.Random(seed)
    shuffled = candidates[:]
    rng.shuffle(shuffled)

    selected: list[dict[str, Any]] = []
    selected_image_srcs: set[str] = set()
    selected_hashes: set[str] = set()
    topic_counts: Counter[str] = Counter()
    family_counts: Counter[str] = Counter()

    def can_add(paper: dict[str, Any], strict: bool) -> bool:
        image_src = image_src_key(paper)
        if image_src and image_src in selected_image_srcs:
            return False
        digest = image_hash(paper)
        if digest and digest in selected_hashes:
            return False
        if not strict:
            return True
        topic = str((paper.get("topics") or ["untagged"])[0])
        family = image_family(paper)
        return topic_counts[topic] < 2 and family_counts[family] < 3

    def add(paper: dict[str, Any]) -> None:
        selected.append(paper)
        image_src = image_src_key(paper)
        if image_src:
            selected_image_srcs.add(image_src)
        digest = image_hash(paper)
        if digest:
            selected_hashes.add(digest)
        topic_counts[str((paper.get("topics") or ["untagged"])[0])] += 1
        family_counts[image_family(paper)] += 1

    for strict in (True, False):
        for paper in shuffled:
            if len(selected) >= count:
                break
            if paper in selected:
                continue
            if can_add(paper, strict):
                add(paper)
        if len(selected) >= count:
            break

    if len(selected) < count:
        raise ValueError(f"Could only sample {len(selected)} high-fit image papers")

    return selected


def build_output(selected: list[dict[str, Any]], candidates: list[dict[str, Any]], seed: str) -> dict[str, Any]:
    return {
        "version": 1,
        "lastUpdated": israel_today(),
        "sampleSize": len(selected),
        "seed": seed,
        "selectionMode": "Sampled from papers whose image.fitness is high, preferring the current paperImageVersion when enough papers are available, with unique image.src values, duplicate-image byte checks, and light topic and visual-family diversity constraints.",
        "highFitPaperCount": len(candidates),
        "paperSlugs": [paper["slug"] for paper in selected],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=DEFAULT_COUNT, help="number of homepage papers to sample")
    parser.add_argument("--seed", default=None, help="deterministic sampling seed; defaults to Israel date")
    parser.add_argument("--write", action="store_true", help=f"write {OUTPUT_PATH.relative_to(ROOT)}")
    args = parser.parse_args()

    seed = args.seed or f"{israel_today()}-homepage-high-fit"
    papers = load_papers()
    site_data = load_site_data()
    all_high_fit_candidates = high_fit_candidates(papers)
    candidates = preferred_homepage_candidates(all_high_fit_candidates, site_data, args.count)
    selected = sample_papers(candidates, args.count, seed)
    output = build_output(selected, candidates, seed)
    text = canonical_json(output)

    if args.write:
        OUTPUT_PATH.write_text(text, encoding="utf-8")
        print(f"Wrote {OUTPUT_PATH.relative_to(ROOT)} with {len(selected)} papers from {len(candidates)} high-fit candidates")
    else:
        print(text, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
