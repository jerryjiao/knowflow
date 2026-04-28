#!/usr/bin/env python3
"""Wiki Health Check — validates links, file sizes, and orphan pages.

Usage:
    python scripts/wiki-health.py [WIKI_DIR]

Checks:
  1. Broken links: [[wiki-links]] and [markdown](links) pointing to missing files
  2. Tiny files: .md files under 100 bytes
  3. Orphan pages: .md files not linked from any other page (excludes index.md, topics.md, overview.md, log.md)

Exit codes:
  0 — all checks pass (or only warnings)
  1 — broken links found
  2 — errors during execution
"""

import os
import re
import sys
import urllib.request
import urllib.parse
from pathlib import Path
from collections import defaultdict

# --- Configuration ---
WIKI_ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("wiki")
TINY_THRESHOLD = 100  # bytes
INDEX_FILES = {"index.md", "topics.md", "overview.md", "log.md"}

# --- Helpers ---

def resolve_wiki_link(link_target: str, source_file: Path, wiki_root: Path) -> Path:
    """Resolve a [[wiki-link]] target to an actual file path.

    Wiki-links are relative to wiki_root, not to the source file.
    Supports optional display text: [[target|Display Text]] -> target
    """
    # Strip optional display text: [[target|display]] -> target
    target = link_target.split("|")[0].strip()
    if not target:
        return None

    # Wiki-links are relative to wiki root
    resolved = wiki_root / target

    # Try exact path first
    if resolved.is_file():
        return resolved

    # Try with .md extension
    md_path = resolved.with_suffix(".md")
    if md_path.is_file():
        return md_path

    return None


def resolve_md_link(link_target: str, source_file: Path, wiki_root: Path) -> Path:
    """Resolve a [markdown](link) target to an actual file path.

    Markdown links are relative to the source file's directory.
    """
    if not link_target or link_target.startswith(("http://", "https://", "#", "mailto:")):
        return None  # External or anchor links — skip

    # URL-decode for Chinese filenames
    decoded = urllib.parse.unquote(link_target)

    # Markdown links are relative to the source file directory
    source_dir = source_file.parent
    resolved = (source_dir / decoded).resolve()

    if resolved.is_file():
        return resolved

    return None


def strip_code_blocks(content: str) -> str:
    """Remove fenced code blocks and inline code to avoid false positive links."""
    # Remove fenced code blocks (```...```)
    content = re.sub(r'```.*?```', '', content, flags=re.DOTALL)
    # Remove inline code (`...`)
    content = re.sub(r'`[^`]+`', '', content)
    return content


def extract_links(content: str, source_file: Path, wiki_root: Path):
    """Extract all link targets from markdown content.

    Returns:
        wiki_links: set of (raw_target, resolved_path_or_None) for [[]] links
        md_links: set of (raw_target, resolved_path_or_None) for []() links
    """
    wiki_links = set()
    md_links = set()

    # Strip code blocks to avoid false positives
    clean = strip_code_blocks(content)

    # [[wiki-links]] — may contain | for display text
    for match in re.finditer(r'\[\[([^\]]+)\]\]', clean):
        raw = match.group(1)
        target = raw.split("|")[0].strip()
        resolved = resolve_wiki_link(target, source_file, wiki_root)
        wiki_links.add((target, resolved))

    # [markdown](links) — standard markdown
    for match in re.finditer(r'\[([^\]]*)\]\(([^)]+)\)', clean):
        raw_target = match.group(2).strip()
        resolved = resolve_md_link(raw_target, source_file, wiki_root)
        if resolved is not None or not raw_target.startswith(("http://", "https://", "#", "mailto:")):
            md_links.add((raw_target, resolved))

    return wiki_links, md_links


# --- Checks ---

