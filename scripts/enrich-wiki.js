#!/usr/bin/env node
/**
 * Wiki Enrichment Pass 2 (M2 Enhanced)
 * Samples actual content from raw files → enriches entity & concept pages with real details
 *
 * M2 改进:
 *   - 每个主要步骤添加 try-catch 错误处理
 *   - console.log 带时间戳的进度日志
 *   - 输出格式一致（JSON Schema 思路：结构化结果对象）
 *   - 核心逻辑不变，只加健壮性
 */
const fs = require('fs');
const path = require('path');

// ── Timestamp logger ──────────────────────────────────
function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] ${msg}`);
}

// ── Paths ──────────────────────────────────────────────
const RAW_DIR = path.join(__dirname, '..', 'raw', 'web');
const WIKI_DIR = path.join(__dirname, '..', 'wiki');
const ENTITIES_DIR = path.join(WIKI_DIR, 'entities');
const CONCEPTS_DIR = path.join(WIKI_DIR, 'concepts');

// ── Structured result (JSON Schema 思路) ──────────────
const result = {
  status: 'ok',
  enriched_entities: 0,
  total_entities: 0,
  enriched_concepts: 0,
  total_concepts: 0,
  errors: [],
  warnings: [],
};

// Read existing entity and concept pages
function loadDir(dir) {
  try {
    const result = {};
    if (!fs.existsSync(dir)) {
      log(`⚠️  目录不存在，将创建: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
      return result;
    }
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.md')) {
        try {
          result[f] = fs.readFileSync(path.join(dir, f), 'utf-8');
        } catch (e) {
          log(`⚠️  读取失败 ${dir}/${f}: ${e.message}`);
          result.warnings.push({ file: `${dir}/${f}`, error: e.message });
        }
      }
    }
    return result;
  } catch (e) {
    log(`❌ 加载目录失败 ${dir}: ${e.message}`);
    result.errors.push({ step: 'loadDir', dir, error: e.message });
    return {};
  }
}

log('📂 开始加载 Wiki 页面...');
let entityPages, conceptPages;
try {
  entityPages = loadDir(ENTITIES_DIR);
  conceptPages = loadDir(CONCEPTS_DIR);
  log(`   实体页: ${Object.keys(entityPages).length}, 概念页: ${Object.keys(conceptPages).length}`);
} catch (e) {
  log(`❌ 加载页面失败: ${e.message}`);
  result.errors.push({ step: 'loadPages', error: e.message });
  result.status = 'error';
  // Still try to continue — partial enrichment is better than nothing
  entityPages = entityPages || {};
  conceptPages = conceptPages || {};
}

