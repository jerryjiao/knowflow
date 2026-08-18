---
title: 贡献指南
description: Bug、PR、Wiki 页面 —— 以及给 AI 助手的速查表。
---

欢迎提交 Issue 和范围清晰的 PR。完整指南在仓库里：

- [CONTRIBUTING.md（英文）](https://github.com/jerryjiao/knowflow/blob/main/CONTRIBUTING.md)
- [贡献指南（简体中文）](https://github.com/jerryjiao/knowflow/blob/main/docs/contributing.md)

## 报 Bug

在 [GitHub Issues](https://github.com/jerryjiao/knowflow/issues) 提交，包含：复现步骤、期望行为 vs 实际行为、环境信息（Node 版本、OS、脱敏后的 `.knowflowrc` 关键配置）。

## 提 PR

1. Fork 并建分支（`git checkout -b feature/amazing`）
2. Conventional Commits（`feat:`、`fix:`、`docs:` …）
3. 确保 `npm run check` 和 `npm test` 通过

代码规范：Shell 用 `set -euo pipefail`，Node 用 ES Modules，Python 3.10+ 带类型注解。

## 贡献 Wiki 页面

除了代码还可以贡献知识 —— 对好文章跑一次 `knowflow ingest`，或直接按[数据模型](/knowflow/zh/data-model/)写 Wiki 页面，用 `[[wikilinks]]` 互联。

## 给 AI 助手的速查表

如果你是正在参与这个仓库的 AI 助手，这张表是给你的：

| 你想做什么 | 看哪里 |
| --- | --- |
| 理解整体架构 | [系统架构](/knowflow/zh/architecture/) |
| 理解方法论 | [方法论](/knowflow/zh/methodology/) |
| 理解数据格式 | [数据模型](/knowflow/zh/data-model/) |
| 改采集逻辑 | `scripts/ingest.sh` |
| 改模板 | `templates/*.md` |
| 改 CLI 命令 | `bin/knowflow.js` |
| 改图谱构建 | `scripts/graph_builder.py` |
| 改向量检索 | `scripts/vector-store.mjs` |

KnowFlow 是**知识编译器**，不是搜索工具。价值链：

```text
原始素材 → [Agent/人工整理] → 互联 Wiki → [关联] → 图谱 + 可选向量索引
```
