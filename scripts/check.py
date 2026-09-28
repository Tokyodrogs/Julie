#!/usr/bin/env python3
"""Static checks for the Julie site.

Validates the shipped artifacts (not a copy of them): parses index.html,
confirms every local asset reference resolves on disk, every in-page
fragment link has a matching id, every id is unique, CSS braces balance,
CSS url() references resolve, and JavaScript parses under ``node --check``.

Usage:
    python3 scripts/check.py [--root PATH] [--verbose]

Exits 0 when every check passes, 1 otherwise.
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

VOID_ELEMENTS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}

# References that point somewhere other than this repository.
EXTERNAL_SCHEMES = (
    "http://",
    "https://",
    "mailto:",
    "tel:",
    "data:",
    "//",
)


class Collector(HTMLParser):
    """Collects structure we care about: tags, refs, ids, fragments."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[tuple[str, int]] = []
        self.local_refs: list[tuple[str, str, int]] = []
        self.fragments: list[tuple[str, int]] = []
        self.ids: list[tuple[str, int]] = []
        self.errors: list[str] = []
        self.tags: set[str] = set()
        self.charset_seen = False
        self.title_seen = False
        self.viewport_seen = False
        self.html_lang: str | None = None
        self._current_tag: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.tags.add(tag)
        attr = {k: (v or "") for k, v in attrs}
        line = self.getpos()[0]

        if tag == "html":
            self.html_lang = attr.get("lang")
        if tag == "meta":
            if attr.get("charset"):
                self.charset_seen = True
            if attr.get("name") == "viewport":
                self.viewport_seen = True
        if tag == "title":
            self._current_tag = "title"
        if "id" in attr:
            self.ids.append((attr["id"], line))

        for key in ("href", "src"):
            value = attr.get(key)
            if not value:
                continue
            if value.startswith("#"):
                self.fragments.append((value[1:], line))
            elif not value.startswith(EXTERNAL_SCHEMES):
                self.local_refs.append((value, key, line))

        if tag not in VOID_ELEMENTS:
            self.stack.append((tag, line))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        # self-closing form closes itself; undo the push above
        if tag not in VOID_ELEMENTS and self.stack and self.stack[-1][0] == tag:
            self.stack.pop()

    def handle_endtag(self, tag: str) -> None:
        line = self.getpos()[0]
        if tag in VOID_ELEMENTS:
            self.errors.append(f"line {line}: closing tag for void element </{tag}>")
            return
        if not self.stack:
            self.errors.append(f"line {line}: stray closing tag </{tag}>")
            return
        if self.stack[-1][0] == tag:
            self.stack.pop()
            return
        names = [name for name, _ in self.stack]
        if tag in names:
            while self.stack and self.stack[-1][0] != tag:
                unclosed, open_line = self.stack.pop()
                self.errors.append(
                    f"line {line}: </{tag}> closes before <{unclosed}> opened on line {open_line}"
                )
            if self.stack:
                self.stack.pop()
        else:
            self.errors.append(f"line {line}: stray closing tag </{tag}>")

    def handle_data(self, data: str) -> None:
        if self._current_tag == "title" and data.strip():
            self.title_seen = True

    def close(self) -> None:
        super().close()
        self._current_tag = None
        for unclosed, open_line in self.stack:
            self.errors.append(f"line {open_line}: <{unclosed}> is never closed")


CSS_URL_RE = re.compile(r"""url\(\s*(['"]?)(.*?)\1\s*\)""")


