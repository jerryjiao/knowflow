---
title: Quickstart
description: From zero to an interactive knowledge graph in a few commands.
---

**Requirements:** Node.js 18+, Python 3.10+, Bash, and curl.

The package is not yet published to npm, so this guide starts from a source checkout. Once it is published, `npx knowflow@latest <command>` works directly and you can skip the install step.

## 1. Install from source

```bash
git clone https://github.com/jerryjiao/knowflow.git
cd knowflow
npm install
npm link
```

## 2. Create a project and capture a note

```bash
knowflow init my-wiki
cd my-wiki
knowflow ingest "LLM Wikis turn notes into linked knowledge." --source text
```

The note now exists under `raw/web/`. It has **not** been converted into a structured wiki page — that boundary is intentional and is the core of KnowFlow's design.

## 3. Organize two wiki pages

This manual step is exactly where an AI agent or a custom workflow fits in: it can read `raw/`, draft pages from the templates in `templates/`, and ask for your review. Here we do it by hand to show the shape.

Create `wiki/concepts/linked-knowledge.md`:

```markdown
# Linked knowledge

Linked knowledge connects durable concepts to the sources that support them.

## Connections

- [[index]]
- [[sources/capture-example]]
```

Then create `wiki/sources/capture-example.md`:

```markdown
# Capture example

This source page records the note captured during the quickstart.

## Connections

- [[concepts/linked-knowledge]]
```

Note the link syntax: `[[wikilinks]]` resolve as **paths from the wiki root**, so a concept page is `[[concepts/linked-knowledge]]`, not `[[Linked knowledge]]`.

## 4. Validate and build the graph

```bash
knowflow health
knowflow status
knowflow graph --no-open
```

Expected outputs:

- `graph/graph.html` — the interactive graph viewer (loads vis-network from a CDN on first open)
- `graph/graph.json` — graph data you can feed to other tools
- `graph/.graph-state.json` — graph build state

![The KnowFlow interactive knowledge graph](/knowflow/graph-demo.png)

## Where to go next

- [Command reference](/knowflow/en/commands/) — all eight commands with options and exit codes
- [Data model](/knowflow/en/data-model/) — page types and the `[[wikilink]]` syntax in detail
- [Methodology](/knowflow/en/methodology/) — why compiled wiki pages beat a pile of saved links
