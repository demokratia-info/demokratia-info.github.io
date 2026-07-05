#!/usr/bin/env python3
"""Apply the Wikimedia Commons real-photo image handoff to paper pages."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import re
import sys
import tempfile
import time
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from PIL import Image, ImageOps, UnidentifiedImageError

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover - Python 3.8 fallback only
    ZoneInfo = None  # type: ignore[assignment]


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_HANDOFF_ZIP = (
    ROOT.parent
    / "summary and image fixes"
    / "hashlama"
    / "hashlama 2"
    / "REAL_PHOTO_IMAGE_HANDOFF_2026_07_05.zip"
)
CSV_NAME = "REAL_PHOTO_IMAGE_HANDOFF_2026_07_05/data/real_photo_image_replacements_862.csv"
ASSET_DIR = ROOT / "assets" / "article-images"
CACHE_DIR = Path.home() / ".cache" / "demokratia-real-photo-handoff-2026-07-05"
SITE_DATA_PATH = ROOT / "_data" / "site.json"
IMAGE_VERSION = "2026-07-05-real-photo-handoff"
LAST_UPDATED_HE = "5 ביולי 2026"
TARGET_SIZE = (800, 600)
THUMB_WIDTH = 1280
USER_AGENT = "Demokratia real-photo importer/1.0 (contact: demokratia.info@gmail.com)"

LICENSE_URLS = {
    "CC0": "https://creativecommons.org/publicdomain/zero/1.0/",
    "CC BY 2.0": "https://creativecommons.org/licenses/by/2.0/",
    "CC BY 2.5": "https://creativecommons.org/licenses/by/2.5/",
    "CC BY 3.0": "https://creativecommons.org/licenses/by/3.0/",
    "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
    "CC BY-SA 1.0": "https://creativecommons.org/licenses/by-sa/1.0/",
    "CC BY-SA 2.0": "https://creativecommons.org/licenses/by-sa/2.0/",
    "CC BY-SA 3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
    "CC BY-SA 3.0 de": "https://creativecommons.org/licenses/by-sa/3.0/deed.de",
    "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
    "Public domain": "https://commons.wikimedia.org/wiki/Commons:Copyright_tags#Public_domain",
}


def israel_today() -> str:
    if ZoneInfo is None:
        return datetime.now().strftime("%Y-%m-%d")
    return datetime.now(ZoneInfo("Asia/Jerusalem")).strftime("%Y-%m-%d")


def canonical_json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def load_rows(handoff_zip: Path) -> list[dict[str, str]]:
    with zipfile.ZipFile(handoff_zip) as archive:
        text = archive.read(CSV_NAME).decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text)))


def front_matter_parts(path: Path) -> tuple[dict[str, Any], str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError(f"{path.relative_to(ROOT)} is missing opening front matter marker")
    end = text.find("\n---", 4)
    if end == -1:
        raise ValueError(f"{path.relative_to(ROOT)} is missing closing front matter marker")
    data = json.loads(text[4:end])
    return data, text[end + len("\n---") :]


def write_front_matter(path: Path, data: dict[str, Any], body: str) -> None:
    path.write_text("---\n" + canonical_json(data) + "---" + body, encoding="utf-8")


def safe_filename(value: str, limit: int = 96) -> str:
    clean = re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_").lower()
    clean = re.sub(r"_+", "_", clean)
    return clean[:limit].rstrip("_") or "paper"


def asset_name(row: dict[str, str]) -> str:
    index = int(row["unique_image_repair_index"])
    anchor = safe_filename(row.get("pool_anchor") or row.get("visual_anchor", "photo"), 18)
    slug = safe_filename(row["slug"], 90)
    return f"real_photo_{index:03d}_{anchor}_{slug}.jpg"


def cache_path_for(url: str) -> Path:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()
    return CACHE_DIR / f"{digest}.img"


def redirect_url(row: dict[str, str]) -> str | None:
    file_title = row.get("replacement_file_title", "").strip()
    if not file_title:
        commons_title = row.get("commons_file_title", "").strip()
        if commons_title.lower().startswith("file:"):
            file_title = commons_title[5:]
    if not file_title:
        return None
    return f"https://commons.wikimedia.org/wiki/Special:Redirect/file/{quote(file_title, safe='')}?width={THUMB_WIDTH}"


def retry_after_seconds(error: HTTPError, attempt: int) -> float:
    header = error.headers.get("Retry-After")
    if header:
        try:
            return max(5.0, float(header))
        except ValueError:
            pass
    return min(300.0, 45.0 * (attempt + 1))


def fetch_bytes(url: str, delay: float, max_attempts: int) -> bytes:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = cache_path_for(url)
    if cache_path.exists() and cache_path.stat().st_size > 0:
        return cache_path.read_bytes()

    last_error: Exception | None = None
    for attempt in range(max_attempts):
        request = Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            },
        )
        try:
            with urlopen(request, timeout=60) as response:
                data = response.read()
            if delay > 0:
                time.sleep(delay)
            with tempfile.NamedTemporaryFile(dir=CACHE_DIR, delete=False) as tmp:
                tmp.write(data)
                tmp_path = Path(tmp.name)
            os.replace(tmp_path, cache_path)
            return data
        except HTTPError as exc:
            last_error = exc
            if exc.code == 429:
                sleep_for = retry_after_seconds(exc, attempt)
                print(f"HTTP 429; sleeping {sleep_for:.0f}s before retrying {url}", flush=True)
                time.sleep(sleep_for)
                continue
            if 500 <= exc.code < 600:
                sleep_for = min(120.0, 10.0 * (attempt + 1))
                print(f"HTTP {exc.code}; sleeping {sleep_for:.0f}s before retrying {url}", flush=True)
                time.sleep(sleep_for)
                continue
            raise
        except URLError as exc:
            last_error = exc
            sleep_for = min(120.0, 10.0 * (attempt + 1))
            print(f"Network error; sleeping {sleep_for:.0f}s before retrying {url}: {exc}", flush=True)
            time.sleep(sleep_for)

    raise RuntimeError(f"failed to download after {max_attempts} attempts: {url}: {last_error}")


def download_image(row: dict[str, str], delay: float, max_attempts: int) -> bytes:
    urls = [url for url in [redirect_url(row), row.get("replacement_image_url", "").strip()] if url]
    errors: list[str] = []
    for url in urls:
        try:
            return fetch_bytes(url, delay=delay, max_attempts=max_attempts)
        except Exception as exc:  # noqa: BLE001 - try fallback URL and report context
            errors.append(f"{url}: {exc}")
    raise RuntimeError("; ".join(errors))


def convert_to_rgb(image: Image.Image) -> Image.Image:
    if image.mode in {"RGB", "L"}:
        return image.convert("RGB")
    if image.mode in {"RGBA", "LA"}:
        background = Image.new("RGB", image.size, (255, 255, 255))
        alpha = image.getchannel("A")
        background.paste(image.convert("RGB"), mask=alpha)
        return background
    return image.convert("RGB")


def crop_to_4x3(image: Image.Image) -> Image.Image:
    image = ImageOps.exif_transpose(image)
    width, height = image.size
    target_ratio = TARGET_SIZE[0] / TARGET_SIZE[1]
    source_ratio = width / height

    if source_ratio > target_ratio:
        crop_width = int(height * target_ratio)
        left = max(0, (width - crop_width) // 2)
        box = (left, 0, left + crop_width, height)
    else:
        crop_height = int(width / target_ratio)
        top = max(0, (height - crop_height) // 2)
        box = (0, top, width, top + crop_height)
    return image.crop(box).resize(TARGET_SIZE, Image.Resampling.LANCZOS)


def write_asset(data: bytes, asset_path: Path) -> None:
    try:
        with Image.open(io.BytesIO(data)) as image:
            prepared = convert_to_rgb(crop_to_4x3(image))
    except UnidentifiedImageError as exc:
        raise RuntimeError(f"downloaded bytes are not an image for {asset_path.name}") from exc

    asset_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=asset_path.parent, suffix=".jpg", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        prepared.save(tmp_path, format="JPEG", quality=84, optimize=True, progressive=True)
        os.replace(tmp_path, asset_path)
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def image_dimensions(path: Path) -> tuple[int, int]:
    with Image.open(path) as image:
        return image.size


def photo_alt(row: dict[str, str]) -> str:
    current = row.get("current_image_altHe", "").strip()
    if current:
        alt = current.replace("איור עריכתי", "תצלום").replace("איור", "תצלום")
        if "תצלום" in alt:
            return alt
    title = row.get("titleHe", "").strip() or row.get("paperTitle", "").strip()
    return f"תצלום הקשור ל{title}" if title else "תצלום הקשור למאמר"


def old_generated_asset(row: dict[str, str]) -> Path | None:
    old = row.get("old_generated_replacement_image_url", "").strip()
    if not old:
        return None
    old = old.replace("02_image_replacements/generated_assets_full_862/", "assets/article-images/")
    path = ROOT / old
    if path.exists():
        return path
    return None


def update_paper(row: dict[str, str], asset_rel_path: str) -> None:
    path = ROOT / row["target_file"]
    data, body = front_matter_parts(path)
    if data.get("slug") != row["slug"]:
        raise ValueError(f"{path.relative_to(ROOT)} slug mismatch: {data.get('slug')} != {row['slug']}")

    license_name = row.get("replacement_license", "").strip()
    image = {
        "src": asset_rel_path,
        "version": IMAGE_VERSION,
        "altHe": photo_alt(row),
        "fitness": "high",
        "license": license_name,
        "creator": row.get("replacement_artist", "").strip(),
        "provider": "Wikimedia Commons",
        "sourcePage": row.get("replacement_source_page", "").strip(),
        "originalUrl": row.get("replacement_original_url", "").strip(),
        "fileTitle": row.get("replacement_file_title", "").strip(),
        "sourceDimensions": row.get("replacement_dimensions", "").strip(),
        "localDimensions": f"{TARGET_SIZE[0]}x{TARGET_SIZE[1]}",
        "specificityTier": row.get("audit_specificity_tier", "").strip(),
        "matchType": "wikimedia_commons_real_photo",
        "matchQuality": row.get("match_quality", "").strip(),
        "sourceMethod": row.get("replacement_source_method", "").strip(),
        "visualAnchor": row.get("visual_anchor", "").strip(),
        "handoffStatus": row.get("handoff_status", "").strip(),
        "finalHandoffStatus": row.get("final_handoff_status", "").strip(),
    }
    license_url = LICENSE_URLS.get(license_name)
    if license_url:
        image["licenseUrl"] = license_url

    data["image"] = image
    data["dateModified"] = israel_today()
    data["lastUpdatedHe"] = LAST_UPDATED_HE
    write_front_matter(path, data, body)


def update_site_data() -> None:
    data = json.loads(SITE_DATA_PATH.read_text(encoding="utf-8"))
    data["lastUpdated"] = israel_today()
    data["cacheVersion"] = IMAGE_VERSION
    data["paperImageVersion"] = IMAGE_VERSION
    SITE_DATA_PATH.write_text(canonical_json(data), encoding="utf-8")


def existing_valid_asset(path: Path) -> bool:
    if not path.exists():
        return False
    try:
        return image_dimensions(path) == TARGET_SIZE
    except Exception:  # noqa: BLE001
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--handoff-zip", type=Path, default=DEFAULT_HANDOFF_ZIP)
    parser.add_argument("--delay", type=float, default=1.5, help="seconds to wait after each network download")
    parser.add_argument("--max-attempts", type=int, default=6)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--start", type=int, default=1, help="1-based handoff row index to start at")
    parser.add_argument("--force", action="store_true", help="redownload/rewrite existing valid local assets")
    parser.add_argument("--delete-old-generated", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    rows = load_rows(args.handoff_zip)
    selected_rows = [row for row in rows if int(row["unique_image_repair_index"]) >= args.start]
    if args.limit is not None:
        selected_rows = selected_rows[: args.limit]

    if not selected_rows:
        print("No rows selected")
        return 0

    failures: list[tuple[str, str]] = []
    completed = skipped_downloads = deleted_old = 0
    started_at = time.monotonic()

    print(
        f"Applying {len(selected_rows)} real-photo image rows from {args.handoff_zip} "
        f"with delay={args.delay}s",
        flush=True,
    )

    for position, row in enumerate(selected_rows, start=1):
        index = int(row["unique_image_repair_index"])
        asset_rel_path = f"assets/article-images/{asset_name(row)}"
        asset_path = ROOT / asset_rel_path

        try:
            if not args.dry_run:
                if args.force or not existing_valid_asset(asset_path):
                    image_data = download_image(row, delay=args.delay, max_attempts=args.max_attempts)
                    write_asset(image_data, asset_path)
                else:
                    skipped_downloads += 1

                dimensions = image_dimensions(asset_path)
                if dimensions != TARGET_SIZE:
                    raise RuntimeError(f"{asset_path.relative_to(ROOT)} dimensions are {dimensions}, expected {TARGET_SIZE}")

                update_paper(row, asset_rel_path)
                if args.delete_old_generated:
                    old_path = old_generated_asset(row)
                    if old_path is not None and old_path != asset_path:
                        old_path.unlink()
                        deleted_old += 1

            completed += 1
        except Exception as exc:  # noqa: BLE001 - continue to collect all row failures
            failures.append((row["slug"], str(exc)))
            print(f"FAILED row {index} {row['slug']}: {exc}", flush=True)

        if position == 1 or position % 25 == 0 or position == len(selected_rows):
            elapsed = time.monotonic() - started_at
            rate = completed / elapsed * 60 if elapsed else 0.0
            print(
                f"progress {position}/{len(selected_rows)} rows; completed={completed}; "
                f"failures={len(failures)}; skipped_downloads={skipped_downloads}; "
                f"deleted_old={deleted_old}; rate={rate:.1f}/min",
                flush=True,
            )

    if failures:
        print("Failures:", file=sys.stderr)
        for slug, error in failures:
            print(f"- {slug}: {error}", file=sys.stderr)
        return 1

    if not args.dry_run and args.start == 1 and args.limit is None:
        update_site_data()

    print(
        json.dumps(
            {
                "selected_rows": len(selected_rows),
                "completed": completed,
                "skipped_downloads": skipped_downloads,
                "deleted_old_generated_assets": deleted_old,
                "image_version": IMAGE_VERSION,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
