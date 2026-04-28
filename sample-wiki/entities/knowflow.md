# KnowFlow

**类型**: project
**来源**: [GitHub](https://github.com/jerryjiao/knowflow)
**首次提及**: 2026-04

## 简介

AI 驱动的知识 Wiki 系统。基于 Andrej Karpathy 的 LLM Wiki 方法论，将 URL、推文、PDF 等原始内容自动编译为结构化 Wiki 页面，并构建知识图谱和向量检索索引。

## 关键信息

- **语言**: JavaScript (Node.js) + Python
- **License**: MIT
- **npm**: `knowflow`
- **LLM 后端**: 智谱 AI (GLM-Flash) / 可切换 OpenAI
- **代码量**: ~4700 行

## 核心能力

1. **自动摄取** — 识别 URL/Twitter/PDF/微信等来源，全文提取
2. **AI 提取** — 用 JSON Schema 约束 LLM 输出实体、概念、关系
3. **Wiki 编译** — 自动生成实体页/概念页/对比页，交叉链接
4. **知识图谱** — vis.js 可视化力导向图
5. **向量检索** — 本地 Embedding，语义搜索

## 相关概念

- [[LLM Wiki]]
- [[RAG|检索增强生成]]
- [[知识图谱]]
- [[向量检索]]

## 相关实体

- [[Jerry]] — 创建者
- [[智谱 AI]] — LLM 提供商
- [[Andrej Karpathy]] — 方法论提出者

---
*最后更新: 2026-04-28 | 来源: [GitHub](https://github.com/jerryjiao/knowflow)*
