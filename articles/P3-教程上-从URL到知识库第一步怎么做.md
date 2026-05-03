# 手把手教你：从 URL 到知识库，第一步怎么做

## 这篇文章解决什么问题

你知道 KnowFlow 能把 URL 变成 Wiki。但中间到底发生了什么？

四个步骤，带真实命令和输出。跟着跑就行。

## Step 1: 内容获取 (Fetch)

丢一个 URL 给 KnowFlow，第一件事不是"用 AI 分析"。先把内容拿下来。

这步做不好，后面全废。

```bash
bash scripts/ingest.sh https://example.com/article

# 想手动指定来源类型也行：
bash scripts/ingest.sh https://x.com/xxx twitter
```

`ingest.sh` 根据 URL 自动选提取方式：

| 来源 | 怎么认出来的 | 用什么抓 |
|------|-------------|---------|
| 网页 | `https?://` 开头 | Jina Reader |
| Twitter/X | 域名里有 `x.com` | Jina Reader 或 twitter CLI |
| 微信公众号 | `mp.weixin` | Jina Reader |
| 小红书 | `xiaohongshu` / `xhslink` | Jina（多半失败） |
| YouTube | `youtube` / `youtu.be` | yt-dlp |

跑一下看看效果：

```
$ bash scripts/ingest.sh https://gist.github.com/karpathy/xxx

🌐 检测到网页链接...
✅ 提取完成:
   📄 raw/web/2026-04-24-web-gist.github.com.md (12480 bytes, 312 行)
   🔧 方法: jina_reader
```

为什么主要用 Jina Reader？因为现代网页太复杂了——JS 渲染、反爬、动态加载、编码问题……自己写爬虫的话三天就能劝退。Jina 帮你搞定这些脏活，返回干净的 Markdown，标题正文图片链接表格都保留。

文件名带时间戳，同 URL 多次跑不会覆盖旧文件。这个设计在改版对比时救过我一次——翻出两个时间戳不同的文件就搞定了。

> 小红书是个特例。Jina 对大部分网站有效，但小红书内容是 JS 动态渲染的，拿到的往往只是空壳（有标题没正文，或只有"查看更多"四个字）。目前方案是失败后保存原始链接 + 提示用户。装了 agent-browser 的话可以接浏览器渲染，但速度会慢很多。

<!-- ✏️ 编辑建议:如果你有自己踩过的爬虫坑，可以在这里加一个 -->

## Step 2: AI 提取 (Extract)

原始内容拿到了，交给 AI。这步最关键，也最容易出问题。说起来一句话，做起来全是细节。

`enrich-wiki.js` 读 raw 文件，给 LLM 发 prompt，要求输出三类信息：

- **Entities** — 实体：人名、公司、项目
- **Concepts** — 概念：术语、方法论
- **Relations** — 关系：谁创建了啥、谁用了啥技术

核心要求：**输出必须是合法 JSON**。不要自由发挥。

为什么不直接让 AI 输出自然语言？因为下游要程序化处理啊。AI 自由发挥的话格式不可预测——今天 Markdown 列表明天散文后天 JSON 里塞注释，下游怎么解析？

JSON Schema 就像合同，告诉 AI "我只要你这种格式的输出"，别的不要。不听话？重试。再不听？降级处理呗。

期望的结构大概长这样：

```json
{
  "entities": [
    {
      "name": "Andrej Karpathy",
      "type": "人物",
      "summary": "前 Tesla AI 总监"
    }
  ],
  "concepts": [
    {
      "name": "LLM Wiki 方法论",
      "definition": "让 LLM Agent 将素材编译成结构化 Wiki"
    }
  ]
}
```

AI 不一定每次都乖乖遵守。所以代码里加了 fallback：解析失败重试一次，再失败存纯文本，不阻塞管线。工程上的妥协，好听点叫"优雅降级"。

第一次跑 `enrich-wiki.js` 时我盯着终端 30 秒没输出，以为脚本挂了——其实没挂，是在等 API 响应。免费版延迟比较高，耐心点就好。

默认模型是 **GLM-4-Flash**，中文效果意外地好。想换？`.knowflowrc` 改一行 `ai.provider`，OpenAI、Anthropic 随便切。

## Step 3: Wiki 生成 (Compile)

三种模板。最重要的**来源页**，每份素材自动生成一份：

```markdown
# LLM Wiki 方法论 - Andrej Karpathy

> 来源: GitHub Gist | 采集时间: 2026-04-24

## 📌 一句话总结
Karpathy 提出的个人知识库构建方法论...

## 🔑 核心要点
### 1. 编译 vs 检索
> LLM Wiki 则是**知识编译一次，持续维护**。(EXTRACTED)

## 🏷️ 提取的实体
- [[entities/karpathy-andrej]] — 作者，前 Tesla AI 总监
```

剩下两种一句话带过：

- **概念页** — 定义 + 多角度解读 + 优化层级表格（Token 经济学那篇就是典型）
- **对比页** — 双栏 PK 表格 + 选谁的建议（Claude vs GPT 那种）

模板用了 `[[双向链接]]` 语法。提到 OpenAI 自动写成 `[[OpenAI]]`，点击跳转。这个设计我从 Obsidian 搬过来的，用久了回不去普通 Markdown。

**涟漪效应。** 一份 Gist 到 1 个来源页 + 2 个概念页 + 1 个对比页 + 1 个实体页 = **4~5 个页面被创建或更新**。丢一颗石子，整张网都在动。

## Step 4: 状态管理

`ingest-state.json` 记录每个 URL 的处理状态：

```json
{
  "https://gist.github.com/karpathy/...": {
    "status": "completed",
    "file": "raw/web/2026-04-24-web-gist.github.com.md",
    "pages_created": ["sources/gist-karpathy", "concepts/llm-wiki-methodology"]
  }
}
```

三个作用：去重（不重复处理）、断点续传（中途挂了能恢复）、可追溯（排查问题时救命）。有一次批量导入 50 个 URL 跑到第 37 个网络断了，没这个状态文件的话前面 37 个结果就全丢了。

不是黑魔法，就这么点东西。

## 动手试一试

别光看，跑一下：

```bash
git clone https://github.com/jerryjiao/knowflow.git && cd knowflow
bash scripts/ingest.sh https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
cat raw/web/*gist*.md | head -50
ls sample-wiki/sources/ sample-wiki/concepts/
```

用自己的博客或 Twitter thread 试一遍。报错了也别慌，80% 是网络或 API key 问题。实在不行来提 issue，贴上 `ingest-state.json` 方便排查。

## 本篇小结

**URL → 来源检测 → Fetch(Raw) → LLM Extract(JSON) → Wiki Pages → State Update**

四个关键设计：Jina Reader 统一获取、JSON Schema 强制结构化、三种 Wiki 模板、状态文件保证可恢复。

下一步 P4 讲后半段：Wiki 怎么变知识图谱？向量检索怎么工作？混合检索又是什么鬼操作？

源码已在 [GitHub](https://github.com/jerryjiao/knowflow) 开源，欢迎 star / fork / 提 issue。