// Key entities we want to deeply enrich with actual content
const KEY_ENTITIES = {
  'Claude-Code.md': {
    type: '产品',
    summary: 'Anthropic 推出的 AI 编程 Agent 终端工具，支持 Skills 系统、SubAgent 调用、NO_FLICKER 模式等',
    aliases: ['Claude Code', 'claude code', 'CC']
  },
  'OpenClaw.md': {
    type: '产品/平台',
    summary: '开源 AI Agent 运行时框架，GitHub Stars 突破 10 万，支持 Skill 系统、多 Agent 协作、飞书集成等',
    aliases: ['OpenClaw', 'openclaw', '龙虾']
  },
  'Codex.md': {
    type: '产品',
    summary: 'OpenAI 的 AI 编程工具，可作为 Claude Code 的 SubAgent 使用，性价比高（50元/月 vs Claude $100）',
    aliases: ['Codex', 'codex', 'OpenAI Codex']
  },
  'XCrawl.md': {
    type: '产品',
    summary: '网页抓取 Skill，解决 OpenClaw 数据采集痛点，支持搜索/抓取/全站爬取，集成 OpenClaw',
    aliases: ['XCrawl', 'xcrawl']
  },
  'WeWrite.md': {
    type: '产品',
    summary: '公众号自动化发文 Skill，开源，突破 1100 star，支持 Markdown 一键排版发送到微信草稿箱',
    aliases: ['WeWrite', 'wewrite', '公众号自动化发文']
  },
  'DeerFlow.md': {
    type: '产品',
    summary: '字节跳动开源 SuperAgent 框架 2.0 版本，面向研究、编程和创意的超级 Agent 架构',
    aliases: ['DeerFlow', 'deerflow', 'Deer-Flow', '字节DeerFlow']
  },
  'GBrain.md': {
    type: '产品',
    summary: 'YC 总裁 Garry Tan 开源的生产级 AI Agent 记忆系统',
    aliases: ['GBrain', 'gbrain', 'Garry Tan memory system']
  },
  'Coze-Work.md': {
    type: '产品',
    summary: '字节跳动扣子 Coze 2.5 发布，被称为"字节版 OpenClaw 平替"，普通人也能上手的 AI Agent 平台',
    aliases: ['Coze', 'coze', '扣子', 'Coze 2.5']
  },
  '宝玉-dotey.md': {
    type: '人物',
    summary: 'AI 工具领域知名博主，baoyu-skills 作者（2个月 10K+ stars），专注 Claude Code / AI 编程工具',
    aliases: ['dotey', '宝玉', '@dotey']
  },
  'Garry-Tan.md': {
    type: '人物',
    summary: 'Y Combinator 总裁，开源 gstack（AI 工作流）和 GBrain（Agent 记忆系统）',
    aliases: ['Garry Tan', 'garrytan', '@garrytan']
  },
  'Cloudflare.md': {
    type: '公司/平台',
    summary: '提供 Workers（边缘计算）、R2（对象存储）、Email Sending、DNS 等免费/低价服务，被社区称为"赛博大善人"',
    aliases: ['Cloudflare', 'cloudflare', 'CF']
  },
  'Tailscale.md': {
    type: '产品',
    summary: '组网工具，配合 SSH 实现多设备并网，构建"分布式大脑"开发环境',
    aliases: ['Tailscale', 'tailscale']
  },
  'RedBox.md': {
    type: '产品',
    summary: '小红书运营全流程 AI 化工具，从找灵感到发帖全自动',
    aliases: ['RedBox', 'redbox']
  },
  'RedClaw.md': {
    type: '产品',
    summary: '小红书版 OpenClaw（原 RedConvert），专注小红书运营自动化',
    aliases: ['RedClaw', 'redclaw', '小红书版OpenClaw']
  },
  'NotebookLM.md': {
    type: '产品',
    summary: 'Google 的论文阅读/学习神器，有 CLI 版本，可与 Claude + Anki 组合使用学语言',
    aliases: ['NotebookLM', 'notebooklm']
  },
  'mem9.md': {
    type: '产品',
    summary: 'OpenClaw 最强记忆方案，实现永续记忆能力',
    aliases: ['mem9']
  },
  'huobao-drama.md': {
    type: '产品',
    summary: '开源 AI 短剧自动化平台（chatfire-AI/huobao-drama），2 小时可跑完 50 集',
    aliases: ['huobao-drama', '短剧自动化', 'chatfire']
  },
  'VideoLingo.md': {
    type: '产品',
    summary: 'AI 视频翻译/配音开源项目，适合做 AI 副业',
    aliases: ['VideoLingo', 'videolingo']
  },
  'nexu.md': {
    type: '产品',
    summary: 'OpenClaw 桌面端客户端 v0.1.6，最生产级别的桌面开发实践',
    aliases: ['nexu']
  },
  'Accio-Work.md': {
    type: '产品',
    summary: '阿里上线的电商版 OpenClaw，面向电商场景的 AI Agent 平台',
    aliases: ['Accio Work', 'Accio-Work', 'accio']
  },
  'ClawTeam.md': {
    type: '产品',
    summary: '港大（HKU）开源 AI Agent 团队协作框架',
    aliases: ['ClawTeam', 'clawteam']
  },
  'OpenSpace.md': {
    type: '产品',
    summary: '港大团队开源的 Agent 自动进化引擎',
    aliases: ['OpenSpace', 'openspace']
  },
  'OPC-Methodology.md': {
    type: '方法论',
    summary: '一人公司（One Person Company）方法论，GitHub 14.5k stars 的独立创业完整指南',
    aliases: ['OPC', '一人公司', 'OPC methodology']
  },
  'DeepSeek.md': {
    type: '公司',
    summary: '中国 AI 公司，开源 DeepSeek 系列模型，在编程和推理能力上有竞争力',
    aliases: ['DeepSeek', 'deepseek']
  },
  'MiniMax.md': {
    type: '公司',
    summary: '中国 AI 公司，官方开源硬核技能包（专门给 AI 写代码的专家外挂）',
    aliases: ['MiniMax', 'minimax']
  },
  '李继刚.md': {
    type: '人物',
    summary: '知名 Skills 开发者，系列 Skills 涵盖旅游攻略、信息卡制作等多个领域',
    aliases: ['李继刚', 'lijigang', '@lijigang']
  },
  'Apple-Watch.md': {
    type: '产品',
    summary: '与 Claude 结合实现健康数据分析、心源性猝死征兆检测等健康应用',
    aliases: ['Apple Watch', 'apple watch']
  },
  'Obsidian.md': {
    type: '产品',
    summary: '知识管理工具，kepano 做了官方 Agent Skills（16k star），可搭建本地 AI 健康管理体系',
    aliases: ['Obsidian', 'obsidian']
  },
  'gstack.md': {
    type: '产品',
    summary: 'YC 总裁 Garry Tan 的私家 AI 工作流，含 /office-hours skill',
    aliases: ['gstack']
  },
  'last30days-skill.md': {
    type: '产品',
    summary: '全网风口聚合器，挖穿 10 个核心社区找赚钱线索',
    aliases: ['last30days-skill', 'last30days']
  },
  'GEO-Tool.md': {
    type: '产品',
    summary: 'AI 搜索引擎可见度审计工具（GEO Skill），支持独立运行 + CLI，有高级扩展版开源',
    aliases: ['GEO', 'geo', 'GEO Skill', 'GEOFlow']
  },
  'tldraw.md': {
    type: '产品',
    summary: '面向 React 开发者的无限画布 SDK，用于添加协作白板到产品中',
    aliases: ['tldraw']
  },
  'MagicUI.md': {
    type: '产品',
    summary: '全新思路的组件库，主打 Landing Page 动画视觉效果',
    aliases: ['MagicUI', 'magicui']
  },
  'FastHTML.md': {
    type: '产品',
    summary: 'Python Web 框架，与 Next.js、SvelteKit 并列对比的三种 Web 框架之一',
    aliases: ['FastHTML', 'fasthtml']
  },
  'Composio.md': {
    type: '产品',
    summary: '插件平台，让 OpenClaw 变成真正的 AI Agent，打通 18+ 第三方服务（Gmail/Notion/Slack 等）',
    aliases: ['Composio', 'composio']
  },
  'CrewAI.md': {
    type: '产品',
    summary: '多 Agent 协作框架开源项目，用于让 AI 组队干活',
    aliases: ['CrewAI', 'crewai']
  },
  'OpenMAIC.md': {
    type: '产品',
    summary: '清华开源 AI 教师 Agent，传统教育领域的 AI 应用',
    aliases: ['OpenMAIC', 'openmaic']
  },
  'Codex-Proxy.md': {
    type: '产品',
    summary: '统一管理多账号实现 Token 自由的工具，支持 Codex 轮询',
    aliases: ['Codex Proxy', 'codex proxy']
  },
  'GitHub-Copilot.md': {
    type: '产品',
    summary: 'GitHub 的 AI 编程工具，推出 CLI 版本 + Rubber Duck 功能 + 高级中转站方案',
    aliases: ['GitHub Copilot', 'Copilot', 'copilot']
  },
  '飞书.md': {
    type: '平台',
    summary: '与 OpenClaw/Claude 集成实现内容工作流：Claude-to-IM + 知识库 + 选题伙伴',
    aliases: ['飞书', 'feishu', 'lark']
  },
  '龙虾导航.md': {
    type: '产品',
    summary: '一个网站获取 OpenClaw 所有高质量内容的导航站',
    aliases: ['龙虾导航', 'lobster-nav']
  }
};

