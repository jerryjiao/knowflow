---
title: 命令参考
description: KnowFlow 全部 8 个命令 —— 选项、行为与退出码。
---

KnowFlow 是一个单一的 `knowflow` CLI。命令会从当前目录向上查找最近的 `.knowflowrc` 来定位项目根，因此在项目子目录里也能直接运行。

## 一段真实会话

```console
$ knowflow init my-wiki && cd my-wiki
✅ 已创建 /path/to/my-wiki/.knowflowrc
✅ KnowFlow 项目已初始化: /path/to/my-wiki

$ knowflow ingest "LLM Wiki 把零散笔记整理成互联知识。" --source text
🔗 开始采集素材...
✅ 采集完成！                       # → raw/web/<时间戳>-note.md

$ knowflow graph --no-open
🕸️  构建知识图谱...
✅ 图谱已生成: /path/to/my-wiki/graph/graph.html

$ knowflow health
🏥 Wiki 健康检查...
✗ wiki/concepts/linked-knowledge.md → [[sources/missing]] (not found)
⚠️  发现一些问题，建议修复（knowflow fix）   # 退出码 1

$ knowflow fix --dry-run
🔧 自动修复 Wiki 问题...
[dry-run] 会创建缺失页面: wiki/sources/missing.md
```

| 命令 | 作用 |
| --- | --- |
| [`init`](#init) | 创建独立项目 |
| [`ingest`](#ingest) | 采集 URL 或文本到 `raw/` |
| [`status`](#status) | 显示项目统计与索引状态 |
| [`health`](#health) | 检查断链、小文件和孤儿页 |
| [`fix`](#fix) | 修复 `health` 发现的问题 |
| [`graph`](#graph) | 生成交互式知识图谱 |
| [`tags`](#tags) | 重建 tag 聚合页 |
| [`query`](#query) | 混合语义检索（可选） |

## init

```bash
knowflow init [目录]
```

创建一个独立项目（默认使用当前目录）：

- `.knowflowrc` —— JSON 配置，只在不存在时写入
- `wiki/`，含 `sources/`、`entities/`、`concepts/`、`comparisons/` 子目录和初始 `index.md`
- `raw/`，含 `web/`、`twitter/`、`xiaohongshu/`、`wechat/` 子目录
- `graph/` 输出目录
- `templates/` —— 从包里拷贝的可编辑 Markdown 页面模板

再次运行 `init` 会保留已有配置、初始首页和自定义过的模板。

## ingest

```bash
knowflow ingest <url-或-文本> [--source <类型>]
```

把 URL 或纯文本笔记采集为 Markdown 存入 `raw/`。`--source`（`-s`）默认 `auto`，自动识别来源类型；纯文本用 `text`。

需要知道的细节：

- URL 采集依赖 [Jina Reader](https://jina.ai/reader/)；YouTube 和部分需要登录的平台可能还需要 `yt-dlp` 或带登录态的浏览器工作流。
- **`ingest` 不生成 Wiki 页面。** 它只保存原始素材。把素材整理成结构化页面 —— 无论人工还是 AI Agent —— 是一个独立的、看得见的步骤。这个边界是有意设计的。

## status

```bash
knowflow status
```

打印项目概览：Wiki 文章数与总行数、原始素材数、向量索引状态（已向量化页数）、图谱节点/边数量、API Key 是否已配置。不需要 API Key。

## health

```bash
knowflow health
```

检查 Wiki 的：

- **断链** —— 指向不存在文件的 `[[wikilinks]]` 和 `[markdown](链接.md)`
- **小文件** —— 小于 `health.minFileSize` 字节（默认 100）的页面
- **孤儿页** —— 没有任何页面链接到的页面，`health.excludeOrphanDirs` 列出的目录不计入

发现问题时以退出码 `1` 结束，可以直接用于 CI 或 Agent 工作流的门禁。用 [`fix`](#fix) 修复它报告的问题。

## fix

```bash
knowflow fix [--dry-run]
```

修复 `health` 发现的问题：

- 清理 `[[entities/,]]` 这类空链接
- 创建链接指向但不存在的实体/概念页
- 给低于最小尺寸的文件补内容
- 把孤儿页自动链接到 `index.md`

`--dry-run` 只报告会改什么，不写任何文件。

## graph

```bash
knowflow graph [--no-open]
```

解析全部 Wiki 页面，提取 `[[wikilink]]` 关系，输出 `graph.html`（交互式查看器，首次打开从 CDN 加载 vis-network）和 `graph.json`（原始数据）。无需 API Key。默认用浏览器打开查看器，传 `--no-open` 则只构建。

## tags

```bash
knowflow tags
```

扫描全部 Wiki 页面中的 `[[tag/<名称>]]` 链接，（重新）生成 `wiki/tag/<名称>.md` 聚合页，索引所有带该标签的页面。全量重建、幂等 —— 新增带标签页面后随时重跑。

## query

```bash
knowflow query <文本> [--top <n>]
```

对 Wiki 做混合检索（向量搜索 + 关键词匹配）。`--top`（`-n`）控制返回数量（默认 5，范围 1–100）。

前置条件：

- [智谱 AI](https://open.bigmodel.cn/) API Key，通过 `ZHIPUAI_API_KEY` 环境变量或项目根 `.env` 文件提供
- 预先构建的向量索引。CLI 尚未提供 `index` 命令；在此之前，高级用户可以运行 `node <knowflow安装目录>/scripts/vector-store.mjs build` 构建

## 配置

`knowflow init` 会写入 JSON 格式的 `.knowflowrc`。所有相对路径以该文件所在目录为基准解析。

```json
{
  "wiki": { "root": "./wiki", "rawDir": "./raw" },
  "graph": { "output": "./graph/graph.html" },
  "health": { "minFileSize": 100, "excludeOrphanDirs": ["sources/"] }
}
```

- `health.excludeOrphanDirs` —— 预期不会被引用的目录（每日同步流水页、收件箱等），其中的页面不计入孤儿页
- `wiki.root` / `wiki.rawDir` / `graph.output` —— 自定义 Wiki、raw 层和图谱输出的位置

图谱生成、健康检查、内容采集和状态查看都**不需要** API Key，只有 `query` 需要。
