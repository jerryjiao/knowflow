# 手把手教你：从 URL 到知识库，第一步怎么做

## 这篇文章解决什么问题

你知道 KnowFlow 能把 URL 变成 Wiki，但中间到底发生了什么？这篇文章拆解第一步：信息进来的完整链路。四个步骤。

## Step 1: 内容获取 (Fetch)

你丢一个 URL 给 KnowFlow，第一件事不是"用 AI 分析"，而是把网页内容拿下来。这步做不好后面全废。

### 怎么拿？

KnowFlow 的 `ingest.sh` 会**自动识别来源类型**，然后选择最合适的提取方式：

- **普通网页** → Jina Reader（免费网页转 Markdown API）
- **Twitter/X** → Jina Reader 或 twitter CLI
- **微信公众号** → 专用提取逻辑
- **小红书** → Jina Reader 优先（失败则保存原始链接），agent-browser 可选降级（需 JS 渲染）
- **YouTube** → 元数据提取
- **纯文本** → 直接保存

为什么主要用 Jina Reader？因为现代网页太恶心了——JS 渲染、反爬、动态加载、编码问题……Jina 帮你搞定：返回干净的 Markdown，保留标题正文图片链接表格。

### 存到哪里？

按来源类型分目录存到 `raw/` 下。文件名带时间戳避免重复。同时更新 `ingest-state.json` 记录已处理的 URL，下次不会重复 ingest。

### 踩坑：小红书需要浏览器渲染

Jina Reader 对大部分网站有效，但小红书不行——内容是 JS 动态加载的。目前的方案：Jina 失败后自动保存原始链接 + 提示用户。如果安装了 agent-browser，可以后续接入浏览器渲染提取完整内容。

<!-- ✏️ 编辑建议:如果你有自己踩过的爬虫坑，可以在这里加一个 -->

## Step 2: AI 提取 (Extract)

原始内容拿到了。交给 AI。这一步最关键，也最容易翻车。

这是最核心的一步——让 LLM 把非结构化文本变成结构化数据。说起来一句话，做起来全是细节。

### Prompt 设计

KnowFlow 的 `enrich-wiki.js` 会读取 raw 文件，给 LLM 发一段精心设计的 prompt，要求输出结构化的提取结果。三类信息：

- **Entities** — 实体：人名、公司、项目
- **Concepts** — 概念：术语、方法论
- **Relations** — 关系：谁创建了啥、谁用了啥技术

### 为什么用 JSON Schema 强制结构化

为什么不直接让 AI 输出自然语言？因为下游要程序化处理啊兄弟。AI 自由发挥的话输出格式不可预测，下游代码就没法稳定解析。JSON Schema 就像合同——告诉 AI "我只要你这种格式的输出"。

当然实际操作中 AI 不一定每次都乖乖遵守 Schema。所以代码里加了 fallback：解析失败重试一次，再失败就当纯文本存入，不阻塞管线。工程妥协——好听点叫"优雅降级"。

### 用哪个 AI 模型？

默认智谱 AI **GLM-4-Flash**。中文 embedding 效果好。实测数据说话。

也支持 OpenAI 和 Anthropic——`.knowflowrc` 里改 `ai.provider` 就行。切换成本几乎为零。

## Step 3: Wiki 生成 (Compile)

提取结果有了。变成人类可读的 Wiki 页面。

三种页面模板：
- **实体页** — 人物/公司/项目
- **概念页** — 技术概念/方法论
- **对比页** — 两个事物 PK

模板里用了 `[[双向链接]]` 语法——提到 OpenAI 自动写成 `[[OpenAI]]`，点击跳转。时间一长形成一张网。知识图谱的数据来源就是这张网。

### 实际效果

以 Karpathy 的 LLM Wiki Gist 为例，ingest 之后生成：1 个来源页 + 1 个概念页 + 1 个对比页 + 1 个实体页 + 索引页和概览页。一份素材触发 4-5 个页面创建或更新。"涟漪效应"。

## Step 4: 状态管理

`ingest-state.json` 记录每个 URL 处理状态。三个作用：
- **去重** — 不浪费时间重复处理
- **断点续传** — ingest 翻不了身时能恢复
- **可追溯** — 排查问题时能救命

## 本篇小结

数据流前半段：URL → 来源检测 → Fetch(Raw) → LLM Extract(JSON) → Wiki Pages → State Update。

下一步 P4 讲后半段：Wiki 怎么变知识图谱？向量检索怎么工作？混合检索什么鬼操作？

源码已在 [GitHub](https://github.com/jerryjiao/knowflow) 开源，欢迎 star / fork / 提 issue。
