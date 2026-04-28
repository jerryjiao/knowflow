# KnowFlow 🧠

> **AI-Powered Knowledge Wiki System** — Turn URLs, tweets, PDFs, and bookmarks into an interconnected wiki with knowledge graphs & vector search.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[npm](https://www.npmjs.com/package/knowflow)

## ✨ What is KnowFlow?

KnowFlow is a personal knowledge management system inspired by [Andrej Karpathy's LLM Wiki idea](https://karpathy.github.io/llm-wiki/). It automatically:

1. **Ingests** content from URLs, tweets, PDFs, and more
2. **Extracts** entities, concepts, and relationships using LLMs
3. **Generates** interconnected Wiki pages with auto-linking
4. **Builds** a knowledge graph visualization
5. **Indexes** everything for semantic (vector) search

All powered by open-source LLMs — no OpenAI API key required.

## 🚀 Quick Start

```bash
# Install (requires Node.js 18+)
npx knowflow@latest init my-wiki

# Ingest a URL
cd my-wiki
npx knowflow ingest https://karpathy.github.io/llm-wiki/

# Ask questions
npx knowflow query "What is RAG and how does it differ from LLM Wiki?"
```

### Prerequisites

- **Node.js** >= 18
- **Python** >= 3.10 (for knowledge graph & vector store)
- A ZhipuAI API key ([free tier available](https://open.bigmodel.cn/))

## 📖 Architecture

```
┌─────────────┐    ┌─────────────┐    ┌──────────────┐
│   Raw Layer  │───▶│   Wiki Layer │──▶│  Schema Layer │
│  (URLs, PDFs,│    │ (Entities,   │    │ (Extraction   │
│   Tweets)    │    │  Concepts,   │    │  Rules)       │
│              │    │  Comparisons)│    │               │
└─────────────┘    └──────┬───────┘    └───────────────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │ Knowledge│ │  Vector  │ │  Graph   │
       │  Graph   │ │  Store   │ │Visualize │
       └──────────┘ └──────────┘ └──────────┘
```

## 📁 Project Structure

```
knowflow/
├── bin/knowflow.js          # Main CLI entry point
├── scripts/
│   ├── ingest.sh            # Single URL ingestion pipeline
│   ├── batch-ingest.js      # Batch processing
│   ├── graph_builder.py     # Knowledge graph builder
│   ├── vector-store.mjs     # Vector search index
│   ├── pipeline.sh          # Full automation pipeline
│   └── bookmark_sync.sh     # X/Twitter bookmark sync
├── templates/               # Wiki page templates
│   ├── entity.md            # Entity pages (people, projects)
│   ├── concept.md           # Concept pages (RAG, Embedding)
│   ├── comparison.md        # Comparison pages (A vs B)
│   └── source.md            # Source reference pages
├── docs/                    # Documentation
├── articles/                # Blog posts / tutorials
└── package.json
```

## 🔧 Configuration

Copy `.knowflowrc.example` to `.knowflowrc` and configure:

```yaml
llm:
  provider: "zhipuai"        # LLM provider (zhipuai / openai)
  model: "glm-4-flash"       # Model for extraction

wiki:
  root: ./wiki               # Output directory for wiki pages
  raw_dir: ./raw             # Stored raw content

graph:
  output: ./graph/graph.html # Knowledge graph visualization
```

## 📚 Articles & Tutorials

The `articles/` directory contains a 6-part blog series about building KnowFlow:

1. **[P1] 概念篇** — Why we need LLM Wiki (`articles/P1-概念篇-你的收藏夹从未被打开过.md`)
2. **[P2] 项目故事** — How I built it in 2 weeks (`articles/P2-项目故事-我花了两周做了一个AI知识库.md`)
3. **[P3] 教程上]** — From URL to Wiki: Step 1 (`articles/P3-教程上-从URL到知识库第一步怎么做.md`)
4. **[P4] 教程下]** — Knowledge Graph + Vector Search (`articles/P4-教程下-知识图谱与向量检索.md`)
5. **[P5] 开源指南** — 3-min setup + 10 gotchas (`articles/P5-开源指南-3分钟上手与10个踩坑.md`)
6. **[P6] 展望篇** — Reflections on AI knowledge management (`articles/P6-展望篇-做完之后对AI知识管理的思考.md`)

## 🤝 Contributing

PRs welcome! See the [articles](./articles/) for context on the project's goals and design decisions.

## 📄 License

MIT © [Jerry Jiao](https://github.com/jerryjiao)

---

> 💡 **Inspired by** [Karpathy's LLM Wiki Gist](https://karpathy.github.io/llm-wiki/) — the idea that knowledge should be *compiled*, not just *stored*.
