# AI Skills 系统对比：Claude Code vs OpenClaw vs Obsidian

## 定义对比

| 维度 | Claude Code Skills | OpenClaw Skills | Obsidian Skills (kepano) |
|------|-------------------|-----------------|------------------------|
| **载体** | SKILL.md + 指令 | SKILL.md + 脚本 + 工具 | Markdown 模板 |
| **分发** | 官方市场 | ClawHub 社区 | GitHub 插件 |
| **工具调用** | 原生 Tool Use | 20+ 内置工具 | 有限 |
| **执行环境** | 终端/IDE | Gateway 守护进程 | Obsidian App |
| **社区规模** | 快速增长 | 数百个 Skills | 16K+ stars |
| **适用场景** | 编程任务 | 全能 Agent | 知识管理 |

## 设计哲学差异

**Claude Code** — "Skill = 清晰的指令"
- 输入输出规范是核心
- 错误处理必须明确
- 幂等性优先

**OpenClaw** — "Skill = 一个完整的能力包"
- 可以包含脚本、配置、子技能
- 工具访问是第一公民
- 支持跨平台消息推送

**Obsidian (kepano)** — "Skill = 知识模板"
- 专注于知识工作流
- UI 交互友好
- 非程序员也能用

## 来源
[[concepts/skills-system]] | [[entities/Claude-Code]] | [[entities/OpenClaw]]
