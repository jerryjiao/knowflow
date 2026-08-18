---
title: Use with an AI assistant
description: The core workflow — your assistant organizes, you stay in charge.
---

You never have to organize anything yourself. That is the point of KnowFlow: an AI assistant that can read and write files (Claude, Cursor, Codex, anything) does the drafting, and you keep the judgment.

## The loop

```text
you save ──► raw/ ──► assistant drafts wiki pages ──► you review ──► graph
              │                                          │
              └──────── it never touches this ───────────┘
```

1. **Capture.** Save an article, tweet, or note into `raw/` — by running `knowflow ingest`, or just by asking your assistant to do it.
2. **Organize.** The assistant reads the raw material, picks the right page types, drafts pages from `templates/`, and cross-links them with `[[wikilinks]]`.
3. **Review.** You look over what it wrote. If you use Git, every change is a diff. Edit freely, or ask for another pass.
4. **Validate & see.** `knowflow health` catches broken links and orphans. `knowflow graph` rebuilds the map.

## A prompt that works

Paste this into your assistant to bootstrap it (adjust to taste):

```text
You are the librarian of my KnowFlow wiki. Work in this project directory.

Rules:
- raw/ is immutable. Never edit anything in raw/.
- New pages go in wiki/entities/, wiki/concepts/, wiki/comparisons/, or
  wiki/sources/, following the templates in templates/.
- Link pages with [[wikilinks]] written as paths from the wiki root,
  e.g. [[concepts/rag]] or [[entities/openai|OpenAI]]. Tag topics as [[tag/<name>]].
- When you finish drafting, run `knowflow health` and fix what it reports.

Task: read the newest files in raw/ that have no corresponding page under
wiki/sources/ yet. Draft the pages, then report a summary of what you created
and which links you made, so I can review.
```

## A worked example

Say you saved an article about retrieval-augmented generation:

- The assistant creates `wiki/sources/rag-article.md` — a record of where it came from, with a short summary.
- It notices the article discusses **RAG** and **vector search**, so it creates or updates `wiki/concepts/rag.md` and `wiki/concepts/vector-search.md`.
- Those pages link to each other (`[[concepts/vector-search]]`) and back to the source (`[[sources/rag-article]]`).
- Next month, another article mentions RAG again — the assistant *updates* the existing concept page instead of creating a duplicate, and the graph grows denser.

## Tips

- **Small batches.** Have the assistant process a handful of raw files per pass, not a hundred — review stays quick.
- **Dry-run repairs.** If `health` complains, let the assistant run `knowflow fix --dry-run` first and show you what it would change.
- **Swap assistants freely.** The conventions live in your files (templates, wikilinks), not in any one AI. Switching assistants changes nothing.
- **Keep Git on.** If your project is a Git repo, `git diff` is your review screen — every organizing pass is a readable, revertable diff.
