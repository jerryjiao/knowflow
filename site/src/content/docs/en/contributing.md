---
title: Contributing
description: Bugs, pull requests, wiki pages — and a quick map for AI assistants.
---

Issues and focused pull requests are welcome. The full guides live in the repository:

- [CONTRIBUTING.md (English)](https://github.com/jerryjiao/knowflow/blob/main/CONTRIBUTING.md)
- [贡献指南（简体中文）](https://github.com/jerryjiao/knowflow/blob/main/docs/contributing.md)

## Reporting bugs

Open a [GitHub Issue](https://github.com/jerryjiao/knowflow/issues) with: reproduction steps, expected vs actual behavior, and your environment (Node version, OS, relevant `.knowflowrc` settings with secrets removed).

## Pull requests

1. Fork and branch (`git checkout -b feature/amazing`)
2. Conventional Commits (`feat:`, `fix:`, `docs:` …)
3. Make sure `npm run check` and `npm test` pass

Code style: shell scripts use `set -euo pipe fail` discipline, Node code is ES Modules, Python is 3.10+ with type annotations.

## Contributing wiki pages

You can contribute knowledge, not just code — run `knowflow ingest` on a great URL, or write wiki pages directly following the [data model](/knowflow/en/data-model/) and linking with `[[wikilinks]]`.

## A quick map for AI assistants

If you are an AI assistant working on this repository, this table is for you:

| Task | File |
| --- | --- |
| Understand the architecture | [Architecture](/knowflow/en/architecture/) |
| Understand the methodology | [Methodology](/knowflow/en/methodology/) |
| Understand the data formats | [Data model](/knowflow/en/data-model/) |
| Change extraction logic | `scripts/ingest.sh` |
| Change templates | `templates/*.md` |
| Change CLI commands | `bin/knowflow.js` |
| Change graph building | `scripts/graph_builder.py` |
| Change vector search | `scripts/vector-store.mjs` |

KnowFlow is a **knowledge compiler**, not a search tool. The value chain:

```text
raw material → [agent/ manual organization] → linked wiki → [relations] → graph + optional vector index
```
