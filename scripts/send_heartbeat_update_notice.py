#!/usr/bin/env python3
"""Send a heartbeat update email after public website changes are published.

Default mode is a dry run. Use --send only from the heartbeat automation after a
public website commit was pushed and the affected pages were smoke-checked.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import smtplib
import ssl
import subprocess
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from pathlib import Path
from zoneinfo import ZoneInfo


DEFAULT_RECIPIENT = "demokratia.info@gmail.com"
DEFAULT_REPLY_TO = "demokratia@tau.ac.il"
DEFAULT_SITE_URL = "https://demokratia-info.github.io"
ISRAEL_TZ = ZoneInfo("Asia/Jerusalem")


@dataclass(frozen=True)
class Change:
    status: str
    path: str
    old_path: str = ""


@dataclass
class AffectedPage:
    label: str
    url: str
    reasons: set[str]


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


def env(*names: str, default: str = "") -> str:
    for name in names:
        value = os.environ.get(name, "").strip()
        if value:
            return value
    return default


def mail_settings(recipient: str) -> dict[str, str | int]:
    smtp_user = env("HEARTBEAT_SMTP_USER", "AUTHOR_NOTICE_SMTP_USER")
    return {
        "host": env("HEARTBEAT_SMTP_HOST", "AUTHOR_NOTICE_SMTP_HOST", default="smtp.gmail.com"),
        "port": int(env("HEARTBEAT_SMTP_PORT", "AUTHOR_NOTICE_SMTP_PORT", default="587")),
        "user": smtp_user,
        "password": env("HEARTBEAT_SMTP_PASSWORD", "AUTHOR_NOTICE_SMTP_PASSWORD"),
        "from": env(
            "HEARTBEAT_MAIL_FROM",
            "AUTHOR_NOTICE_MAIL_FROM",
            default=formataddr(("Demokratia heartbeat", smtp_user)) if smtp_user else "",
        ),
        "reply_to": env("HEARTBEAT_REPLY_TO", "AUTHOR_NOTICE_REPLY_TO", default=DEFAULT_REPLY_TO),
        "cc": env("HEARTBEAT_CC"),
        "to": recipient,
    }


def require_send_settings(settings: dict[str, str | int]) -> None:
    missing = [
        name
        for name in ("user", "password", "from", "reply_to", "to")
        if not settings.get(name)
    ]
    if missing:
        joined = ", ".join(f"HEARTBEAT_{name.upper()}" for name in missing)
        raise SystemExit(f"Missing heartbeat mail configuration: {joined}")


def run_git(repo: Path, *args: str, allow_fail: bool = False) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=False,
        text=True,
        capture_output=True,
    )
    if result.returncode and not allow_fail:
        stderr = result.stderr.strip() or result.stdout.strip()
        raise SystemExit(f"git {' '.join(args)} failed in {repo}: {stderr}")
    return result.stdout


def short_ref(repo: Path, ref: str) -> str:
    value = run_git(repo, "rev-parse", "--short", ref, allow_fail=True).strip()
    return value or ref


def diff_name_status(repo: Path, before: str, after: str) -> list[Change]:
    if before == after or not before or not after:
        return []
    run_git(repo, "rev-parse", "--verify", before)
    run_git(repo, "rev-parse", "--verify", after)
    raw = subprocess.run(
        ["git", "-C", str(repo), "diff", "--name-status", "-z", before, after],
        check=True,
        capture_output=True,
    ).stdout.decode("utf-8", errors="replace")
    tokens = [token for token in raw.split("\0") if token]
    changes: list[Change] = []
    index = 0
    while index < len(tokens):
        status = tokens[index]
        index += 1
        if status[:1] in {"R", "C"}:
            old_path = tokens[index]
            path = tokens[index + 1]
            index += 2
            changes.append(Change(status, path, old_path))
        else:
            path = tokens[index]
            index += 1
            changes.append(Change(status, path))
    return changes


def commit_subjects(repo: Path, before: str, after: str) -> list[str]:
    if before == after:
        return []
    output = run_git(repo, "log", "--format=%h %s", "--reverse", f"{before}..{after}", allow_fail=True)
    return [line for line in output.splitlines() if line.strip()]


def site_url_from_config(repo: Path) -> str:
    config = repo / "_config.yml"
    if not config.exists():
        return DEFAULT_SITE_URL
    for line in config.read_text(encoding="utf-8").splitlines():
        match = re.match(r'^url:\s*["\']?([^"\']+)["\']?\s*$', line.strip())
        if match:
            return match.group(1).rstrip("/")
    return DEFAULT_SITE_URL


def absolutize(site_url: str, path: str) -> str:
    if not path.startswith("/"):
        path = f"/{path}"
    return f"{site_url.rstrip('/')}{path}"


def front_matter(path: Path) -> str:
    if not path.exists():
        return ""
    text = path.read_text(encoding="utf-8", errors="replace")
    if not text.startswith("---"):
        return ""
    parts = text.split("---", 2)
    if len(parts) < 3:
        return ""
    return parts[1].strip()


def front_matter_value(path: Path, key: str) -> str:
    data = front_matter(path)
    if not data:
        return ""
    if data.startswith("{"):
        try:
            value = json.loads(data).get(key, "")
            return str(value).strip()
        except json.JSONDecodeError:
            return ""
    match = re.search(rf"^{re.escape(key)}:\s*(.+)$", data, flags=re.MULTILINE)
    if not match:
        return ""
    return match.group(1).strip().strip("'\"")


def add_page(
    pages: dict[str, AffectedPage],
    site_url: str,
    path: str,
    label: str,
    reason: str,
) -> None:
    url = absolutize(site_url, path)
    if url not in pages:
        pages[url] = AffectedPage(label=label, url=url, reasons=set())
    pages[url].reasons.add(reason)


def infer_markdown_page(repo: Path, site_url: str, rel_path: str) -> tuple[str, str] | None:
    path = repo / rel_path
    permalink = front_matter_value(path, "permalink")
    title = front_matter_value(path, "title")
    if permalink:
        return title or rel_path, permalink
    if rel_path == "index.md":
        return title or "Home page", "/"
    if rel_path.endswith(".md") and "/" not in rel_path:
        return title or Path(rel_path).stem, f"/{Path(rel_path).stem}.html"
    return None


def infer_affected_pages(repo: Path, site_url: str, changes: list[Change]) -> dict[str, AffectedPage]:
    pages: dict[str, AffectedPage] = {}
    for change in changes:
        path = change.path
        old_path = change.old_path
        candidates = [candidate for candidate in (path, old_path) if candidate]
        for candidate in candidates:
            file_path = Path(candidate)
            suffix = file_path.suffix.lower()
            stem = file_path.stem

            if candidate == "index.md":
                add_page(pages, site_url, "/", "Home page", "homepage source changed")
                continue

            if candidate.startswith("_papers/") and suffix == ".md":
                title = front_matter_value(repo / path, "titleHe") or stem
                add_page(pages, site_url, f"/{stem}.html", title, "paper source changed")
                continue

            if candidate.startswith("topics/") and suffix == ".md":
                title = front_matter_value(repo / path, "title") or stem
                add_page(pages, site_url, f"/topics/{stem}.html", title, "topic source changed")
                continue

            if suffix == ".md":
                inferred = infer_markdown_page(repo, site_url, candidate)
                if inferred:
                    label, permalink = inferred
                    add_page(pages, site_url, permalink, label, "page source changed")
                    continue

            if candidate in {"_data/site.json", "_data/homepage_high_fit_sample.json", "_layouts/home.html"}:
                add_page(pages, site_url, "/", "Home page", "homepage data or layout changed")
                continue

            if candidate == "_data/topics.json":
                add_page(pages, site_url, "/", "Home page", "topic navigation data changed")
                continue

            if candidate == "_data/paper_index.json":
                add_page(pages, site_url, "/", "Home page", "paper index data changed")
                continue

            if candidate.startswith("assets/topic-icons/") and suffix == ".svg":
                add_page(pages, site_url, f"/topics/{stem}.html", stem, "topic icon changed")
                continue

            if candidate == "assets/js/suggest-paper.js" or candidate.startswith("workers/suggest-paper"):
                add_page(pages, site_url, "/suggest-paper.html", "Suggest a Paper page", "suggestion form behavior changed")
                continue

            if candidate == "assets/js/page-feedback.js" or candidate.startswith("workers/page-feedback"):
                add_page(pages, site_url, "/page-feedback.html", "Page feedback page", "feedback form behavior changed")
                continue

            if candidate == "assets/js/feedback-editor.js" or candidate.startswith("workers/feedback-editor"):
                add_page(pages, site_url, "/feedback-editor.html", "Feedback editor page", "editor behavior changed")
                continue

            if candidate == "assets/js/author-mailer.js" or candidate.startswith("workers/author-notice"):
                add_page(pages, site_url, "/author-mailer.html", "Author mailer page", "author mailer behavior changed")
                continue

            if candidate.startswith("_layouts/") or candidate.startswith("_includes/") or candidate == "assets/css/site.css":
                add_page(pages, site_url, "/", "Site-wide shared rendering", "shared layout/include/CSS changed")
                continue

            if suffix in {".jpg", ".jpeg", ".png", ".webp", ".avif"}:
                if stem.startswith("democracy_"):
                    add_page(pages, site_url, f"/{stem}.html", stem, "paper image changed")
                else:
                    add_page(pages, site_url, "/", "Site-wide shared media", "shared image asset changed")

    if not pages and changes:
        add_page(pages, site_url, "/", "Public site", "public repository changed")
    return pages


def status_label(status: str) -> str:
    code = status[:1]
    return {
        "A": "added",
        "M": "modified",
        "D": "deleted",
        "R": "renamed",
        "C": "copied",
        "T": "type changed",
        "U": "unmerged",
    }.get(code, status)


def summarize_changes(changes: list[Change]) -> list[str]:
    counter = Counter(change.status[:1] for change in changes)
    lines = [
        f"{len(changes)} public file(s) changed "
        f"({', '.join(f'{status_label(code)}: {count}' for code, count in sorted(counter.items()))})."
    ]
    paper_changes = [change for change in changes if change.path.startswith("_papers/") and change.path.endswith(".md")]
    image_changes = [
        change
        for change in changes
        if Path(change.path).suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".avif"}
    ]
    topic_changes = [change for change in changes if change.path.startswith("topics/") and change.path.endswith(".md")]
    shared_changes = [
        change
        for change in changes
        if change.path.startswith("_layouts/")
        or change.path.startswith("_includes/")
        or change.path.startswith("assets/")
        or change.path.startswith("_data/")
    ]
    form_changes = [
        change
        for change in changes
        if change.path in {"suggest-paper.md", "page-feedback.md", "feedback-editor.md", "author-mailer.md"}
        or change.path.startswith("workers/")
    ]
    if paper_changes:
        lines.append(f"{len(paper_changes)} paper summary source file(s) changed.")
    if image_changes:
        lines.append(f"{len(image_changes)} image/media file(s) changed.")
    if topic_changes:
        lines.append(f"{len(topic_changes)} topic page source file(s) changed.")
    if shared_changes:
        lines.append(f"{len(shared_changes)} shared layout, asset, or data file(s) changed.")
    if form_changes:
        lines.append(f"{len(form_changes)} form/editor/worker file(s) changed.")
    return lines


def format_change(change: Change) -> str:
    if change.old_path:
        return f"{change.status} {change.old_path} -> {change.path}"
    return f"{change.status} {change.path}"


def limited_lines(lines: list[str], limit: int) -> list[str]:
    if len(lines) <= limit:
        return lines
    remaining = len(lines) - limit
    return [*lines[:limit], f"... {remaining} more omitted"]


def compose_body(
    public_repo: Path,
    public_before: str,
    public_after: str,
    public_changes: list[Change],
    public_commits: list[str],
    affected_pages: dict[str, AffectedPage],
    private_repo: Path | None,
    private_before: str,
    private_after: str,
    private_changes: list[Change],
    max_list_items: int,
) -> str:
    now = datetime.now(ISRAEL_TZ).strftime("%Y-%m-%d %H:%M:%S %Z")
    before_short = short_ref(public_repo, public_before)
    after_short = short_ref(public_repo, public_after)

    lines = [
        "Demokratia heartbeat update",
        "",
        f"Run time: {now}",
        f"Public range: {before_short}..{after_short}",
        f"Public repository: {public_repo}",
        "",
        "Description of changes:",
        *[f"- {line}" for line in summarize_changes(public_changes)],
    ]

    if public_commits:
        lines.extend(["", "Public commit(s):", *[f"- {line}" for line in public_commits]])

    lines.extend(["", "Affected public page(s):"])
    page_lines = []
    for page in sorted(affected_pages.values(), key=lambda item: item.url):
        reasons = "; ".join(sorted(page.reasons))
        page_lines.append(f"- {page.label} ({reasons}): {page.url}")
    lines.extend(limited_lines(page_lines, max_list_items))

    lines.extend(["", "Changed public file(s):"])
    lines.extend(limited_lines([f"- {format_change(change)}" for change in public_changes], max_list_items))

    if private_repo and private_before and private_after:
        private_before_short = short_ref(private_repo, private_before)
        private_after_short = short_ref(private_repo, private_after)
        lines.extend(
            [
                "",
                f"Private operational range: {private_before_short}..{private_after_short}",
                "Private operational file(s) changed (filenames only; private row contents are not included):",
            ]
        )
        if private_changes:
            lines.extend(limited_lines([f"- {format_change(change)}" for change in private_changes], max_list_items))
        else:
            lines.append("- No private operational file changes detected in this range.")

    return "\n".join(lines) + "\n"


def compose_message(subject: str, body: str, settings: dict[str, str | int]) -> EmailMessage:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = str(settings["from"])
    message["To"] = str(settings["to"])
    if settings.get("cc"):
        message["Cc"] = str(settings["cc"])
    message["Reply-To"] = str(settings["reply_to"])
    message["Message-ID"] = make_msgid(domain="demokratia-info.github.io")
    message.set_content(body)
    return message


def send_message(message: EmailMessage, settings: dict[str, str | int]) -> None:
    context = ssl.create_default_context()
    with smtplib.SMTP(str(settings["host"]), int(settings["port"]), timeout=30) as smtp:
        smtp.ehlo()
        smtp.starttls(context=context)
        smtp.ehlo()
        smtp.login(str(settings["user"]), str(settings["password"]))
        smtp.send_message(message)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--public-repo", type=Path, default=Path.cwd())
    parser.add_argument("--public-before", required=True, help="Public repo ref captured before heartbeat changes.")
    parser.add_argument("--public-after", default="HEAD", help="Public repo ref after heartbeat changes.")
    parser.add_argument("--private-repo", type=Path, default=None)
    parser.add_argument("--private-before", default="", help="Private repo ref captured before heartbeat changes.")
    parser.add_argument("--private-after", default="HEAD", help="Private repo ref after heartbeat changes.")
    parser.add_argument("--site-url", default="", help="Override public site URL.")
    parser.add_argument("--recipient", default="", help="Override recipient. Defaults to HEARTBEAT_MAIL_TO or demokratia.info@gmail.com.")
    parser.add_argument("--env-file", type=Path, action="append", default=[])
    parser.add_argument("--max-list-items", type=int, default=200)
    parser.add_argument("--send", action="store_true", help="Actually send email. Default is dry-run.")
    parser.add_argument("--dry-run", action="store_true", help="Preview the email without sending. This is the default.")
    args = parser.parse_args()

    default_env_files = [
        Path.home() / ".demokratia_heartbeat_mail.env",
        Path.home() / ".demokratia_author_mail.env",
    ]
    for env_file in [*default_env_files, *args.env_file]:
        load_env_file(env_file)

    public_repo = args.public_repo.resolve()
    private_repo = args.private_repo.resolve() if args.private_repo else None
    public_changes = diff_name_status(public_repo, args.public_before, args.public_after)
    if not public_changes:
        print("No public website changes detected; not sending heartbeat update email.")
        return

    private_changes: list[Change] = []
    if private_repo and args.private_before and args.private_after:
        private_changes = diff_name_status(private_repo, args.private_before, args.private_after)

    site_url = (args.site_url or site_url_from_config(public_repo)).rstrip("/")
    affected_pages = infer_affected_pages(public_repo, site_url, public_changes)
    public_commits = commit_subjects(public_repo, args.public_before, args.public_after)
    body = compose_body(
        public_repo=public_repo,
        public_before=args.public_before,
        public_after=args.public_after,
        public_changes=public_changes,
        public_commits=public_commits,
        affected_pages=affected_pages,
        private_repo=private_repo,
        private_before=args.private_before,
        private_after=args.private_after,
        private_changes=private_changes,
        max_list_items=max(1, args.max_list_items),
    )
    if not body.strip():
        print("Heartbeat update body is empty; not sending email.")
        return

    recipient = args.recipient or env("HEARTBEAT_MAIL_TO", default=DEFAULT_RECIPIENT)
    settings = mail_settings(recipient)
    subject = f"Demokratia heartbeat update: {len(public_changes)} public file(s) changed"
    message = compose_message(subject, body, settings)

    print(f"{'SEND' if args.send else 'DRY-RUN'} heartbeat update to {message['To']}")
    print(f"  From: {message['From']}")
    print(f"  Reply-To: {message['Reply-To']}")
    print(f"  Subject: {message['Subject']}")
    print("")
    print(body)

    if args.send:
        require_send_settings(settings)
        send_message(message, settings)
        print("Heartbeat update email sent.")


if __name__ == "__main__":
    main()