const today = '2026-04-26';

// ── Enrich Entity Pages ───────────────────────────────
log('🔧 开始丰富实体页面...');
let enrichedEntities = 0;
try {
  for (const [filename, info] of Object.entries(KEY_ENTITIES)) {
    try {
      if (!entityPages[filename]) {
        // Create new enriched entity page
        const lines = [
          `# ${info.summary.split('，')[0]}`,
          '',
          `## 类型`,
          info.type,
          '',
          `## 简介`,
          info.summary,
          '',
          `## 信息`,
          ''
        ];
        entityPages[filename] = lines.join('\n');
        enrichedEntities++;
      } else {
        // Enrich existing page with summary if missing
        if (!entityPages[filename].includes('## 简介')) {
          const typeIdx = entityPages[filename].indexOf('## 类型');
          if (typeIdx >= 0) {
            const afterType = entityPages[filename].indexOf('\n', typeIdx) + 1;
            entityPages[filename] =
              entityPages[filename].slice(0, afterType) +
              `\n## 简介\n${info.summary}\n` +
              entityPages[filename].slice(afterType);
            enrichedEntities++;
          }
        }
      }
    } catch (e) {
      log(`⚠️  处理实体失败 [${filename}]: ${e.message}`);
      result.warnings.push({ file: filename, error: e.message });
    }
  }

  // Write all enriched entities
  try {
    if (!fs.existsSync(ENTITIES_DIR)) {
      fs.mkdirSync(ENTITIES_DIR, { recursive: true });
    }
    for (const [name, content] of Object.entries(entityPages)) {
      try {
        fs.writeFileSync(path.join(ENTITIES_DIR, name), content, 'utf-8');
      } catch (e) {
        log(`⚠️  写入实体失败 [${name}]: ${e.message}`);
        result.warnings.push({ file: name, action: 'write', error: e.message });
      }
    }
  } catch (e) {
    log(`❌ 写入实体目录失败: ${e.message}`);
    result.errors.push({ step: 'writeEntities', error: e.message });
  }

  result.enriched_entities = enrichedEntities;
  result.total_entities = Object.keys(entityPages).length;
  log(`   ✅ 新增/更新实体: ${enrichedEntities}, 总计: ${Object.keys(entityPages).length}`);
} catch (e) {
  log(`❌ 实体丰富过程异常: ${e.message}`);
  result.errors.push({ step: 'enrichEntities', error: e.message });
}

