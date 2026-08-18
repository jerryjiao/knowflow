---
title: 常见问题
description: 大家实际会问的问题，快速答疑。
---

## `ingest` 会替我生成 Wiki 页面吗？

不会——这是刻意设计的。采集只负责原样保存。整理是独立的另一步，由你——或者更好的，[你的 AI 助手](/knowflow/zh/agent-guide/)——完成。进入你知识库的每一个字，你都看得见、都把得过关。

## 我需要会写代码吗？

安装和运行命令需要终端，但这些全都可以交给 AI 助手代跑。大多数非技术用户一直活在[助手工作流](/knowflow/zh/agent-guide/)里，从不碰脚本。安装就一行：`npm install -g @jerryjiao/knowflow`。

## 需要填 API Key 吗？

只有语义检索需要（可选，默认不开）。采集、图谱、健康检查、标签聚合页，全部不需要任何 Key。

## 哪些 AI 助手能用？

任何能在你机器上读写文件的：Claude Code、Cursor、Codex 都行。KnowFlow 不锁任何 API——约定（模板、`[[wikilinks]]`）都在你的文件里。

## 我的数据私密吗？

是。KnowFlow 完全在你本机运行。仅有的网络请求：抓取你明确保存的 URL，以及（如果你主动开启语义检索）调用嵌入 API。都在代码里看得见。

## 能和 Obsidian 一起用吗？

能。`wiki/` 文件夹就是带 `[[wikilinks]]` 的纯 Markdown——直接作为 Obsidian 仓库打开，一切照常。KnowFlow 补上 Obsidian 没有的部分：采集、健康检查、图谱数据。（KnowFlow 按从 wiki 根出发的路径解析链接，所以写 `[[concepts/rag]]`，不写 `[[RAG]]`。）

## 为什么不直接对收藏跑 RAG？

RAG 每次提问都从头翻一遍原始堆。KnowFlow 把收藏编译成持久、互联的页面，随时间不断积累——还没提问，交叉链接和图谱就已经存在了。详见[方法论](/knowflow/zh/methodology/)。

## 为什么用 Markdown 文件而不是数据库？

因为你应该随时走得掉。文件永远可读、可用 Git 干净地做版本控制、任何工具都能处理——包括 AI 助手。

## 上 npm 了吗？

上了：`npm install -g @jerryjiao/knowflow`。包名带 `@jerryjiao/` 前缀，是因为 npm 认为裸名 `knowflow` 与既有包 `know-flow` 过于相似；装完之后命令仍然就叫 `knowflow`。

## 收费吗？

不收。KnowFlow 是 MIT 协议开源软件。唯一的可能开销：你开启语义检索时的嵌入 API 费用。
