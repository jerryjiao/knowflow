---
title: 系统架构
description: KnowFlow 的组成 —— 从采集到图谱。
---

## 整体流程

```text
输入                     确定性采集                你或 AI Agent
(URL / 推文 / 笔记) ──► 存入 raw/ ──► 整理成互联 Wiki 页面
                                                    │
                          ┌─────────────────────────┤
                          ▼                         ▼
                       知识图谱                 可选语义检索
                    (graph.html/json)         (向量索引 + query)
```

两条边界定义了整个设计：

1. **采集是确定性的。** `ingest` 抓取来源素材并以 Markdown 存入 `raw/`，不调用 LLM，不写 Wiki 页面。
2. **整理归你。** 把 `raw/` 变成结构化页面 —— 手工或交给任意 AI Agent —— 是一个独立的、看得见的步骤。KnowFlow 提供模板、健康检查和图谱；判断权在你手里。

## 目录结构

```text
knowflow/
├── bin/
│   └── knowflow.js          # CLI 入口，命令路由
├── scripts/
│   ├── ingest.sh            # 单条 URL/文本采集（fetch → raw/）
│   ├── graph_builder.py     # 从 Wiki 页面构建知识图谱
│   ├── wiki-health.sh       # 健康检查（断链、小文件、孤儿页）
│   ├── wiki-auto-fix.sh     # knowflow fix 背后的修复逻辑
│   ├── tags-builder.mjs     # knowflow tags 背后的 tag 聚合页构建
│   ├── vector-store.mjs     # 向量索引（嵌入 + 存储）与查询
│   ├── batch-ingest.cjs     # 批量处理原始素材（早期实验）
│   ├── enrich-wiki.js       # Wiki 后处理实验（早期实验）
│   ├── graph_relation_labeler.py  # LLM 关系类型标注（可选）
│   ├── pipeline.sh          # 串联脚本
│   ├── bookmark_sync.sh     # X/Twitter 书签同步
│   └── wechat_sync.sh       # 微信公众号文章同步
├── templates/               # 可编辑页面模板（实体/概念/对比/来源）
├── docs/                    # 架构、方法论、参考文档
└── package.json
```

核心命令（`init`、`ingest`、`status`、`health`、`fix`、`graph`、`tags`、`query`）稳定且有测试覆盖。早期实验和同步脚本是辅助工具 —— 从原始采集到已审核页面的一等 Agent 工作流在[路线图](https://github.com/jerryjiao/knowflow#roadmap)上。

## 一条 URL 的生命周期

1. **采集。** `knowflow ingest <url>` 识别来源类型，抓取全文（网页走 Jina Reader；部分平台可能需要 `yt-dlp`），带元数据存入 `raw/`。仅此而已，不写任何别的东西。
2. **整理。** 你 —— 或你信任的 Agent —— 读 raw 文件、按 `templates/` 起草页面、用 `[[wikilinks]]` 建立互联。每一次改动都是可以用 Git 审查的 Markdown diff。
3. **图谱。** `knowflow graph` 解析全部 Wiki 页面，按路径解析 `[[wikilink]]`，输出 `graph.json` 和交互式查看器 `graph.html`。
4. **检索（可选）。** 配置智谱 AI 嵌入 Key 后，页面可被嵌入本地向量索引，用 `knowflow query` 查询。

## 为什么用 Markdown 而不是数据库？

- **人类可读** —— 编辑器直接打开就能看
- **版本控制友好** —— Git 追踪每次变更
- **Agent 友好** —— LLM 天然擅长读写 Markdown
- **可移植** —— 不依赖任何数据库服务，零锁定

## 为什么图谱和向量检索都要？

| 能力 | 知识图谱 | 向量检索 |
| --- | --- | --- |
| 精确查找 | ✅ 按实体/关系查 | ❌ |
| 语义搜索 | ❌ | ✅ "类似 XXX 的内容" |
| 发现关联 | ✅ A→B→C 的路径 | ❌ |
| 模糊匹配 | ❌ | ✅ 语义相近即可 |

两者互补。图谱本地运行、零依赖；语义检索是可选项，默认关闭。

## 技术栈

| 组件 | 技术 | 原因 |
| --- | --- | --- |
| CLI 运行时 | Node.js 18+ | npm 生态，开发者熟悉 |
| 图谱构建 | Python 3.10+ | 图算法成熟，vis-network 可视化 |
| 向量索引（可选） | 智谱 AI 嵌入 | 本地索引文件，无需外部服务 |
| 数据存储 | 纯文件（Markdown/JSON） | 零依赖，Git 友好 |
