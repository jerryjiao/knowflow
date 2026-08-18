# KnowFlow

<p align="left"><img src="docs/assets/logo.png" width="120" alt="KnowFlow logo"></p>

[English](README.md) | [简体中文](README.zh-CN.md) | [Website & docs](https://jerryjiao.github.io/knowflow/)

[![CI](https://github.com/jerryjiao/knowflow/actions/workflows/ci.yml/badge.svg)](https://github.com/jerryjiao/knowflow/actions/workflows/ci.yml)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

![KnowFlow — an agent-native Markdown knowledge workspace](docs/assets/knowflow-social-preview.png)

> An agent-native Markdown knowledge workspace for capturing sources, organizing linked wiki pages, and exploring what you know.

KnowFlow keeps the workflow inspectable: URLs and notes land in `raw/`, you or an AI agent turn them into structured Markdown pages, and local tools build a knowledge graph, check wiki health, and report project status. Optional semantic search is available when you configure an embedding API key.

- **Own the knowledge layer** — plain Markdown, editable templates, and `[[wikilinks]]` instead of a closed database.
- **Work with any agent** — keep capture deterministic, then use the agent or workflow you trust for synthesis.
- **See structure, not just search results** — generate an interactive graph and catch broken or isolated pages.

> **Demo:** [Run the text-to-graph walkthrough](examples/quickstart.md), then explore the generated graph in your browser.

![KnowFlow interactive knowledge graph](docs/assets/knowflow-graph-demo.png)

## Quick start

Requires Node.js 18+, Python 3.10+, Bash, and curl.

The package is not yet published to npm, so start from a source checkout ([details below](#install-from-source)):

```bash
git clone https://github.com/jerryjiao/knowflow.git
cd knowflow
npm install && npm link
knowflow init my-wiki
cd my-wiki
knowflow ingest "LLM Wikis turn notes into linked knowledge." --source text
knowflow status
knowflow graph --no-open
```

This creates a standalone project, captures one note in `raw/`, and builds a graph from the starter Wiki. **`ingest` does not automatically generate structured Wiki pages.** Organize captured material manually or with an AI agent/workflow before rebuilding the graph.

Once the package is published, `npx knowflow@latest <command>` will work directly.

## The workflow

```text
URL or note
    │
    ▼
raw/ Markdown ──► you, an AI agent, or a custom workflow
                         │
                         ▼
                 linked Wiki pages
                    │         │
                    ▼         ▼
             knowledge graph  optional semantic search
```

KnowFlow is inspired by [Andrej Karpathy's LLM Wiki](https://karpathy.github.io/llm-wiki/): knowledge becomes more useful when it is curated into durable, connected pages instead of being left in a pile of saved links.

## What is included

- Capture plain text and supported URLs as raw Markdown.
- Initialize portable projects with JSON configuration and editable page templates.
- Organize source, entity, concept, and comparison pages with `[[wikilinks]]`.
- Generate `graph.html` and `graph.json` without an API key.
- Check broken links, undersized files, and isolated pages.
- Repair empty links, create missing pages, pad small files, and link orphans.
- Query a previously built vector index with optional Zhipu AI embeddings.

## Commands

| Command | What it does |
| --- | --- |
| `knowflow init [directory]` | Create a standalone project; defaults to the current directory |
| `knowflow ingest <url-or-text>` | Capture a URL or text in `raw/` |
| `knowflow graph [--no-open]` | Generate `graph.html` and `graph.json` from Wiki pages |
| `knowflow fix [--dry-run]` | Repair empty links, missing pages, small files, and orphans |
| `knowflow health` | Check broken links, small files, and isolated pages |
| `knowflow tags` | Build `tag/<name>.md` hub pages from `[[tag/<name>]]` links |
| `knowflow status` | Show raw, Wiki, graph, vector-index, and API-key status |
| `knowflow query <text>` | Query an existing vector index |

KnowFlow searches upward from the current directory for the nearest `.knowflowrc`, so commands also work inside project subdirectories.

## Install from source

```bash
git clone https://github.com/jerryjiao/knowflow.git
cd knowflow
npm install
npm link
knowflow init ../my-wiki
```

Running `init` again preserves existing configuration, the starter index, and customized templates.

## Project layout

```text
my-wiki/
├── .knowflowrc
├── raw/                 # captured source material
├── wiki/
│   ├── index.md
│   ├── sources/
│   ├── entities/
│   ├── concepts/
│   └── comparisons/
├── graph/               # generated graph.html and graph.json
└── templates/           # editable Markdown templates
```

## Configuration

`knowflow init` writes a JSON `.knowflowrc`. Relative paths resolve from the directory containing that file.

```json
{
  "wiki": {
    "root": "./wiki",
    "rawDir": "./raw"
  },
  "graph": {
    "output": "./graph/graph.html"
  },
  "health": {
    "minFileSize": 100,
    "excludeOrphanDirs": ["sources/"]
  }
}
```

`health.excludeOrphanDirs` lists directories whose pages are expected to be unreferenced (daily-sync feeds, inboxes) and should not count as isolated pages. `knowflow tags` regenerates every hub page under `wiki/tag/`, so re-running it after new tagged pages arrive is safe and idempotent.

Graph generation, health checks, capture, and status do not require an API key. Semantic search requires `ZHIPUAI_API_KEY` in the project environment or a project-root `.env` file:

```bash
ZHIPUAI_API_KEY=your-key-here
```

The current CLI can query an existing vector index but does not yet expose a standalone `index` command. See [Current limitations](#current-limitations) before relying on search.

## Current limitations

- `ingest` captures raw material; structured Wiki synthesis is a separate human or agent step.
- URL capture uses Jina Reader. YouTube and some logged-in platforms may also require `yt-dlp` or an authenticated browser workflow.
- `query` needs a prebuilt vector index and a [Zhipu AI API key](https://open.bigmodel.cn/). Until an `index` CLI command is added, advanced users can run `node <knowflow-install>/scripts/vector-store.mjs build`.
- `bookmark_sync.sh` depends on the optional third-party `ft` command.
- Generated graph HTML loads vis-network from a CDN when opened.

## Roadmap

- [x] Standalone project initialization and portable paths
- [x] Raw URL/text capture, Wiki health checks, and interactive graphs
- [x] CLI tests and CI across supported Node.js versions
- [ ] A first-class agent workflow from raw capture to reviewed Wiki pages
- [ ] Incremental ingestion and duplicate-source detection
- [ ] `knowflow index` and pluggable embedding providers
- [ ] Extractor/plugin system and a local Web UI

Ideas and focused pull requests are welcome. Start with the [contribution guide](CONTRIBUTING.md), run the [text-to-graph example](examples/quickstart.md), or propose a use case in [GitHub Issues](https://github.com/jerryjiao/knowflow/issues).

## Development

```bash
npm install
npm run check
npm test
npm pack --dry-run
```

See the [changelog](CHANGELOG.md) for release notes and the [security policy](SECURITY.md) for responsible disclosure.

## License

[MIT](LICENSE) © [Jerry Jiao](https://github.com/jerryjiao)
