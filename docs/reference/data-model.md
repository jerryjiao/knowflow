# KnowFlow 数据模型

## Wiki 页面类型

### 实体页 (Entity)

```markdown
# {name}

**类型**: {person | organization | project | product | location}
**来源**: [{source_url}]
**首次提及**: {date}

## 简介
{description 一段话}

## 关键信息
- {field}: {value}
- {field}: {value}

## 相关概念
- [[Concept1]]
- [[Concept2]]

## 相关实体
- [[EntityA]] — {关系描述}
- [[EntityB]] — {关系描述}

---
*最后更新: {date} | 来源: {url}*
```

### 概念页 (Concept)

```markdown
# {name}

**分类**: {methodology | technology | framework | pattern}

## 定义
{清晰的技术定义，1-3 句话}

## 核心要点
1. **Point 1** — 解释
2. **Point 2** — 解释
3. **Point 3** — 解释

## 与其他概念的关系
- **父概念**: [[ParentConcept]]
- **子概念**: [[ChildConcept]]
- **对比**: [[SimilarConcept]] (差异在于...)

## 实际应用
- 在 {context} 中，{how it's used}
- {example from real world}

## 参考
- [{source_title}]({url})
```

### 对比页 (Comparison)

```markdown
# {A} vs {B}

## 概述
{一句话说明两者定位差异}

## 对比维度

| 维度 | {A} | {B} |
|------|-----|-----|
| 定位 | ... | ... |
| 适用场景 | ... | ... |
| 优势 | ... | ... |
| 劣势 | ... | ... |
| 学习成本 | ... | ... |
| 生态 | ... | ... |

## 结论
{什么场景选 A，什么场景选 B}

## 相关
- [[RelatedEntity1]]
- [[RelatedConcept1]]
```

### 来源页 (Source)

```markdown
# {title}

**原始链接**: {url}
**作者**: {author}
**发布日期**: {date}
**摄取时间**: {ingest_date}

## 摘要
{AI 生成的 2-3 句摘要}

## 提取的实体
- [[Entity1]] ({type})
- [[Entity2]] ({type})

## 涉及的概念
- [[Concept1]]
- [[Concept2]]

## 关键观点
1. "{quote or key point}"
2. "{quote or key point}"
```

## 内部数据格式

### .ingest-state.json

```json
{
  "files": {
    "raw/article-001.md": {
      "mtime": "1740000000",
      "hash": "abc123def456"
    }
  },
  "lastIngestAt": "2026-04-28T10:00:00"
}
```

用途：追踪哪些 raw 文件已被处理，支持增量 ingest。

### graph.json

```json
{
  "nodes": [
    {"id": "knowflow", "label": "KnowFlow", "type": "project", "size": 15},
    {"id": "rag", "label": "RAG", "type": "concept", "size": 10},
    {"id": "llm-wiki", "label": "LLM Wiki", "type": "concept", "size": 10},
    {"id": "jerry", "label": "Jerry", "type": "person", "size": 5}
  ],
  "edges": [
    {"source": "jerry", "target": "knowflow", "label": "created_by"},
    {"source": "knowflow", "target": "rag", "label": "alternative_to"},
    {"source": "knowflow", "target": "llm-wiki", "label": "implements"},
    {"source": "knowflow", "target": "glm-flash", "label": "uses"}
  ]
}
```

### .bookmark-state.json

```json
{
  "lastSyncAt": "2026-04-28T10:00:00",
  "lastProcessedId": "18923456789012",
  "stats": {
    "totalBookmarks": 150,
    "processedCount": 130,
    "newThisRun": 5,
    "skippedCount": 15
  }
}
```

## Wiki Link 语法

KnowFlow 使用 `[[Name]]` 语法表示内部链接：

```markdown
// 标准链接
[[RAG]]

// 带显示文本
[[检索增强生成|RAG]]

// 链接自动解析规则:
// 1. 精确匹配已有页面标题 → 直接链接
// 2. 模糊匹配（编辑距离 < 3）→ 警告但创建
// 3. 无匹配 → 创建新页面占位（标记为 stub）
```

## 配置文件 (.knowflowrc)

```yaml
# LLM 配置
llm:
  provider: "zhipuai"        # zhipuai | openai
  model: "glm-4-flash"       # 提取用模型
  chat_model: "glm-4-flash"  # 对话/查询用模型
  api_key_env: "ZHIPUAI_API_KEY"  # 环境变量名

# Wiki 配置
wiki:
  root: ./wiki               # Wiki 输出目录
  raw_dir: ./raw             # 原始内容存储
  templates_dir: ./templates # 模板目录

# 图谱配置
graph:
  output: ./graph/graph.html
  auto_label: true           # 是否用 LLM 自动标注关系类型

# 向量配置
vector:
  provider: "local"          # local | openai
  index_dir: ./vector-store.mjs-data
  dimensions: 1024
  similarity_threshold: 0.7

# 同步配置
sync:
  bookmarks: true            # 是否同步 X 书签
  wechat: false              # 是否同步微信（需配置）
  
# 发布设置
publish:
  skip_image_gen: false      # 是否跳过图片生成
  skip_publish: true          # 是否跳过微信推送
```
