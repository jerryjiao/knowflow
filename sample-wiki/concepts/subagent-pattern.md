# SubAgent 模式（主从协作）

## 定义

用一个"主编排 Agent"（如 Claude Code）负责理解和规划，调度多个"执行 Agent"（如 Codex）干重活。**省钱、并行、专业化**的三赢模式。

## 来源视角
- **实战验证**：Claude Code 调度 Codex 当 SubAgent（054/084 号文件）
- **成本优化**：50 元 Codex 做执行 ≈ 省掉 80% 的 Claude Token 开销
- **多模型编排**：OpenClaw 支持同时指挥 Codex + Gemini + Claude Code
- **本地方案**：tmux 并行运行多个 Agent，轻量级实现

## 典型架构
```
用户请求 → Claude Code (理解/拆解/编排)
                ├──→ Codex Agent 1 (写代码)
                ├──→ Codex Agent 2 (写测试)
                └──→ Gemini (审查)
         ← 汇总结果 → 返回用户
```

## 实践建议
1. 编排层用强模型（Claude），执行层用便宜模型（Codex）
2. 任务粒度要合适——太粗浪费上下文，太细调度开销大
3. 结果一定要有结构化格式（JSON/Markdown），方便汇总

## 相关专题
[[topics/ai-coding-tools]] | [[topics/ai-multi-agent]]