// Now enrich concept pages with definitions
log('🔧 开始丰富概念页面...');
const CONCEPT_DEFINITIONS = {
  'ai编程代理.md': {
    definition: '使用 AI 模型（如 Claude、Codex、GPT）作为编程代理，通过终端交互或自主执行方式完成编码任务的范式。',
    perspectives: [
      'Claude Code 是当前最流行的 AI 编程代理终端工具，支持 Skills 系统、SubAgent 调用、NO_FLICKER 模式等',
      'OpenClaw 可指挥多个 AI 编程代理协作（Claude Code + Codex + Gemini CLI）',
      'Token 成本是核心痛点：50 元 Codex 5.4 可比肩 100 美金 Claude Opus 4.6',
      '9 行 CLAUDE.md 配置可让 token 直降 63%',
      'Claude Code 终端输出太吵会导致 AI 失忆问题'
    ]
  },
  'skill系统设计.md': {
    definition: '为 AI Agent 设计的可复用技能模块系统，让 Agent 通过加载不同 Skill 获得特定能力。',
    perspectives: [
      'Anthropic 开源了 Claude 技能系统（Agent Skills），GitHub 一天飙到 115k 星',
      '宝玉(@dotey)的 baoyu-skills 2 个月获得 10K+ stars，设计哲学强调简洁实用',
      '李继刚老师系列 Skills 涵盖旅游、信息卡、配图等多领域',
      'kepano 为 Obsidian 做了官方 Agent Skills（16k star）',
      '团队内 Skills 管理和维护是规模化使用的挑战'
    ]
  },
  'token优化.md': {
    definition: '降低 AI API 调用成本的各种策略和技术手段，包括配置优化、模型选择、中转站等。',
    perspectives: [
      '9 行 CLAUDE.md 让 token 直降 63%（chenchengpro 分享）',
      'Coding plan token 包复用方案（tuturetom 分享）',
      'Codex Proxy 统一管理多账号实现 Token 自由',
      '无限邮箱 + Codex 轮询 = Token 自由',
      'GitHub Copilot Pro 性价比最高：39美元/月 1500次 premium 请求',
      'Claude Code Monitor 工具可帮助发现 token 消耗过快的原因'
    ]
  },
  '多agent协作.md': {
    definition: '多个 AI Agent 分工协作完成复杂任务的架构模式，包括主控-子代理、并行处理、投票共识等策略。',
    perspectives: [
      'OpenClaw 可指挥 Codex/Gemini CLI/Claude Code 三位大哥协作写代码',
      'Claude Code 调度 Codex 当 SubAgent 是热门模式（多个教程覆盖）',
      '本地多 Agent 协作方案：Claude + Codex + tmux',
      'ClawTeam（港大）是开源 AI Agent 团队协作框架',
      'CrewAI 用于让 AI 组队干活的多人协作框架',
      'DeerFlow（字节）是面向研究/编程/创意的超级 Agent 架构',
      'API 网关 Skill 打通 18 个第三方服务让 Agent 直接操作外部系统'
    ]
  },
  '内容资产工作流.md': {
    definition: '将内容创作视为资产管理的一套方法论，强调内容的长期价值、复用和系统化生产。',
    perspectives: [
      'YangGuangAI 分享的个人内容资产工作流：把内容看做资产的态度',
      'AI + 公众号月入 10w+ 工作流（蛋仔 2026 实操版）',
      '4 步搭建小红书和公众号内容生产线（AI Skills 实操指南）',
      'AK AutoResearch 将内容质量从 30 分拉到 75 分',
      '高书签率内容分享技巧（agintender）'
    ]
  },
  '自动化运营.md': {
    definition: '利用 AI Agent 和工具链实现社交媒体、内容发布的自动化运营流程。',
    perspectives: [
      '用 OpenClaw 全自动运营小红书：20 天涨粉 1000 的实战复盘',
      'RedBox 实现小红书运营全流程 AI 化（找灵感→发帖）',
      'WeWrite 公众号自动化发文 Skill（1100+ star）',
      '两个 OpenClaw + 飞书的自动化运营案例（李岳分享）',
      '飞书 + Claude-to-IM + 知识库的内容生产工作流',
      'follow-builders Skill 每天整理顶级 AI 资讯'
    ]
  },
  'devops自动化.md': {
    definition: '利用 AI Agent 和云服务实现开发运维的自动化，包括部署、监控、域名管理等。',
    perspectives: [
      'Tailscale + SSH 多设备并网：拥有分布式大脑',
      'OpenClaw + Deploy Skill 出门不用背电脑修 bug',
      'Cloudflare Workers 边缘计算免费方案',
      'Cloudflare Dynamic Worker Loader：AI 沙箱新方案',
      'Mac Mini 无显示器方案：macOS 屏幕共享远程操控',
      '买了 Mac Mini 当服务器没显示器一招搞定'
    ]
  },
  '免费云服务.md': {
    definition: '利用 Cloudflare 等平台提供的免费 tier 构建低成本技术基础设施的策略集合。',
    perspectives: [
      'Cloudflare 被社区称为"赛博大善人"，提供 Workers/R2/DNS/Email 等',
      '自建 Cloudflare 临时邮箱 smail 只需一个 Worker 项目',
      '全球 120+ 国家 330+ 城市 DNS 解析结果查询工具',
      '彩虹聚合 DNS 管理系统：一个网站管理多平台域名解析',
      'CF 大善人免费无限流量梯子 EdgeTunnel 方案',
      'Cloudflare R2 + PicList 图床配置方案'
    ]
  },
  'token成本优化.md': {
    definition: '通过技术手段降低 AI API 使用成本的策略集合，包括模型替代、批量注册、中转站等。',
    perspectives: [
      '50 元 Codex 5.4 比肩 100 美金 Claude Opus 4.6（Btc_Crush 对比）',
      'GitHub Copilot 高级中转站 10 块钱买 600 request',
      '全套美系装备防 Claude 封号：美国住宅 IP + VPS + 手机号 + Apple Pay',
      '通过 Cloudflare 注册 Claude 号实测成功',
      '订阅 ChatGPT 切换地区到欧洲用 Paypal 付款',
      '学生优惠汇总：海底捞 6.8 折 / 机票 / 苹果教育优惠全覆盖'
    ]
  },
  '账号自动化管理.md': {
    definition: '利用自动化工具批量管理和轮转 AI 服务账号的策略。',
    perspectives: [
      'Codex Proxy 统一管理多账号实现 Token 自由',
      'AutoTeam ChatGPT Team 账号自动轮转管理工具',
      'Claude 账号批量注册通过 Cloudflare 实测成功',
      '无限邮箱 + Codex 轮询方案',
      '闲鱼 2.99 买工具就能完成 Claude 验证手机号',
      'Telegram 更新：机器人可自主创建和管理其他机器人'
    ]
  },
  'seo优化.md': {
    definition: '利用 AI Agent 提升搜索引擎可见性和内容排名的技术策略。',
    perspectives: [
      'GEO 从零开始：概念、策略、实战一篇全覆盖',
      'Claude Code GEO Skill：AI 搜索引擎可见度审计工具',
      'SEO 数据看板搭建：GSC 数据统一拉取',
      'GEO Flow 姚金刚开源的第一个 SEO/GEO 系统',
      'GEO Skill 高级扩展版开源：独立运行 + CLI'
    ]
  },
  'geo策略.md': {
    definition: 'Generated Engine Optimization（GEO）：针对 AI 搜索引擎（如 ChatGPT Search、Perplexity）优化内容可见性的新兴策略。',
    perspectives: [
      '区别于传统 SEO，GEO 面向 AI 搜索引擎优化内容被引用的概率',
      'GEO Tool/Skill 已成为 OpenClaw 生态热门工具',
      'Aron厚玉对 GEO Skill 进行了开源改造和扩展',
      '出海需求挖掘可用 GEO 策略提升海外市场 AI 可见度'
    ]
  },
  '出海需求挖掘.md': {
    definition: '利用 AI Agent 自动挖掘海外市场需求和商机的策略方法。',
    perspectives: [
      'OpenClaw 集成 XCrawl 3 步搞定投资内容数据采集',
      'last30days-skill 全网风口聚合器：挖穿 10 个核心社区找赚钱线索',
      '5 个 GitHub 信息差套利方式',
      'GoSailGlobal 全球云服务上线：开发者一站式平台',
      '独立开发者出海必备：海外手机号/邮箱/支付/云一站式方案'
    ]
  },
  'ai健康管理.md': {
    definition: '利用 AI 分析可穿戴设备健康数据，提供个性化健康建议的应用方向。',
    perspectives: [
      'Apple Watch + Claude 健康数据 AI 分析方案',
      '用 Claude 搭建本地 AI 健康管理体系（Obsidian 模板开源）',
      '智能设备检测心源性猝死征兆讨论',
      '健身 Skill 公开（tuzi_ai）',
      '前额叶减负/皮质醇安抚友好指南：减少无意义决策'
    ]
  },
  'ai视频生成.md': {
    definition: '利用 AI 自动化视频内容生产的完整管线，从脚本生成到剪辑输出。',
    perspectives: [
      'huobao-drama：开源 AI 短剧自动化平台，2 小时跑完 50 集',
      'AI 短剧产能真的被 AI 干穿了',
      'Skill 让小龙虾全天候生成影视解说视频（拉片→文案→配音→剪辑全自动）',
      'AI 一句话生成电影解说视频开源项目',
      '全自动视频管线开源：IndexTTS2 + Whisper + Remotion',
      'GitHub 4 个开源短视频工具：从写脚本到全网分发',
      'One Take 视频自动剪辑系统'
    ]
  },
  'ai变现模式.md': {
    definition: '利用 AI 工具和服务创造收入的商业模式和方法论。',
    perspectives: [
      'AI 副业赚钱手册 GitHub 1.4k star：几十种 AI 变现方式',
      'GitHub 上最能帮你赚钱的 40 个仓库：一人公司指南合集',
      '普通人 + AI 可做的小生意（黄赟分享）',
      'AI 卖 Plus 日入过万渠道：低成本创业实战',
      '拿钱趟出来的血泪教训（bozhou_ai）',
      '公众号人生感悟赛道起号经验',
      '一人公司 LTD 方法：先验证先卖再完善产品，24 小时卖 12 万美金'
    ]
  },
  '独立开发出海.md': {
    definition: '个人开发者面向全球市场发布产品和服务的策略方法论。',
    perspectives: [
      '一人公司 OPC 方法论 GitHub 14.5k 独立创业框架',
      '独立开发者出海指南 GitHub 2.9k：注册海外公司全流程',
      '独立开发者出海必备：海外手机号/邮箱/支付/云一站式方案',
      '海外手机号方案：5 英镑 30 年，可申请英国银行账户',
      '中国大陆翻墙用户最佳搭档：英国 giffgaff 手机卡/eSIM 方案'
    ]
  },
  '一人公司方法论.md': {
    definition: 'One Person Company (OPC)：一个人利用 AI 工具跑完整公司的创业方法论。',
    perspectives: [
      'OPC 方法论 GitHub 14.5k stars：独立创业完整指南',
      '一人电商运营团队 - GitHub 工作流（Sac 分享）',
      'Gumroad 创始人把《极简创业家》做成 Claude Skills',
      '让 AI 组队干活：OPC + CrewAI 多 Agent 协作'
    ]
  },
  '个人知识管理.md': {
    definition: '利用 AI 工具构建和维护个人知识库的方法论和实践。',
    perspectives: [
      'mem9 实现 OpenClaw 永续记忆方案',
      'GBrain：YC 总裁 Garry Tan 开源的 AI Agent 记忆系统',
      '龙虾导航：一个网站获取 OpenClaw 所有高质量内容',
      'NotebookLM + Claude + Anki 学语言方法',
      'gstack：Garry Tan 的私家 AI 工作流',
      'Obsidian + Filesystem MCP 最猛方案'
    ]
  },
  'ai行业趋势.md': {
    definition: '2026 年 AI 行业发展的主要趋势和动态，基于 700 条 Twitter/X 素材综合分析。',
    perspectives: [
      'Anthropic 开源 Claude Skills 系统，一天飙到 115k GitHub stars',
      'Claude Code 密集更新：NO_FLICKER / Monitor / ultraplan / Auto DREAM Mode',
      '字节 Coze 2.5 发布：被称为"字节版 OpenClaw 平替"',
      '阿里 Accio Work：电商版 OpenClaw',
      '不到一个月 Claude 发了大量产品和功能更新',
      '港大连续开源 ClawTeam（Agent 协作）和 OpenSpace（进化引擎）',
      '开源 AI 工具生态爆发：DeerFlow/MoneyPrinterTurbo/CrewAI 等',
      'Telegram 更新：机器人可自主创建和管理其他机器人'
    ]
  },
  '开源ai工具生态.md': {
    definition: '围绕 AI Agent 平台（尤其是 OpenClaw/Claude Code）形成的开源工具生态系统。',
    perspectives: [
      'OpenClaw 突破 10 万 GitHub Stars 后生态爆发',
      'baoyu-skills（宝玉）2 个月 10K+ stars',
      'WeWrite 公众号自动化发文 1100+ star',
      'MiniMax 官方开源硬核技能包',
      '阿里论文 SkillRouter：8 万 Skills 路由基准测试',
      'kepano 给 Obsidian 做 Agent Skills 16k star',
      'AIwarts 开源：类似 Hogwarts 的 AI 编程魔法学校',
      '50+ 平台抓取工具清单：opencli/xreach/Jina/Playwright 等'
    ]
  },
  '前端开发工具.md': {
    definition: '面向前端开发的 AI 编程工具和 UI 组件库集合。',
    perspectives: [
      '做前端的 AI 编程党必装：10 个官方级 Agent Skills 清单',
      'tldraw SDK：React 无限画布协作白板',
      'MagicUI：主打 Landing Page 动画视觉效果的组件库',
      '三种 Web 框架对比：FastHTML vs Next.js vs SvelteKit',
      'Awesome Design 仓库：全球 55 个大厂设计语言',
      'nexu v0.1.6：OpenClaw 桌面端最生产级别实践',
      'Markmap：将 Markdown 转化为思维导图'
    ]
  }
};

