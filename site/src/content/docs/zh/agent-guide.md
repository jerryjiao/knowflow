---
title: 配合 AI 助手使用
description: 核心玩法——AI 助手负责整理，你负责把关。
---

你从来不需要自己动手整理——这正是 KnowFlow 的意义：让一个能读写文件的 AI 助手（Claude、Cursor、Codex，任何都行）起草，把判断权留给你。

## 循环长这样

```text
你保存 ──► raw/ ──► AI 助手起草 wiki 页面 ──► 你审核 ──► 图谱
             │                        │
             └───── 这一层它永远碰不到 ──────┘
```

1. **存。** 把文章、推文、笔记存进 `raw/`——自己跑 `knowflow ingest`，或者直接让 AI 助手代跑。
2. **理。** 助手读原始素材、选对页面类型、按 `templates/` 起草页面、用 `[[wikilinks]]` 互联。
3. **审。** 你过目它写的东西。如果项目用了 Git，每次整理就是一份 diff——随便改，或让它再改一轮。
4. **验、看。** `knowflow health` 抓断链和孤儿页，`knowflow graph` 重建地图。

## 一段可直接粘贴的提示词

把下面这段给你的 AI 助手就能跑起来（按口味微调）：

```text
你是我 KnowFlow 知识库的图书管理员，工作目录是本项目根目录。

规则：
- raw/ 不可变，永远不要修改 raw/ 里的任何文件。
- 新页面按 templates/ 里的模板写进 wiki/entities/、wiki/concepts/、
  wiki/comparisons/ 或 wiki/sources/。
- 页面互联用 [[wikilinks]]，写从 wiki 根出发的路径，例如
  [[concepts/rag]] 或 [[entities/openai|OpenAI]]；话题标签写 [[tag/<名称>]]。
- 起草完成后运行 knowflow health，把它报告的问题修掉。

任务：读 raw/ 里还没有对应 wiki/sources/ 页面的最新文件，起草页面，
最后汇报你创建了什么、建了哪些链接，供我审核。
```

## 一个完整的例子

假设你存了一篇讲检索增强生成（RAG）的文章：

- 助手创建 `wiki/sources/rag-article.md`——记录出处，附一段短摘要。
- 它发现文章讨论了 **RAG** 和**向量检索**，于是创建或更新 `wiki/concepts/rag.md` 和 `wiki/concepts/vector-search.md`。
- 这些页面互相链接（`[[concepts/vector-search]]`），也链回来源页（`[[sources/rag-article]]`）。
- 下个月另一篇文章再提到 RAG——助手会**更新**已有的概念页而不是建重复页，图谱越长越密。

## 几条经验

- **小批量。** 让助手每次处理一小撮 raw 文件，而不是一百篇——审核才快得起来。
- **先试运行再修复。** `health` 报问题时，让助手先跑 `knowflow fix --dry-run` 给你看它想改什么。
- **助手随便换。** 约定都在你的文件里（模板、wikilinks），不在任何一家 AI 身上。换助手，一切照旧。
- **开着 Git。** 项目如果是 Git 仓，`git diff` 就是你的审核界面——每一轮整理都是可读、可回滚的 diff。
