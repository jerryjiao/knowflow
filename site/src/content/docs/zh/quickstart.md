---
title: 快速开始
description: 几条命令，从零跑到交互式知识图谱。
---

**环境要求：** Node.js 18+、Python 3.10+、Bash 和 curl。

npm 包尚未发布，本指南从源码安装起步。发布后 `npx knowflow@latest <命令>` 可直接使用，安装步骤可以跳过。

## 1. 从源码安装

```bash
git clone https://github.com/jerryjiao/knowflow.git
cd knowflow
npm install
npm link
```

## 2. 创建项目并采集一条笔记

```bash
knowflow init my-wiki
cd my-wiki
knowflow ingest "LLM Wiki 把零散笔记整理成互联知识。" --source text
```

这条笔记现在位于 `raw/web/`。它**没有**被转换成结构化 Wiki 页面 —— 这个边界是有意设计的，也是 KnowFlow 的核心。

## 3. 手工整理两个 Wiki 页面

这一步正是 AI Agent 或自定义工作流的切入点：读取 `raw/`、按 `templates/` 里的模板起草页面、请你审核。这里手工演示一下页面的形状。

创建 `wiki/concepts/linked-knowledge.md`：

```markdown
# Linked knowledge

Linked knowledge connects durable concepts to the sources that support them.

## Connections

- [[index]]
- [[sources/capture-example]]
```

再创建 `wiki/sources/capture-example.md`：

```markdown
# Capture example

This source page records the note captured during the quickstart.

## Connections

- [[concepts/linked-knowledge]]
```

注意链接语法：`[[wikilinks]]` 按**从 wiki 根出发的路径**解析，所以概念页要写 `[[concepts/linked-knowledge]]`，而不是 `[[Linked knowledge]]`。

## 4. 校验并生成图谱

```bash
knowflow health
knowflow status
knowflow graph --no-open
```

预期产物：

- `graph/graph.html` —— 交互式图谱查看器（首次打开会从 CDN 加载 vis-network）
- `graph/graph.json` —— 可供其他工具使用的图数据
- `graph/.graph-state.json` —— 图谱构建状态

![KnowFlow 交互式知识图谱](/knowflow/graph-demo.png)

## 接下来

- [命令参考](/knowflow/zh/commands/) —— 全部 8 个命令、选项与退出码
- [数据模型](/knowflow/zh/data-model/) —— 页面类型与 `[[wikilink]]` 语法详解
- [方法论](/knowflow/zh/methodology/) —— 为什么编译后的 Wiki 页面胜过一堆收藏链接