def check_html(html_path: Path, root: Path, problems: list[str]) -> Collector:
    text = html_path.read_text(encoding="utf-8")
    parser = Collector()
    parser.feed(text)
    parser.close()
    problems.extend(f"index.html {e}" for e in parser.errors)

    if parser.html_lang is None:
        problems.append("index.html: <html> is missing a lang attribute")
    if not parser.charset_seen:
        problems.append("index.html: <head> is missing <meta charset>")
    if not parser.title_seen:
        problems.append("index.html: <head> is missing a non-empty <title>")
    if not parser.viewport_seen:
        problems.append('index.html: <head> is missing <meta name="viewport">')

    seen: dict[str, int] = {}
    for value, line in parser.ids:
        if value in seen:
            problems.append(
                f"index.html line {line}: duplicate id '{value}' "
                f"(first used on line {seen[value]})"
            )
        else:
            seen[value] = line

    known_ids = set(seen)
    for value, line in parser.fragments:
        if value and value not in known_ids:
            problems.append(
                f"index.html line {line}: link to #{value} but no element has that id"
            )

    for ref, key, line in parser.local_refs:
        target = (html_path.parent / ref).resolve()
        if not target.exists():
            problems.append(
                f"index.html line {line}: {key}=\"{ref}\" does not exist on disk"
            )
        elif target.is_dir():
            problems.append(f"index.html line {line}: {key}=\"{ref}\" is a directory")
    return parser


def check_css(path: Path, problems: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    opens = text.count("{")
    closes = text.count("}")
    if opens != closes:
        problems.append(
            f"{path.name}: unbalanced braces: {opens} opening vs {closes} closing"
        )
    for match in CSS_URL_RE.finditer(text):
        ref = match.group(2).strip()
        if not ref or ref.startswith(EXTERNAL_SCHEMES) or ref.startswith("#"):
            continue
        if not (path.parent / ref).resolve().exists():
            problems.append(f"{path.name}: url({ref}) does not exist on disk")


def check_js(path: Path, problems: list[str]) -> bool:
    node = shutil.which("node")
    if not node:
        print(f"  ~ skipped JS syntax check for {path.name}: node not on PATH")
        return False
    result = subprocess.run(
        [node, "--check", str(path)], capture_output=True, text=True
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        problems.append(f"{path.name}: node --check failed\n{detail}")
    return True


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", default=".", help="repository root (default: cwd)")
    ap.add_argument("--verbose", action="store_true", help="print every step")
    args = ap.parse_args(argv)

    root = Path(args.root).resolve()
    index = root / "index.html"
    problems: list[str] = []

    if not index.exists():
        print(f"FAIL  {index} not found")
        return 1

    print(f"Checking site at {root}")

    check_html(index, root, problems)
    if args.verbose:
        print("  - parsed index.html (tags, refs, ids, fragments)")

    assets = sorted((root / "assets").glob("*")) if (root / "assets").is_dir() else []
    photos = sorted((root / "images").glob("*")) if (root / "images").is_dir() else []
    css_files = [p for p in assets if p.suffix == ".css"]
    js_files = [p for p in assets if p.suffix == ".js"]
    svg_files = [p for p in assets + photos if p.suffix == ".svg"]
    raster_files = [p for p in photos if p.suffix in (".jpg", ".jpeg", ".png", ".webp", ".gif")]

    for path in css_files:
        check_css(path, problems)
    if args.verbose:
        print(f"  - checked {len(css_files)} CSS file(s) for braces and url() refs")

    for path in js_files:
        check_js(path, problems)
    if args.verbose:
        print(f"  - ran node --check on {len(js_files)} JS file(s)")

    for path in svg_files:
        text = path.read_text(encoding="utf-8")
        if "<svg" not in text or "</svg>" not in text:
            problems.append(f"{path.name}: not a well-formed <svg> document")
    if args.verbose:
        print(f"  - checked {len(svg_files)} SVG file(s)")

    for path in raster_files:
        if path.stat().st_size == 0:
            problems.append(f"{path.name}: file is empty (0 bytes)")
    if args.verbose:
        print(f"  - checked {len(raster_files)} photo file(s) are non-empty")

    if problems:
        print(f"\nFAIL  {len(problems)} problem(s):")
        for problem in problems:
            print(f"  x {problem}")
        return 1

    print(
        f"\nOK  index.html parsed cleanly; "
        f"{len(css_files)} CSS, {len(js_files)} JS, {len(svg_files)} SVG, "
        f"{len(raster_files)} photo asset(s) valid"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
