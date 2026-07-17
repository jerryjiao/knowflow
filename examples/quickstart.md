# KnowFlow text-to-graph quickstart

This walkthrough is deterministic and does not fetch a URL or require an API key. It demonstrates the real boundary between raw capture and Wiki organization.

## 1. Create a project and capture a note

```bash
npx knowflow@latest init knowflow-demo
cd knowflow-demo
npx knowflow ingest "Linked notes become more useful when concepts point to sources." --source text
```

If you installed KnowFlow from a source checkout with `npm link`, replace `npx knowflow` with `knowflow` in every command.

The note now exists under `raw/web/`. It has **not** been converted into a structured Wiki page.

## 2. Organize one Wiki page

Create `wiki/concepts/linked-knowledge.md` with this content:

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

This source page records the note captured during the KnowFlow quickstart.

## Connections

- [[concepts/linked-knowledge]]
```

This manual step is exactly where an AI agent or custom workflow can read `raw/`, draft pages from the included templates, and ask for review.

## 3. Validate and build the graph

```bash
npx knowflow health
npx knowflow status
npx knowflow graph --no-open
```

Expected outputs:

- `graph/graph.html` — interactive graph viewer
- `graph/graph.json` — graph data for other tools
- `graph/.graph-state.json` — graph build state

Open `graph/graph.html` in a browser. The viewer loads vis-network from a CDN, so the first view requires a network connection.
