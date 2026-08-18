---
title: Commands
description: All eight KnowFlow commands — options, behavior, and exit codes.
---

KnowFlow is a single `knowflow` CLI. Commands search upward from the current directory for the nearest `.knowflowrc` to locate the project root, so they also work from inside project subdirectories.

| Command | What it does |
| --- | --- |
| [`init`](#init) | Create a standalone project |
| [`ingest`](#ingest) | Capture a URL or text into `raw/` |
| [`status`](#status) | Show project statistics and index states |
| [`health`](#health) | Check broken links, small files, and orphans |
| [`fix`](#fix) | Repair the issues `health` finds |
| [`graph`](#graph) | Build the interactive knowledge graph |
| [`tags`](#tags) | Rebuild tag hub pages |
| [`query`](#query) | Hybrid semantic search (optional) |

## init

```bash
knowflow init [directory]
```

Creates a standalone project (defaults to the current directory):

- `.knowflowrc` — JSON configuration, only written if it does not exist yet
- `wiki/` with `sources/`, `entities/`, `concepts/`, `comparisons/` subdirectories and a starter `index.md`
- `raw/` with `web/`, `twitter/`, `xiaohongshu/`, `wechat/` subdirectories
- `graph/` output directory
- `templates/` — the editable Markdown page templates, copied from the package

Running `init` again preserves existing configuration, the starter index, and customized templates.

## ingest

```bash
knowflow ingest <url-or-text> [--source <type>]
```

Captures a URL or a plain-text note into `raw/` as Markdown. `--source` (`-s`) defaults to `auto`, which detects the source type; use `text` for plain text.

Details worth knowing:

- URL capture uses [Jina Reader](https://jina.ai/reader/); YouTube and some logged-in platforms may also require `yt-dlp` or an authenticated browser workflow.
- **`ingest` does not synthesize wiki pages.** It only stores the source material. Organizing captured material — manually or with an AI agent — is a separate, visible step. This boundary is deliberate.

## status

```bash
knowflow status
```

Prints a project overview: wiki article and line counts, raw material count, vector index state (pages embedded), graph node/edge counts, and whether an API key is configured. Requires no API key.

## health

```bash
knowflow health
```

Checks the wiki for:

- **Broken links** — `[[wikilinks]]` and `[markdown](links.md)` pointing at missing files
- **Small files** — pages below `health.minFileSize` bytes (default 100)
- **Orphan pages** — pages no other page links to, excluding directories listed in `health.excludeOrphanDirs`

Exits with code `1` when issues are found, so it can gate CI or agent workflows. Run [`fix`](#fix) to repair what it reports.

## fix

```bash
knowflow fix [--dry-run]
```

Repairs the issues `health` surfaces:

- Cleans empty links such as `[[entities/,]]`
- Creates missing entity/concept pages that links point to
- Pads files below the minimum size
- Auto-links orphan pages to `index.md`

`--dry-run` reports everything that would change without writing.

## graph

```bash
knowflow graph [--no-open]
```

Parses every wiki page, extracts `[[wikilink]]` relationships, and writes `graph.html` (interactive viewer, loads vis-network from a CDN) plus `graph.json` (raw data). No API key required. Opens the viewer in your browser unless `--no-open` is passed.

## tags

```bash
knowflow tags
```

Scans every wiki page for `[[tag/<name>]]` links and (re)builds hub pages at `wiki/tag/<name>.md` that index all pages carrying the tag. The rebuild is full and idempotent — safe to re-run whenever new tagged pages arrive.

## query

```bash
knowflow query <text> [--top <n>]
```

Hybrid retrieval (vector search + keyword matching) over the wiki. `--top` (`-n`) controls result count (default 5, range 1–100).

Prerequisites:

- A [Zhipu AI](https://open.bigmodel.cn/) API key, via the `ZHIPUAI_API_KEY` environment variable or a project-root `.env` file
- A prebuilt vector index. The CLI does not yet expose an `index` command; until it does, advanced users can build one with `node <knowflow-install>/scripts/vector-store.mjs build`

## Configuration

`knowflow init` writes a JSON `.knowflowrc`. All relative paths resolve from the directory containing that file.

```json
{
  "wiki": { "root": "./wiki", "rawDir": "./raw" },
  "graph": { "output": "./graph/graph.html" },
  "health": { "minFileSize": 100, "excludeOrphanDirs": ["sources/"] }
}
```

- `health.excludeOrphanDirs` — directories whose pages are expected to be unreferenced (daily-sync feeds, inboxes) and should not count as orphans
- `wiki.root` / `wiki.rawDir` / `graph.output` — custom locations for the wiki, raw layer, and graph output

Graph generation, health checks, capture, and status never require an API key. Only `query` does.
