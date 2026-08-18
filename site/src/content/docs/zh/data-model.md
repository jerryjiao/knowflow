---
title: 数据模型
description: 页面类型、wikilink 语法，以及 KnowFlow 读写的数据格式。
---

## 项目目录

```text
my-wiki/
├── .knowflowrc           # JSON 配置
├── raw/                  # 采集的原始素材（不可变）
├── wiki/
│   ├── index.md          # 导航入口
│   ├── sources/          # 来源页
│   ├── entities/         # 实体页（人物、公司、项目）
│   ├── concepts/         # 概念页（方法论、技术）
│   ├── comparisons/      # 对比页（A vs B）
│   └── tag/              # 生成的 tag 聚合页
├── graph/                # 生成的 graph.html 和 graph.json
└── templates/            # 可编辑 Markdown 模板
```

## 页面类型

模板放在 `templates/`，就是普通 Markdown —— 改模板即可改变生成页或 Agent 起草页的形状。

### 实体页（`entities/*.md`）

具体的「东西」：人物、公司、项目、产品。

```markdown
# {名称}

**类型**: {person | organization | project | product}
**首次提及**: {日期}

## 简介
{一段话}

## 关键信息
- {字段}: {值}

## 相关
- [[concepts/{概念}]]
- [[entities/{其他实体}]] — {关系}
```

### 概念页（`concepts/*.md`）

抽象的想法和方法。

```markdown
# {名称}

**分类**: {methodology | technology | framework | pattern}

## 定义
{1–3 句定义}

## 核心要点
1. **{要点}** — {解释}

## 关系
- **父概念**: [[concepts/{父概念}]]
- **对比**: [[comparisons/{a-vs-b}]]
```

### 对比页（`comparisons/*.md`）

两个事物的系统对比。

```markdown
# {A} vs {B}

## 概述
{一句话定位差异}

| 维度 | {A} | {B} |
| --- | --- | --- |
| ... | ... | ... |

## 相关
- [[entities/{相关实体}]]
```

### 来源页（`sources/*.md`）

采集素材的结构化记录。

```markdown
# {标题}

**原始链接**: {url}
**采集时间**: {日期}

## 摘要
{2–3 句}

## 提取
- [[entities/{实体1}]]
- [[concepts/{概念1}]]
```

## Wikilink 语法

`[[wikilinks]]` 按**从 wiki 根出发的路径**解析（相对 `wiki.root`）：

```markdown
[[concepts/rag]]              → wiki/concepts/rag.md
[[entities/openai|OpenAI]]    → wiki/entities/openai.md，显示为 "OpenAI"
[[tag/rag]]                   → wiki/tag/rag.md（tag 聚合页，见 knowflow tags）
```

- `|显示文本` 部分可选，只改变显示，不影响解析。
- 链接是区分大小写的文件路径 —— `[[concepts/RAG]]` 和 `[[concepts/rag]]` 是两个不同的链接。
- `knowflow health` 会报告指向不存在文件的 wikilink（和标准 Markdown 链接）；`knowflow fix` 可以创建缺失页面或清理空链接。

## 生成的数据格式

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

节点 id 是 wiki 路径；边来自页面之间的 `[[wikilinks]]`。

### .knowflowrc

```json
{
  "wiki": { "root": "./wiki", "rawDir": "./raw" },
  "graph": { "output": "./graph/graph.html" },
  "health": { "minFileSize": 100, "excludeOrphanDirs": ["sources/"] }
}
```

只接受合法 JSON；所有相对路径以该文件所在目录为基准。

### wiki/.vector-index.json

可选的向量索引，由 `scripts/vector-store.mjs build` 写入，`knowflow status` 会报告其状态（页数、已向量化数）。用 `knowflow query` 查询需要 `ZHIPUAI_API_KEY`。

### 状态文件

`.ingest-state.json` 和 `.bookmark-state.json` 追踪哪些 raw 文件和书签已被处理，支持增量同步。它们属于项目本地状态，默认 gitignore。
