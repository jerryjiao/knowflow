---
title: Architecture
description: How KnowFlow is put together — from capture to graph.
---

## The overall flow

```text
Input                    Deterministic            You or an AI agent
(URL / tweet / note) ──► capture into raw/ ──► organize into linked wiki pages
                                                    │
                          ┌─────────────────────────┤
                          ▼                         ▼
                    knowledge graph          optional semantic search
                    (graph.html/json)        (vector index + query)
```

Two boundaries define the design:

1. **Capture is deterministic.** `ingest` fetches and stores source material as Markdown under `raw/`. It never calls an LLM and never writes wiki pages.
2. **Organization is yours.** Turning `raw/` into structured pages — manually or with any AI agent — is a separate, visible step. KnowFlow provides templates, health checks, and the graph; the judgment stays with you.

## Repository layout

```text
knowflow/
├── bin/
│   └── knowflow.js          # CLI entry point and command routing
├── scripts/
│   ├── ingest.sh            # single URL/text capture (fetch → raw/)
│   ├── graph_builder.py     # build the knowledge graph from wiki pages
│   ├── wiki-health.sh       # health checks (broken links, small files, orphans)
│   ├── wiki-auto-fix.sh     # repairs behind `knowflow fix`
│   ├── tags-builder.mjs     # tag hub pages behind `knowflow tags`
│   ├── vector-store.mjs     # vector index (embedding + storage) and query
│   ├── batch-ingest.cjs     # batch processing of raw material (legacy)
│   ├── enrich-wiki.js       # wiki post-processing experiments (legacy)
│   ├── graph_relation_labeler.py  # LLM edge-type labeling (optional)
│   ├── pipeline.sh          # chaining helper
│   ├── bookmark_sync.sh     # X/Twitter bookmark sync
│   └── wechat_sync.sh       # WeChat official-account article sync
├── templates/               # editable page templates (entity/concept/comparison/source)
├── docs/                    # architecture, methodology, reference docs
└── package.json
```

The core commands (`init`, `ingest`, `status`, `health`, `fix`, `graph`, `tags`, `query`) are stable and tested. The legacy and sync scripts are helpers from earlier experiments — a first-class agent workflow from raw capture to reviewed pages is on the [roadmap](https://github.com/jerryjiao/knowflow#roadmap).

## Life of a captured URL

1. **Capture.** `knowflow ingest <url>` detects the source type, fetches the full text (Jina Reader for web pages; `yt-dlp` may be needed for some platforms), and stores it under `raw/` with metadata. Nothing else is written.
2. **Organize.** You — or an agent you trust — read the raw file, draft pages from `templates/`, and cross-link them with `[[wikilinks]]`. Every change is a Markdown diff you can review in Git.
3. **Graph.** `knowflow graph` parses every wiki page, resolves `[[wikilink]]` paths, and emits `graph.json` plus the interactive `graph.html` viewer.
4. **Search (optional).** With a Zhipu AI embedding key, pages can be embedded into a local vector index and queried with `knowflow query`.

## Why Markdown instead of a database?

- **Human-readable** — open any page in an editor and it just works
- **Version-control friendly** — Git tracks every change
- **Agent-friendly** — LLMs are naturally good at reading and writing Markdown
- **Portable** — no database service, no lock-in

## Why both a graph and vector search?

| Capability | Knowledge graph | Vector retrieval |
| --- | --- | --- |
| Exact lookup | ✅ by entity/relation | ❌ |
| Semantic search | ❌ | ✅ "similar to X" |
| Discovering connections | ✅ A→B→C paths | ❌ |
| Fuzzy matching | ❌ | ✅ |

The two are complementary. The graph runs locally with zero dependencies; semantic search is optional and off by default.

## Tech stack

| Component | Technology | Why |
| --- | --- | --- |
| CLI runtime | Node.js 18+ | npm ecosystem, familiar to developers |
| Graph builder | Python 3.10+ | mature graph tooling, vis-network rendering |
| Vector index (optional) | Zhipu AI embeddings | local index file, no external service to run |
| Storage | plain files (Markdown/JSON) | zero dependencies, Git-friendly |
