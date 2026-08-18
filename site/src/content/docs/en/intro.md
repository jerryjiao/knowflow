---
title: Introduction
description: What KnowFlow is in plain words, what it deliberately is not, and where it is heading.
---

KnowFlow turns the articles and notes you save into a linked knowledge base. Your AI assistant does the organizing; every page is a plain Markdown file you own.

If you have a bookmarks folder full of "read later" links, KnowFlow is the tool that finally makes them useful.

## What it is

- **A place for everything you save.** Articles, tweets, notes — captured as-is, unchanged, in a `raw/` folder.
- **A wiki that builds itself — with your supervision.** An AI assistant you choose (Claude, Cursor, anything that can read and write files) turns raw saves into linked pages: entities, concepts, comparisons.
- **A map of what you know.** The links between pages weave an interactive graph you can explore.

## What it is not

- **Not a one-command "AI writes your knowledge base" machine.** The assistant drafts; you review. That boundary is the product.
- **Not a note-taking app.** There is no editor UI (yet). Your editor, file manager, or Obsidian works fine — everything is plain Markdown.
- **Not a cloud service.** It runs on your machine. Nothing leaves it unless you opt into semantic search.

## Who it is for

- People who save lots of links and feel the pile growing faster than their memory
- PKM folks (Obsidian/Notion users) who want their base to *build itself* instead of demanding manual gardening
- Anyone already living with an AI assistant who'd rather delegate the organizing than the judgment

## How to read these docs

| Page | For |
| --- | --- |
| [Quickstart](/knowflow/en/quickstart/) | Everyone — a three-command walkthrough |
| [Use with an AI assistant](/knowflow/en/agent-guide/) | Everyone — the core workflow, no scripting |
| [Commands](/knowflow/en/commands/) | Reference for every command |
| [Architecture](/knowflow/en/architecture/) & [Data model](/knowflow/en/data-model/) | The technically curious |
| [Methodology](/knowflow/en/methodology/) | The "why" behind the design |
| [FAQ](/knowflow/en/faq/) | Quick answers |

## Current limitations

- URL capture relies on Jina Reader; YouTube and some logged-in platforms may need extra tooling.
- Semantic search needs a prebuilt vector index — the `knowflow index` command is not out yet.
- The first-class "agent reads raw → drafts pages → you review" loop works today, but is not yet packaged as a single built-in workflow.

See the [roadmap in the README](https://github.com/jerryjiao/knowflow#roadmap) for what's planned.
