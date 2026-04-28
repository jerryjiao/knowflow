# KnowFlow 系统架构

## 整体流程

```
┌─────────────────────────────────────────────────────────────┐
│                        输入层 (Input)                         │
│  URL │ Tweet │ PDF │ WeChat │ YouTube │ Bookmark            │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Step 1: Fetch (摄取)                      │
│  自动识别来源类型 → 全文提取 → 存入 raw/                     │
│  scripts/ingest.sh → fetcher 模块                            │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Step 2: Extract (提取)                      │
│  LLM 分析内容 → 提取实体/概念/关系 → JSON Schema 约束输出    │
│  scripts/batch-ingest.js → extractor 模块                   │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Step 3: Compile (编译)                      │
│  用模板渲染 Wiki 页面 → 自动交叉链接 → 写入 wiki/             │
│  templates/{entity,concept,comparison,source}.md            │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
          ┌────────────┴────────────┐
          ▼                         ▼
┌─────────────────────┐  ┌─────────────────────────────────┐
│  Step 4: Graph       │  │  Step 5: Vector                │
│  知识图谱构建         │  │  向量索引构建                   │
│  scripts/graph_      │  │  scripts/vector-store.mjs       │
│  builder.py          │  │  scripts/vector_store.py        │
│  → graph.json        │  │  → vector-store.mjs-data/      │
│  → graph.html       │  │                               │
└─────────────────────┘  └─────────────────────────────────┘
```

## 目录结构详解

```
knowflow/
├── bin/
│   └── knowflow.js          # CLI 入口，命令路由
├── scripts/
│   ├── ingest.sh            # 单条 URL 完整管线（fetch→extract→compile）
│   ├── batch-ingest.js      # 批量处理（检测新文件 + 并行 ingest）
│   ├── enrich-wiki.js       # Wiki 后处理（链接补全、摘要生成）
│   ├── graph_builder.py     # 从 Wiki 页面构建知识图谱
│   ├── graph_relation_labeler.py  # LLM 分析关系类型
│   ├── vector-store.mjs     # 向量索引（Embedding + 存储）
│   ├── vector_store.py      # 向量检索接口
│   ├── pipeline.sh          # 5 步全自动化管线
│   ├── bookmark_sync.sh     # X/Twitter 书签同步
│   ├── wechat_sync.sh       # 微信公众号文章同步
│   └── wiki-health.sh       # 健康检查（断链、空页面、孤立页）
├── templates/
│   ├── entity.md            # 实体页模板（人物/公司/项目）
│   ├── concept.md           # 概念页模板（方法论/技术概念）
│   ├── comparison.md        # 对比页模板（A vs B）
│   └── source.md            # 来源页模板（原始内容摘要）
├── docs/
│   ├── methodology/         # 方法论文档
│   ├── architecture/        # 架构文档（本文件）
│   └── reference/           # 参考文档
├── articles/               # 博客系列文章
├── .knowflowrc.example      # 配置示例
└── package.json
```

## 数据流

### 单条 URL 的完整生命周期

```
1. 用户执行: knowflow ingest https://example.com/article

2. Fetch 阶段:
   - 检测 URL 类型（普通网页 / Twitter / YouTube / PDF）
   - 选择对应的 fetcher
   - 下载全文，提取标题、作者、日期等元数据
   - 存储为 raw/{timestamp}-{slug}.md

3. Extract 阶段:
   - 读取 raw 文件
   - 调用 LLM（带 JSON Schema 约束）提取:
     {
       "entities": [{name, type, description, mentions}],
       "concepts": [{name, definition, related}],
       "summary": "...",
       "key_points": ["..."]
     }
   - 结果存入临时变量

4. Compile 阶段:
   - 根据提取结果选择模板:
     - 主要实体 → entity.md
     - 新概念 → concept.md
     - 与已有实体对比 → comparison.md
     - 来源记录 → source.md
   - 渲染 Markdown，自动添加 [[WikiLink]] 语法
   - 扫描已有 Wiki 页面，添加反向链接

5. Graph 阶段:
   - 解析所有 Wiki 页面中的 `[[link]]` 语法
   - 构建节点和边
   - 调用 LLM 标注关系类型（"created_by"、"uses"、"competes_with" 等）
   - 输出 graph.json + graph.html

6. Vector 阶段:
   - 对每个 Wiki 页面做 Embedding
   - 存入本地向量索引
   - 支持语义搜索查询
```

## 关键设计决策

### 为什么用 JSON Schema 约束 LLM 输出？

LLM 的自由输出格式不可预测。JSON Schema 就像合同——告诉 AI "我只要你这种格式的输出"。代码里加了 fallback：解析失败重试一次，再失败就当纯文本存入。

### 为什么 Wiki 用 Markdown 而不是数据库？

- **人类可读** — 直接用编辑器打开就能看
- **版本控制友好** — Git 可以追踪每次变更
- **AI 友好** — LLM 天然擅长生成和理解 Markdown
- **可移植** — 不依赖任何数据库服务

### 为什么图谱和向量都要？

| 能力 | 知识图谱 | 向量检索 |
|------|---------|---------|
| 精确查找 | ✅ 按实体名/关系查 | ❌ |
| 语义搜索 | ❌ | ✅ "类似 XXX 的内容" |
| 发现关联 | ✅ A→B→C 的路径 | ❌ |
| 模糊匹配 | ❌ | ✅ 语义相近即可 |

两者互补，缺一不可。

## 技术栈

| 组件 | 技术 | 原因 |
|------|------|------|
| CLI 运行时 | Node.js | npm 生态，开发者熟悉 |
| 内容提取 | 智谱 AI (GLM-Flash) | 性价比高，中文优秀 |
| 知识图谱 | Python + vis.js | 图算法成熟，可视化好 |
| 向量索引 | 本地 Embedding | 无需外部服务，隐私安全 |
| 数据存储 | 文件系统 (Markdown) | 零依赖，Git 友好 |
