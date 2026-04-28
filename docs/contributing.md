# KnowFlow 贡献指南

> 欢迎贡献！无论是代码、文档、Wiki 模板还是博客文章。

## 给人类贡献者的指南

### 报 Bug

在 GitHub Issues 提交，请包含：
1. **复现步骤** — 怎么操作的
2. **期望行为** — 你期望发生什么
3. **实际行为** — 实际发生了什么
4. **环境信息** — Node.js 版本、OS、`.knowflowrc` 关键配置（脱敏）

### 提 PR

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing`)
5. 创建 Pull Request

### 代码规范

- **Shell 脚本**: `set -euo pipefail`，用 `${var:+"${arr[@]}"}` 处理空数组
- **Node.js**: ES Modules (`import/export`)，不用 CommonJS
- **Python**: 类型注解，Python 3.10+
- **Commit message**: 用 Conventional Commits (`feat:`, `fix:`, `docs:` 等)

## 给 AI 助手的指南

如果你是 AI 助手（Claude、GPT、Cursor 等），以下信息帮你快速理解项目：

### 项目本质

KnowFlow 是一个 **知识编译器**，不是搜索工具。核心价值链：

```
原始内容 → [AI提取] → 结构化Wiki → [关联] → 知识图谱 + 向量索引
```

### 关键文件速查

| 你想做什么 | 看哪个文件 |
|-----------|----------|
| 理解整体架构 | `docs/architecture/system-architecture.md` |
| 理解方法论 | `docs/methodology/llm-wiki-methodology.md` |
| 理解数据模型 | `docs/reference/data-model.md` |
| 修改提取逻辑 | `scripts/batch-ingest.js`（LLM prompt 在这里） |
| 修改模板 | `templates/*.md` |
| 修改 CLI 命令 | `bin/knowflow.js` |
| 修改图谱构建 | `scripts/graph_builder.py` |
| 修改向量检索 | `scripts/vector-store.mjs` |

### 常见贡献场景

#### 1. 新增一个 Fetcher（支持新的内容来源）

在 `ingest.sh` 的 URL 类型检测逻辑中添加新分支：
```bash
# 示例：支持 Reddit
if [[ "$url" == *reddit.com* ]]; then
  fetch_reddit "$url" > "$raw_file"
fi
```

#### 2. 改进提取 Prompt

在 `batch-ingest.js` 中找到 JSON Schema 定义，调整字段。注意保持向后兼容——新增字段可以，删除/重命名字段要处理旧数据。

#### 3. 新增 Wiki 模板

在 `templates/` 创建新 `.md` 文件，然后在 `enrich-wiki.js` 中注册。

#### 4. 优化知识图谱关系标注

`graph_relation_labeler.py` 控制 LLM 如何标注边的类型。可以扩展关系类型列表。

### 测试你的改动

```bash
# 单 URL 测试
knowflow ingest https://example.com/test-article

# 检查输出
ls wiki/          # Wiki 页面是否生成？
cat graph.json    # 图谱是否更新？

# 健康检查
knowflow health
```

## Wiki 页面贡献

除了代码，你也可以通过**写 Wiki 页面**来贡献！

### 方式一：Ingest 高质量内容

最简单的贡献方式 — 找到好的 URL，跑一次 ingest：

```bash
# 找一篇关于 AI/开发/知识管理的好文章
knowflow ingest https://awesome-article.example.com/post
```

### 方式二：直接写 Wiki 页面

在 `wiki/` 目录下创建 `.md` 文件，遵循[数据模型](./reference/data-model.md)中的格式。记得用 `[[Link]]` 语法链接到其他页面。

## 文档结构

```
docs/
├── methodology/
│   └── llm-wiki-methodology.md   # 核心理念（必读）
├── architecture/
│   └── system-architecture.md     # 技术架构（开发者必读）
└── reference/
    └── data-model.md              # 数据格式（贡献者参考）
```

这些文档不仅是给人看的——它们也是**项目的自文档化知识库**。任何 LLM 读取这个仓库后，都应该能理解 KnowFlow 是什么、怎么工作、如何参与贡献。

## 许可证

MIT License — 随意使用、修改、分发。