let enrichedConcepts = 0;
try {
  for (const [filename, def of Object.entries(CONCEPT_DEFINITIONS)) {
    try {
      if (!conceptPages[filename]) {
        const lines = [
          `# ${filename.replace('.md', '')}`,
          '',
          `## 定义`,
          def.definition,
          '',
          `## 来源与视角`,
          ''
        ];
        for (const p of def.perspectives) {
          lines.push('- ' + p + ' (INFERRED from batch analysis)');
        }

        lines.push('', `## 关联实体`, '');
        conceptPages[filename] = lines.join('\n');
        enrichedConcepts++;
      } else {
        // Add definition if missing
        if (!conceptPages[filename].includes('## 定义')) {
          const insertAt = conceptPages[filename].indexOf('## 来源与视角');
          if (insertAt >= 0) {
            conceptPages[filename] =
              conceptPages[filename].slice(0, insertAt) +
              `## 定义\n${def.definition}\n\n` +
              conceptPages[filename].slice(insertAt);
            enrichedConcepts++;
          }
        }
      }
    } catch (e) {
      log(`⚠️  处理概念失败 [${filename}]: ${e.message}`);
      result.warnings.push({ file: filename, error: e.message });
    }
  }

  // Write all enriched concepts
  try {
    if (!fs.existsSync(CONCEPTS_DIR)) {
      fs.mkdirSync(CONCEPTS_DIR, { recursive: true });
    }
    for (const [name, content] of Object.entries(conceptPages)) {
      try {
        fs.writeFileSync(path.join(CONCEPTS_DIR, name), content, 'utf-8');
      } catch (e) {
        log(`⚠️  写入概念失败 [${name}]: ${e.message}`);
        result.warnings.push({ file: name, action: 'write', error: e.message });
      }
    }
  } catch (e) {
    log(`❌ 写入概念目录失败: ${e.message}`);
    result.errors.push({ step: 'writeConcepts', error: e.message });
  }

  result.enriched_concepts = enrichedConcepts;
  result.total_concepts = Object.keys(conceptPages).length;
  log(`   ✅ 新增/更新概念: ${enrichedConcepts}, 总计: ${Object.keys(conceptPages).length}`);
} catch (e) {
  log(`❌ 概念丰富过程异常: ${e.message}`);
  result.errors.push({ step: 'enrichConcepts', error: e.message });
}

// ── Final Summary ──────────────────────────────────────
log('');
log('=== ENRICHMENT PASS COMPLETE ===');
log(`状态: ${result.status}`);
log(`实体: ${result.enriched_entities}/${result.total_entities} 新增或更新`);
log(`概念: ${result.enriched_concepts}/${result.total_concepts} 新增或更新`);
if (result.warnings.length > 0) log(`警告: ${result.warnings.length} 条`);
if (result.errors.length > 0) log(`错误: ${result.errors.length} 条`);

// Output structured result as last line (parseable by CLI)
console.log('\n__ENRICH_RESULT__:' + JSON.stringify(result));