def check_broken_links(wiki_root: Path) -> list[dict]:
    """Find all broken links across the wiki."""
    broken = []

    for md_file in sorted(wiki_root.rglob("*.md")):
        try:
            content = md_file.read_text(encoding="utf-8")
        except Exception as e:
            broken.append({
                "file": str(md_file.relative_to(wiki_root)),
                "error": f"Cannot read file: {e}"
            })
            continue

        wiki_links, md_links = extract_links(content, md_file, wiki_root)

        rel_path = str(md_file.relative_to(wiki_root))

        for raw_target, resolved in wiki_links:
            if resolved is None:
                broken.append({
                    "type": "wiki-link",
                    "file": rel_path,
                    "target": raw_target,
                    "detail": f"[[{raw_target}]] -> file not found"
                })

        for raw_target, resolved in md_links:
            # Skip external links
            if raw_target.startswith(("http://", "https://", "#", "mailto:")):
                continue
            if resolved is None:
                broken.append({
                    "type": "md-link",
                    "file": rel_path,
                    "target": raw_target,
                    "detail": f"[]({raw_target}) -> file not found"
                })

    return broken


def check_tiny_files(wiki_root: Path, threshold: int = TINY_THRESHOLD) -> list[dict]:
    """Find .md files smaller than threshold bytes."""
    tiny = []

    for md_file in sorted(wiki_root.rglob("*.md")):
        try:
            size = md_file.stat().st_size
        except OSError:
            continue

        if size < threshold:
            tiny.append({
                "file": str(md_file.relative_to(wiki_root)),
                "size": size,
                "detail": f"{size}B < {threshold}B threshold"
            })

    return tiny


def check_orphan_pages(wiki_root: Path) -> list[dict]:
    """Find .md pages not referenced by any other page."""
    # Collect all existing pages
    all_pages = set()
    for md_file in wiki_root.rglob("*.md"):
        all_pages.add(md_file)

    # Collect all link targets across all files
    referenced = set()
    for md_file in wiki_root.rglob("*.md"):
        try:
            content = md_file.read_text(encoding="utf-8")
        except Exception:
            continue

        wiki_links, md_links = extract_links(content, md_file, wiki_root)

        for _, resolved in wiki_links:
            if resolved is not None:
                referenced.add(resolved)

        for _, resolved in md_links:
            if resolved is not None:
                referenced.add(resolved)

    orphans = []
    for page in sorted(all_pages):
        rel = str(page.relative_to(wiki_root))
        # Index files are never considered orphans
        if page.name in INDEX_FILES:
            continue
        if page not in referenced:
            orphans.append({
                "file": rel,
                "detail": "not linked from any other page"
            })

    return orphans


# --- Main ---

def main():
    if not WIKI_ROOT.is_dir():
        print(f"ERROR: wiki directory not found: {WIKI_ROOT}")
        sys.exit(2)

    print(f"Wiki Health Check — {WIKI_ROOT.resolve()}")
    print(f"{'=' * 60}")

    # Count files
    md_files = list(WIKI_ROOT.rglob("*.md"))
    print(f"Total .md files: {len(md_files)}")

    exit_code = 0

    # 1. Broken links
    print(f"\n--- Broken Links ---")
    broken = check_broken_links(WIKI_ROOT)
    if broken:
        errors = [b for b in broken if "error" in b]
        link_issues = [b for b in broken if "error" not in b]
        if link_issues:
            print(f"  BROKEN LINKS: {len(link_issues)}")
            for item in link_issues:
                print(f"    [{item['type']}] {item['file']} -> {item['target']}")
            exit_code = 1
        if errors:
            print(f"  READ ERRORS: {len(errors)}")
            for item in errors:
                print(f"    {item['file']}: {item['error']}")
    else:
        print("  OK — no broken links found")

    # 2. Tiny files
    print(f"\n--- Tiny Files (< {TINY_THRESHOLD}B) ---")
    tiny = check_tiny_files(WIKI_ROOT)
    if tiny:
        print(f"  TINY FILES: {len(tiny)}")
        for item in tiny:
            print(f"    {item['file']} ({item['detail']})")
    else:
        print("  OK — no tiny files found")

    # 3. Orphan pages
    print(f"\n--- Orphan Pages ---")
    orphans = check_orphan_pages(WIKI_ROOT)
    if orphans:
        print(f"  ORPHAN PAGES: {len(orphans)}")
        for item in orphans:
            print(f"    {item['file']}")
    else:
        print("  OK — no orphan pages found")

    print(f"\n{'=' * 60}")
    total_issues = len(broken) + len(tiny) + len(orphans)
    print(f"Total issues: {total_issues}")

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
