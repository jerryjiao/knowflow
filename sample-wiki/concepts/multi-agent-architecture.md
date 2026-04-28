# Multi-Agent 架构（多智能体协作）

## 定义

多个 AI Agent 通过分工、通信、协作来完成单个 Agent 无法完成的复杂任务。**AI 团队的组织学**。

## 三大架构模式
1. **主从模式（Master-Worker）**
   - 一个 Agent 编排，多个 Agent 执行
   - 代表：Claude Code + Codex SubAgent、Game Studios
   - 适用：任务可清晰拆分的场景

2. **层级模式（Hierarchical）**
   - 多层管理，经理→组长→组员
   - 代表：ClawTeam（港大）
   - 适用：复杂项目需要中间管理层

3. **平等协作模式（Peer-to-Peer）**
   - Agent 之间对等协商
   - 代表：开放式的 Agent 社区
   - 适用：创造性任务需要多方讨论

## 来源视角
- **Agent 原理架构与工程实践**（015 号，79KB）：最全面的理论+实践
- **ClawTeam**（003 号）：学术级的层级协作框架
- **Game Studios**（056 号）：48 个 Agent 的极限实验
- **DeerFlow**（048 号）：工业级 SuperAgent 编排

## 实践建议
1. 从主从模式开始，最简单也最实用
2. 明确每个 Agent 的职责边界（SRP 原则）
3. 设计好 Agent 间的通信协议（JSON/结构化消息）
4. 不要为了用 Multi-Agent 而用——单 Agent 能解决的别强行拆分

## 相关专题
[[topics/ai-multi-agent]] | [[topics/ai-coding-tools]]

## 深度阅读
- [[sources/lilianweng-llm-agents]] — LLM Agent 权威综述
- [[sources/anthropic-effective-agents]] — Anthropic 工程最佳实践
