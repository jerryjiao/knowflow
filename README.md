# KnowFlow 🧠

> **AI 驱动的知识 Wiki 系统** — 将 URL、推文、PDF、书签等转化为互联 Wiki，支持知识图谱与向量检索。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[npm](https://www.npmjs.com/package/knowflow)

## ✨ KnowFlow 是什么？

KnowFlow 是一个个人知识管理系统，灵感来自 [Andrej Karpathy 的 LLM Wiki 想法](https://karpathy.github.io/llm-wiki/)。它能自动完成：

1. **收录（Ingest）** — 从 URL、推文、PDF 等来源采集内容
2. **提取（Extract）** — 利用 LLM 提取实体、概念和关联关系
3. **生成（Generate）** — 自动生成互相链接的 Wiki 页面
4. **建图（Graph）** — 构建知识图谱可视化
5. **索引（Index）** — 全量构建向量索引，支持语义搜索

全程使用开源 LLM 驱动——无需 OpenAI API Key。

## 🚀 快速开始

```bash
# 安装（需要 Node.js 18+）
npx knowflow@latest init my-wiki

# 收录一个 URL
cd my-wiki
npx knowflow ingest https://karpathy.github.io/llm-wiki/

# 提问查询
npx knowflow query "RAG 和 LLM Wiki 有什么区别？"
```

### 前置要求

- **Node.js** >= 18
- **Python** >= 3.10（用于知识图谱和向量存储）
- 智谱 AI API Key（[免费额度可用](https://open.bigmodel.cn/)）

## 📖 架构设计

```
┌─────────────┐    ┌─────────────┐    ┌──────────────┐
│   原始层     │───▶│   Wiki 层    │───▶│  规则层       │
│ (URL/PDF/   │    │ (实体/概念/  │    │ (提取规则)    │
│  推文)      │    │  对比页)    │    │               │
└─────────────┘    └──────┬───────┘    └───────────────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │ 知识图谱  │ │ 向量索引  │ │ 图谱可视化│
       └──────────┘ └──────────┘ └──────────┘
```

## 📁 项目结构

```
knowflow/
├── bin/knowflow.js          # CLI 主入口
├── scripts/
│   ├── ingest.sh            # 单条 URL 收录流水线
│   ├── batch-ingest.js      # 批量处理
│   ├── graph_builder.py     # 知识图谱构建
│   ├── vector-store.mjs     # 向量搜索索引
│   ├── pipeline.sh          # 全自动流水线
│   └── bookmark_sync.sh     # X/Twitter 书签同步
├── templates/               # Wiki 页面模板
│   ├── entity.md            # 实体页（人物、项目）
│   ├── concept.md           # 概念页（RAG、Embedding 等）
│   ├── comparison.md        # 对比页（A vs B）
│   └── source.md            # 来源参考页
├── docs/                    # 文档
├── articles/                # 公众号系列文章
└── package.json
```

## 🔧 配置说明

将 `.knowflowrc.example` 复制为 `.knowflowrc` 并按需配置：

```yaml
llm:
  provider: "zhipuai"        # LLM 提供商（zhipuai / openai）
  model: "glm-4-flash"       # 用于提取的模型

wiki:
  root: ./wiki               # Wiki 页面输出目录
  raw_dir: ./raw             # 原始内容存储目录

graph:
  output: ./graph/graph.html # 知识图谱可视化输出路径
```

## 📚 系列文章

`articles/` 目录包含一套 6 篇 KnowFlow 公众号系列文章：

1. **[P1] 概念篇** — 为什么我们需要 LLM Wiki（`articles/P1-概念篇-你的收藏夹从未被打开过.md`）
2. **[P2] 项目故事** — 两周做一个 AI 知识库的经历（`articles/P2-项目故事-我花了两周做了一个AI知识库.md`）
3. **[P3] 教程上]** — 从 URL 到 Wiki 第一步（`articles/P3-教程上-从URL到知识库第一步怎么做.md`）
4. **[P4] 教程下]** — 知识图谱与向量检索（`articles/P4-教程下-知识图谱与向量检索.md`）
5. **[P5] 开源指南** — 3 分钟上手 + 10 个踩坑（`articles/P5-开源指南-3分钟上手与10个踩坑.md`）
6. **[P6] 展望篇** — 对 AI 知识管理的思考（`articles/P6-展望篇-做完之后对AI知识管理的思考.md`）

## 🤝 参与贡献

欢迎提交 PR！详见 [articles/](./articles/) 了解项目目标与设计决策。

## 📄 开源协议

MIT © [Jerry Jiao](https://github.com/jerryjiao)

---

> 💡 **灵感来源** [Karpathy's LLM Wiki Gist](https://karpathy.github.io/llm-wiki/) —— 知识应该被**编译**，而不仅仅是**存储**。
