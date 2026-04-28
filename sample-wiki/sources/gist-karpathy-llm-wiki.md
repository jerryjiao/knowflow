# LLM Wiki 方法论 - Andrej Karpathy

> 来源: GitHub Gist | 采集时间: 2026-04-24 | 原文链接: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f

## 📌 一句话总结
Karpathy 提出的个人知识库构建方法论：让 LLM Agent 将原始素材编译成结构化、持续积累的 Markdown Wiki，替代传统 RAG 的"每次从零检索"模式。

## 🔑 核心要点

### 1. 核心差异：编译 vs 检索
> 传统 RAG 每次查询都从原始文档重新检索拼接，LLM Wiki 则是**知识编译一次，持续维护**。Wiki 是一个持久化的、复合增长的产物——交叉引用已建好、矛盾已标记、综合已完成。 (EXTRACTED)

### 2. 三层架构
> Raw（原始材料，不可变）→ Wiki（知识中间层，Agent 维护）→ Schema（规则文件，人+Agent 共同迭代）。Obsidian 是 IDE，LLM 是程序员，Wiki 是代码库。 (EXTRACTED)

### 3. Ingest 操作的深度
> 一份新素材不只是创建一个摘要页，而是应该触碰 **10-15 个 wiki 页面**——更新实体页、修订概念页、标注矛盾、追加对比。批量 ingest 会降低质量，建议一次一份并保持人工参与。 (EXTRACTED)

### 4. Query 结果可回存
> 好的查询答案本身就有价值，应该作为新页面存回 Wiki。这样探索过程也像 ingest 一样在知识库中复合增长。 (EXTRACTED)

### 5. Lint 健康检查
> 定期执行：检测矛盾、孤立页面、缺失引用、数据空白。LLM 擅长建议新调查方向和待读来源。 (EXTRACTED)

### 6. 适用场景极广
> 个人目标追踪/自我提升、深度研究（数周数月）、读书笔记（角色/主题/情节线）、团队内部 Wiki（Slack/会议纪要）、竞品分析、尽职调查、旅行规划、课程笔记、爱好深挖。 (EXTRACTED)

### 7. Index + Log 双文件导航
> index.md 是内容导向的目录（分类+摘要+元数据），log.md 是时间线（append-only，可用 grep 解析）。两者配合可以在中等规模下（~100来源，~数百页）高效工作，无需向量数据库。 (EXTRACTED)

### 8. 可选 CLI 工具
> 规模增长后可以加搜索引擎，推荐 qmd（本地 Markdown 搜索，混合 BM25/向量搜索 + LLM 重排序，全本地运行）。 (EXTRACTED)

## 🏷️ 提取的实体
- [[entities/karpathy-andrej]] — 作者，前 Tesla AI 总监
-  — 知识管理工具，K 神推荐作为 Wiki 浏览器

## 💡 提取的概念
- [[concepts/llm-wiki-methodology]] — 核心方法论
- [[concepts/rag-vs-wiki-compilation]] — 与传统 RAG 的对比
- [[concepts/knowledge-compilation-pattern]] — 知识编译模式

## 🔗 与其他来源的关系
- 这是 LLM Wiki 方法的**源头/奠基性文档**
- 后续所有实现（sdyckjq/SamurAIGPT/nashsu 等）都基于此

## ⭐ 个人备注 / 行动项
- [x] 已基于此方法论构建 jerry-wiki skill
- [ ] 用真实素材测试完整 ingest 流程 ← **当前正在做**
- [ ] 考虑接入 Understand-Anything (8749⭐) 做知识图谱可视化
- [ ] 评估 qmd 作为本地搜索引擎
