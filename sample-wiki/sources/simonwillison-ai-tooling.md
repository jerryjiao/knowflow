# Simon Willison's AI Tooling Landscape

> 📊 原文: [simonwillison.net](https://simonwillison.net/) — 综合多篇文章

## 概述

Simon Willison（Django 联合创始人）是 AI 工具领域最活跃的技术博主之一。他的博客持续跟踪 AI 工具的最新发展，特别关注：

- LLM 应用架构模式
- 开发者工具评测
- Prompt Engineering 最佳实践
- AI 安全和伦理问题

## 核心主题与贡献

### 1. LLM as a Runtime（LLM 即运行时）
- LLM 不再只是聊天机器人，而是新的计算范式
- "LLM Shell": 用自然语言编程
- 工具调用（Function Calling）是关键接口

### 2. Prompt Patterns（提示词模式）
Willison 总结了多种可复用的 prompt 模式：
- **Few-shot prompting**: 示例驱动
- **Chain-of-thought**: 推理链
- **Generated Knowledge**: 先生成相关知识再回答
- **Self-consistency**: 多次采样取共识
- **Tree-of-thoughts**: 推理树搜索

### 3. AI 工具评测
持续更新的工具对比：
- **Coding Agents**: Claude Code vs Cursor vs Copilot vs Codex
- **Vector DBs**: Pinecone vs ChromaDB vs Qdrant vs Weaviate
- **Frameworks**: LangChain vs LlamaIndex vs CrewAI
- **Hosting Options**: OpenAI API vs Anthropic API vs Local Models

### 4. 可观测性
- **LLM Observability**: 如何监控和调试 LLM 应用
- **Token 计费追踪**: 成本控制的关键
- **Evaluation**: 如何评估 LLM 输出质量

### 5. 安全性关注
- **Prompt Injection**: 最重要的安全威胁
- **间接 Prompt Injection**: 通过第三方数据注入
- **防护策略**: 输入过滤、权限控制、输出审查

## 对 KnowFlow 的启示

### 工具选型参考
- Willison 的评测是 KnowFlow 技术选型的权威参考
- **Vector Store**: ChromaDB（本地优先）
- **Framework**: 避免 heavy framework，保持简单
- **Embedding**: OpenAI text-embedding-3 或本地模型

### Prompt Engineering
- KnowFlow 的 ingest prompt 可以借鉴 Willison 的模式
- **Structured Output**: JSON mode 提高可靠性
- **Few-shot Examples**: 给出期望的 wiki 格式示例

### 安全性
- **Ingest URL 验证**: 防止 indirect prompt injection
- **输出过滤**: 确保 wiki 内容不含恶意指令

## 重要文章索引

| 日期 | 主题 | 要点 |
|------|------|------|
| 2024-2025 | AI Tooling 系列 | 工具全景图 |
| 2024 | Prompt Injection | 安全威胁分析 |
| 2024 | LLM Observables | 监控最佳实践 |
| 2025 | Claude Code 评测 | 编程 Agent 对比 |

## 相关链接
[[entities/Claude-Code]] | [[sources/anthropic-effective-agents]] | [[sources/mcp-protocol]] | [[concepts/subagent-pattern]]
