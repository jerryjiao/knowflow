---
title: FAQ
description: Quick answers to the questions people actually ask.
---

## Does `ingest` write wiki pages for me?

No — and that is deliberate. Capture stores what you saved, unchanged. Organizing is a separate step done by you or, better, [your AI assistant](/knowflow/en/agent-guide/). Every word that enters your knowledge base is one you can see and approve.

## Do I need to be a programmer?

You need a terminal for installing and running the commands, but you can delegate all of it — including running those commands — to an AI assistant. Most non-technical users live in the [assistant workflow](/knowflow/en/agent-guide/) and never touch a script. A one-line `npx knowflow@latest` install is coming with the npm release.

## Do I need an API key?

Only for semantic search, which is optional and off by default. Capture, graphs, health checks, and tag hubs all run without any key.

## Which AI assistants work?

Anything that can read and write files on your machine: Claude Code, Cursor, Codex, and friends. KnowFlow has no API lock-in — the conventions (templates, `[[wikilinks]]`) live in your files.

## Is my data private?

Yes. KnowFlow runs entirely on your machine. The only network calls are fetching a URL you explicitly save — and, if you opt into semantic search, an embedding API. Both are visible in the code.

## Can I use it with Obsidian?

Yes. The `wiki/` folder is plain Markdown with `[[wikilinks]]` — open it as an Obsidian vault and everything just works. KnowFlow adds the parts Obsidian doesn't have: capture, health checks, and generated graph data. (KnowFlow resolves links as paths from the wiki root, so write `[[concepts/rag]]`, not `[[RAG]]`.)

## Why not just run RAG over my saved links?

RAG re-reads the raw pile from scratch for every question. KnowFlow compiles saves into durable, linked pages that accumulate over time — the cross-links and graph exist before you ever ask. The [methodology page](/knowflow/en/methodology/) explains the difference.

## Why Markdown files instead of a database?

Because you should be able to leave. Files stay readable forever, version-control cleanly with Git, and can be processed by any tool — including AI assistants.

## When is it on npm?

Soon. Until then, [install from source](/knowflow/en/quickstart/) — three commands, or ask your assistant to do it.

## What does it cost?

Nothing. KnowFlow is MIT-licensed open source. The only possible cost is the embedding API if you enable semantic search.
