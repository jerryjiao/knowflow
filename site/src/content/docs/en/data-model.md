---
title: Data model
description: Page types, wikilink syntax, and the file formats KnowFlow reads and writes.
---

## Project layout

```text
my-wiki/
├── .knowflowrc           # JSON configuration
├── raw/                  # captured source material (immutable)
├── wiki/
│   ├── index.md          # navigation entry point
│   ├── sources/          # source pages
│   ├── entities/         # entity pages (people, companies, projects)
│   ├── concepts/         # concept pages (methods, techniques)
│   ├── comparisons/      # comparison pages (A vs B)
│   └── tag/              # generated tag hub pages
├── graph/                # generated graph.html and graph.json
└── templates/            # editable Markdown templates
```

## Page types

Templates live in `templates/` and are plain Markdown — edit them to change the shape of generated or agent-drafted pages.

### Entity page (`entities/*.md`)

Concrete "things": people, companies, projects, products.

```markdown
# {name}

**Type**: {person | organization | project | product}
**First seen**: {date}

## Summary
{one paragraph}

## Key facts
- {field}: {value}

## Related
- [[concepts/{Concept}]]
- [[entities/{OtherEntity}]] — {relationship}
```

### Concept page (`concepts/*.md`)

Abstract ideas and methods.

```markdown
# {name}

**Category**: {methodology | technology | framework | pattern}

## Definition
{1–3 sentence definition}

## Core points
1. **{Point}** — {explanation}

## Relations
- **Parent**: [[concepts/{ParentConcept}]]
- **Compare**: [[comparisons/{a-vs-b}]]
```

### Comparison page (`comparisons/*.md`)

Systematic side-by-side comparisons.

```markdown
# {A} vs {B}

## Overview
{one sentence on the positioning difference}

| Dimension | {A} | {B} |
| --- | --- | --- |
| ... | ... | ... |

## Related
- [[entities/{RelatedEntity}]]
```

### Source page (`sources/*.md`)

Structured records of captured material.

```markdown
# {title}

**Original**: {url}
**Captured**: {date}

## Summary
{2–3 sentences}

## Extracted
- [[entities/{Entity1}]]
- [[concepts/{Concept1}]]
```

## Wikilink syntax

`[[wikilinks]]` are resolved as **paths from the wiki root** (relative to `wiki.root`):

```markdown
[[concepts/rag]]              → wiki/concepts/rag.md
[[entities/openai|OpenAI]]    → wiki/entities/openai.md, displayed as "OpenAI"
[[tag/rag]]                   → wiki/tag/rag.md (tag hub, see `knowflow tags`)
```

- The `|display` part changes the visible text and is optional.
- Links are case-sensitive file paths — `[[concepts/RAG]]` and `[[concepts/rag]]` are different links.
- `knowflow health` reports wikilinks (and standard Markdown links) that point at missing files; `knowflow fix` can create the missing pages or clean up empty links.

## Generated formats

### graph.json

```json
{
  "nodes": [
    { "id": "knowflow", "label": "KnowFlow", "type": "project", "size": 15 },
    { "id": "rag", "label": "RAG", "type": "concept", "size": 10 }
  ],
  "edges": [
    { "source": "knowflow", "target": "rag", "label": "alternative_to" }
  ]
}
```

Node ids are wiki paths; edges come from `[[wikilinks]]` between pages.

### .knowflowrc

```json
{
  "wiki": { "root": "./wiki", "rawDir": "./raw" },
  "graph": { "output": "./graph/graph.html" },
  "health": { "minFileSize": 100, "excludeOrphanDirs": ["sources/"] }
}
```

Valid JSON only; all relative paths resolve from the file's directory.

### wiki/.vector-index.json

The optional vector index written by `scripts/vector-store.mjs build` and reported by `knowflow status` (page count, embedded count). Queries via `knowflow query` require `ZHIPUAI_API_KEY`.

### State files

`.ingest-state.json` and `.bookmark-state.json` track which raw files and bookmarks have been processed, enabling incremental syncs. They are per-project, gitignored by default.
