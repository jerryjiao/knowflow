# LLM Powered Autonomous Agents

> 📊 原文: [LLM Powered Autonomous Agents - Lilian Weng](https://lilianweng.github.io/posts/2023-06-23-agent/)

## 概述

Lilian Weng（OpenAI）撰写的关于 LLM 驱动的自主 Agent 系统的权威综述。这是 AI Agent 领域被引用最多的技术文章之一，系统性地定义了 Agent 的四大核心组件。

## 核心架构：四大组件

### 1. 规划（Planning）
- **Chain of Thought (CoT)**: "逐步思考"，将复杂任务分解为可管理的子步骤
- **Tree of Thoughts (ToT)**: 扩展 CoT，在每个步骤探索多个推理路径，形成树状搜索结构
- **ReAct**: 推理+行动结合，交替进行 Thought → Action → Observation 循环
- **LLM+P**: 使用外部经典规划器（PDDL）做长程规划
- **Reflexion**: 带动态记忆和自我反思能力的 Agent 框架

### 2. 记忆（Memory）
- **短期记忆/上下文记忆**: 所有在推理过程中使用的信息
- **长期记忆**: 可检索和可管理的向量数据库，支持快速查询和积累
- 记忆机制模仿人类大脑的 Atkinson-Shiffrin 模型

### 3. 工具使用（Tool Use）
- Agent 学习调用外部 API 获取模型权重中缺失的信息
- 包括：当前信息、代码执行能力、专有数据源访问
- HuggingGPT 是典型实现：LLM 作为控制器管理多个 AI 模型

### 4. 行动（Action）
- Agent 将决策转化为具体行动
- 子目标分解、自我反思、批评与修正
- 支持多轮迭代直到任务完成

## 关键方法论

| 方法 | 核心思想 | 适用场景 |
|------|----------|----------|
| Chain of Thought | 逐步推理 | 数学、逻辑推理 |
| Tree of Thoughts | 多路径探索 | 创意生成、规划 |
| ReAct | 推理-行动循环 | 知识密集型任务 |
| Reflexion | 自我反思改进 | 迭代式问题解决 |
| Algorithm Distillation | 跨 episode 学习 | RL 任务 |

## 对 KnowFlow 的启示

- **知识编译 > RAG**: 文章强调长期记忆的组织方式，支持"编译一次，持续维护"的理念
- **Agent 架构**: 规划→记忆→工具→行动的四层架构是设计 AI 知识系统的参考框架
- **Self-Reflection**: Agent 应具备自我反思能力，对应 Wiki 的 Lint/健康检查机制

## 相关链接
[[concepts/multi-agent-architecture]] | [[concepts/subagent-pattern]] | [[entities/Claude-Code]] | [[entities/OpenClaw]] | [[concepts/distributed-brain]]
