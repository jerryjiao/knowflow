# KnowFlow 🌊 — AI 知识流系统

[![npm 版本](https://img.shields.io/npm/v/knowflow.svg)](https://www.npmjs.com/package/knowflow)
[![许可证](https://img.shields.io/npm/l/knowflow.svg)](../LICENSE)
[![Node 版本](https://img.shields.io/node/v/knowflow.svg)](https://nodejs.org)

> **AI 驱动的知识流系统** — 将 URL、文章和内容转化为结构化 Wiki 与知识图谱。

KnowFlow 从网络摄取内容，将其编译为结构化的 Wiki 文章，并构建可交互的知识图谱 — 全部在终端中完成。

## ✨ 核心功能

- 🤖 **AI 驱动的内容摄取** — 自动识别来源类型（网页、Twitter/X、公众号、YouTube、小红书、PDF）并提取全文
- 📝 **结构化 Wiki** — 将原始内容编译为实体页、概念页、来源页和对比分析页，支持交叉引用
- 🔍 **混合检索** — 向量搜索 + 关键词匹配的双重检索引擎（需配置 API Key）
- 🕸️ **知识图谱** — 轻量级 vis.js 力导向图即时预览；深度 LLM 分析通过 Understand-Anything 实现
- 🏥 **健康检查** — 自动检测断链、空文件和孤立页面
- 📊 **状态面板** — 一目了然的文章数量、向量索引覆盖率、图谱统计信息

## 快速开始

```bash
# 1. 全局安装
npm install -g knowflow

# 2. 初始化配置文件
knowflow init

# 3. 摄取你的第一个 URL
knowflow ingest https://example.com/article
```

## 命令一览

| 命令 | 说明 |
|------|------|
| `knowflow init` | 初始化 `.knowflowrc` 配置文件 |
| `knowflow ingest <url>` | 摄取 URL/文本到 Wiki（自动检测来源类型） |
| `knowflow query <text>` | 混合检索（向量 + 关键词） |
| `knowflow graph` | 构建并在浏览器中打开知识图谱 |
| `knowflow health` | Wiki 健康检查（断链、孤立页面等） |
| `knowflow status` | 显示 Wiki 统计信息和系统状态 |

## 系统架构

```
┌─────────────────────────────────────────────┐
│                  CLI 层                      │
│         knowflow (commander + chalk)          │
├─────────────────────────────────────────────┤
│               摄取管道                       │
│   URL → 来源检测 → 提取 → 原始 Markdown      │
│   (Jina Reader / yt-dlp / web_fetch)        │
├─────────────────────────────────────────────┤
│               知识层                         │
│  Wiki 文章 ← → 向量索引 ← → 知识图谱          │
│  (Markdown / Embeddings / vis.js / UA)       │
└─────────────────────────────────────────────┘
```

## 工作原理

1. **摄取 (Ingest)** — 传入任意 URL。KnowFlow 自动识别平台（网页、Twitter、公众号、YouTube 等），提取干净的 Markdown 文本。
2. **编译 (Compile)** — 原始内容被转换为结构化 Wiki 页面：来源页、实体页、概念页、对比分析页 — 通过 `[[wikilink]]` 建立交叉引用。
3. **索引 (Index)** — 页面被嵌入向量存储以支持语义搜索（可选，需要 API Key）。
4. **可视化 (Visualize)** — 构建交互式知识图谱，展示实体、概念和来源之间的关联。

## 配置说明

运行 `knowflow init` 后，编辑 `.knowflowrc` 自定义配置：

```ini
[wiki]
root = ./wiki           # Wiki 根目录
raw_dir = ./raw         # 原始数据目录

[ingest]
auto_detect = true      # 自动检测来源类型
default_source = auto   # 默认来源

[graph]
output = ./graph/graph.html  # 图谱输出路径
wiki_dir = ./wiki           # Wiki 目录
```

在 `.env` 中设置 `ZHIPUAI_API_KEY` 以启用向量搜索功能：

```bash
echo "ZHIPUAI_API_KEY=your-key-here" > .env
```

> 获取 API Key: https://open.bigmodel.cn/

## 项目结构

```
knowflow/
├── bin/knowflow.js       # CLI 入口
├── scripts/
│   ├── ingest.sh         # 摄取管道脚本
│   ├── graph_builder.py  # 轻量级图谱生成器
│   └── vector-store.mjs  # 向量搜索引擎
├── templates/            # Wiki 页面模板
│   ├── source.md         # 来源素材模板
│   ├── entity.md         # 实体模板
│   ├── concept.md        # 概念模板
│   └── comparison.md     # 对比分析模板
├── wiki/                 # 结构化 Wiki 文章
│   ├── index.md          # 首页/导航
│   ├── sources/          # 来源页面
│   ├── entities/         # 实体页面
│   ├── concepts/         # 概念页面
│   └── comparisons/      # 对比页面
├── raw/                  # 摄取的原始数据（按平台分目录）
├── graph/                # 知识图谱输出
└── docs/                 # 文档
```

## 支持的来源平台

| 平台 | 提取方式 | 可靠性 |
|------|---------|--------|
| 网页 (web) | Jina Reader | ⭐⭐⭐⭐⭐ |
| 公众号 (wechat) | Jina Reader | ⭐⭐⭐⭐⭐ |
| Twitter/X | Jina Reader / twitter CLI | ⭐⭐⭐⭐ |
| YouTube | yt-dlp + 字幕提取 | ⭐⭐⭐⭐ |
| 小红书 (xiaohongshu) | Jina Reader + agent-browser 兜底 | ⭐⭐⭐ |
| PDF | 手动下载 + LLM 提取 | ⭐⭐⭐ |
| 纯文本 (text) | 直接写入 | ⭐⭐⭐⭐⭐ |

## 使用示例

```bash
# 初始化项目
knowflow init

# 摄取网页（自动检测）
knowflow ingest https://arxiv.org/abs/2401.xxxxx

# 手动指定来源类型
knowflow ingest https://x.com/user/status/123 --source twitter
knowflow ingest https://mp.weixin.qq.com/s/xxx --source wechat

# 纯文本入库
knowflow ingest "这是一段要记录的知识内容" --source text

# 搜索知识库
knowflow query "AI Agent"

# 构建并查看知识图谱
knowflow graph

# 健康检查
knowflow health

# 查看状态概览
knowflow status
```

## 完整工作流示例

用户说："把这个 URL 存到 wiki：https://arxiv.org/abs/2401.xxxxx"

```
Step 1: knowflow ingest https://arxiv.org/abs/2401.xxxxx
        → raw/web/20260424-web-arxiv.org.md ✅

Step 2: 阅读 raw 内容，识别出：
        - 新实体: 论文作者 XXX → wiki/entities/xxx.md
        - 新概念: YYYY 方法 → wiki/concepts/yyyy.md
        - 来源页: wiki/sources/2026-04-24-arxiv-paper.md

Step 3: 写作所有页面，建立 [[wikilink]] 交叉引用

Step 4: 更新 wiki/log.md 和 wiki/index.md

Step 5: knowflow graph  → 刷新知识图谱
```

## 最佳实践

1. **每次摄取后立即更新 log.md** — 这是审计追踪的关键
2. **先读后写** — 创建新页面前先列出已有页面，避免重复
3. **wikilink 是灵魂** — 没有交叉引用的 wiki 只是文件夹。每篇来源页至少 3 条 wikilink
4. **图谱双轨制** — 日常用 `graph_builder.py`（快速），定期用 Understand-Anything（深度）
5. **保留原始数据** — 永远不删除 `raw/` 下的文件，它是溯源基础
6. **质量 > 数量** — 一篇高质量的 10 要点文章胜过 10 篇泛泛而谈

## 路线图

- [x] CLI 完整命令集（ingest, query, graph, health, status）
- [x] 多平台 URL 摄取（网页、Twitter、公众号、YouTube、小红书）
- [x] 轻量级知识图谱（vis.js）
- [x] 混合向量 + 关键词检索
- [ ] Understand-Anything 深度图谱集成
- [ ] 增量摄取（跳过已处理的 URL）
- [ ] 自定义提取器插件系统
- [ ] Web UI 可视化面板

## 许可证

[MIT](../LICENSE) © 2026 KnowFlow Contributors
