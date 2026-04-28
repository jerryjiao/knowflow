# Building Effective AI Agents

> 📊 原文: [Building Effective Agents - Anthropic Engineering](https://www.anthropic.com/engineering/building-effective-agents)

## 概述

Anthropic 工程团队发布的 AI Agent 开发最佳实践指南。基于 Claude 在生产环境中的大规模应用经验，总结了构建高效、可靠 Agent 的核心原则和模式。

## 核心原则

### 1. 简单性优先
- 从直接调用 API 开始，不要过度工程化
- 复杂的 Agent 框架增加调试难度和维护成本
- 大多数任务不需要复杂的 Agent loop

### 2. Agent 与 Tool 的边界
- **Tool**: 单次 API 调用 + 函数调用，适合明确任务
- **Agent**: 多步推理 + 自主决策，适合开放性问题
- 选择标准：任务是否需要自主规划和迭代？

### 3. 提示词工程是基础
- 清晰的系统提示词比复杂架构更重要
- 结构化输出（JSON mode）提高可靠性
- Few-shot 示例显著提升性能

## 关键模式

### Decomposition Pattern（分解模式）
将大任务拆分为小步骤：
```
1. 分析需求 → 2. 制定计划 → 3. 执行步骤 → 4. 验证结果
```
每一步都可以独立验证和重试。

### Router Pattern（路由模式）
根据输入类型路由到不同的处理流程：
- 简单查询 → 直接回答
- 复杂任务 → Agent pipeline
- 代码相关 → Code Interpreter

### Supervisor Pattern（监督模式）
一个主 Agent 协调多个专业子 Agent：
- Orchestrator 分配任务
- Specialist Agent 各司其职
- 共享上下文 + 结果汇总

## 实践经验

### 安全性
- 权限最小化原则
- 人工审批关键操作
- 输入/输出过滤

### 可观测性
- 全链路日志记录
- Token 使用追踪
- 性能指标监控

### 错误处理
- 重试策略（指数退避）
- Fallback 到简化路径
- 明确的错误消息

## 对 KnowFlow 的启示

- **KnowFlow ingest 管线** 符合 "简单性优先" 原则：URL → 提取 → 编译 → 入库
- **Wiki 维护 Agent** 可以采用 Supervisor 模式：Orchestrator + 专业子 Agent
- **Health Check** 对应文章中的可观测性和错误处理最佳实践

## 相关链接
[[sources/lilianweng-llm-agents]] | [[concepts/subagent-pattern]] | [[entities/Anthropic]] | [[entities/OpenClaw]]
