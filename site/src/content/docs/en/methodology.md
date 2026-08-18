---
title: Methodology
description: Why compiled, linked wiki pages beat a pile of saved links — the LLM Wiki idea behind KnowFlow.
---

> Based on Andrej Karpathy's [LLM Wiki](https://karpathy.github.io/llm-wiki/) — KnowFlow is an engineering attempt at that idea.

## The core problem

Every mainstream answer to "how do I keep what I learn?" fails the same way:

| Approach | Problem |
| --- | --- |
| **Bookmarks / read-later** | The "saved = learned" illusion (Collector's Fallacy) |
| **Note apps** | Solve storing, not organizing or connecting |
| **Plain RAG** | Search from scratch every time — no memory, no accumulation |

## The core insight

> **Stop digging through the original documents every time. Compile the knowledge once, keep it ready, and reuse it.**

An analogy:

- **RAG is a temp worker** — every question sends it scrambling through the filing cabinet, stapling scraps into an answer, remembering nothing for next time.
- **An LLM Wiki is a full-time librarian** — it spends its time extracting information, finding connections, building indexes, and maintaining a knowledge graph. When you ask, it retrieves.

## Three layers

### 1. Raw layer — the material

Everything you feed in: articles, tweets, PDFs, WeChat posts, YouTube transcripts, notes.

**Rule:** the raw layer is immutable storage. Capture never rewrites it.

### 2. Wiki layer — the compiled knowledge

Structured, linked pages built from the raw layer:

- **Entity pages** — concrete things: people, companies, projects
- **Concept pages** — abstract ideas: methods, techniques, patterns
- **Comparison pages** — systematic A-vs-B comparisons
- **Source pages** — traceable records of where knowledge came from

The key property: pages **link to each other**. Mention a concept and it points at that concept's page. Over time, the wiki becomes a living network — not a flat pile of snippets.

### 3. Schema layer — the rules

The "job manual" that tells any agent how to compile: what to extract, what to ignore, page formats, linking policy. In KnowFlow this is simply the templates and this documentation — inspectable, versioned Markdown.

## Why this beats plain RAG

```text
RAG:
  question → search raw documents → staple an answer → forget everything

LLM Wiki:
  new content → compiled into wiki pages → linked → graph updated
  question → retrieve from compiled knowledge → answer with full context
```

1. **It has memory** — knowledge accumulates instead of restarting from zero
2. **It has structure** — entities, concepts, comparisons — not flat fragments
3. **It's explorable** — the graph surfaces connections you didn't search for
4. **It's verifiable** — every page traces back to sources

## Where KnowFlow fits

KnowFlow is an open-source implementation of this methodology:

- A CLI that keeps capture deterministic and the raw layer immutable
- Templates that define the schema layer
- Local tools for the graph, health checks, and optional vector search
- The synthesis step deliberately left to you or the agent you trust — because that is where judgment lives

**The core belief:** the most interesting part is not the final tool — it is watching scattered information turn into structured knowledge, one page at a time.
