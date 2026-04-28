#!/usr/bin/env node
/**
 * Wiki Batch Ingest Engine
 * Processes 700 raw files → clustered → wiki pages
 */
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.join(__dirname, '..', 'raw', 'web');
const WIKI_DIR = path.join(__dirname, '..', 'wiki');
const SOURCES_DIR = path.join(WIKI_DIR, 'sources');
const ENTITIES_DIR = path.join(WIKI_DIR, 'entities');
const CONCEPTS_DIR = path.join(WIKI_DIR, 'concepts');

// Ensure dirs exist
[SOURCES_DIR, ENTITIES_DIR, CONCEPTS_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Top-level error boundary
process.on('uncaughtException', (err) => {
  console.error(`\n❌ batch-ingest fatal error: ${err.message}`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});

// Step 1: Read all files and deduplicate
console.log('=== Step 1: Scanning and deduplicating 700 files ===');
const allFiles = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.md'));
console.log(`Total files: ${allFiles.length}`);

// Group by URL to deduplicate
const urlMap = new Map(); // url -> best file
const emptyFiles = [];
const noUrlFiles = [];

for (const f of allFiles) {
  const fp = path.join(RAW_DIR, f);
  const content = fs.readFileSync(fp, 'utf-8');
  const lines = content.split('\n');
  
  // Extract URL
  let url = '';
  for (const line of lines) {
    const uMatch = line.match(/(?:^source:|^url:)\s*(https?:\/\/\S+)/i);
    if (uMatch) { url = uMatch[1].trim(); break; }
  }
  
  // Extract title
  let title = '';
  for (const line of lines) {
    const tMatch = line.match(/^title:\s*"(.+)"/);
    if (tMatch) { title = tMatch[1]; break; }
  }
  if (!title) {
    // Try first meaningful line after frontmatter
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      if (lines[i].startsWith('# ')) {
        title = lines[i].replace('# ', '').trim();
        break;
      }
    }
  }
  if (!title) title = f.replace('.md', '');
  
  const stat = fs.statSync(fp);
  const key = url || `no-url-${f}`;
  
  // Skip empty/small files (< 100 bytes = likely bookmarks)
  if (stat.size < 150) {
    emptyFiles.push({ f, size: stat.size });
    continue;
  }
  
  const existing = urlMap.get(key);
  if (!existing) {
    urlMap.set(key, { f, url, title, content, size: stat.size });
  } else {
    // Keep the one with better title (Chinese preferred) or larger size
    if (existing.title.match(/[\u4e00-\u9fa5]/) && !title.match(/[\u4e00-\u9fa5]/)) {
      // keep existing (has Chinese title)
    } else if (!existing.title.match(/[\u4e00-\u9fa5]/) && title.match(/[\u4e00-\u9fa5]/)) {
      urlMap.set(key, { f, url, title, content, size: stat.size });
    } else if (stat.size > existing.size) {
      urlMap.set(key, { f, url, title, content, size: stat.size });
    }
  }
}

const uniqueFiles = Array.from(urlMap.values());
console.log(`Unique files (after dedup): ${uniqueFiles.length}`);
console.log(`Empty/small files skipped: ${emptyFiles.length}`);

// Step 2: Cluster by topic using keyword matching
console.log('\n=== Step 2: Clustering by topic ===');

const TOPIC_KEYWORDS = {
  'openclaw-claude-code-skills': {
    name: 'OpenClaw / Claude Code / Skills 生态',
    keywords: ['claude code', 'openclaw', 'skill', 'codex', 'subagent', 'clau', 'agent sdk', 'auto dream', 'no flicker', 'monitor', 'ultraplan', 'oop', 'token消耗', 'CLAUDE.md'],
    entities: ['Claude-Code', 'OpenClaw', 'Codex', 'Anthropic', 'OpenAI'],
    concepts: ['ai编程代理', 'skill系统设计', 'token优化', '多agent协作']
  },
  'content-automation': {
    name: '内容自动化（小红书/公众号）',
    keywords: ['小红书', '公众号', 'wewrite', 'wechat', 'md2wechat', '排版', '发文', 'redbox', 'redclaw', '内容生产', '飞书', 'claude-to-im', 'markcopy', '墨滴', '壹伴'],
    entities: ['WeWrite', 'RedBox', 'RedClaw', '飞书', '微信公众号'],
    concepts: ['内容资产工作流', '自动化运营', '公众号自动化']
  },
  'cloudflare-devops': {
    name: 'Cloudflare / DevOps 工具',
    keywords: ['cloudflare', 'workers', 'r2', 'dns', 'smail', '邮箱', 'tailscale', 'ssh', 'deploy', 'edge tunnel', '梯子', '翻墙', 'giffgaff', '手机号', 'cf_'],
    entities: ['Cloudflare', 'Tailscale', 'Giffgaff'],
    concepts: ['devops自动化', '免费云服务']
  },
  'ai-video-media': {
    name: 'AI 视频 / 短剧 / 多媒体',
    keywords: ['短剧', '视频', 'huobao-drama', 'videolingo', 'one take', '剪辑', 'whisper', 'tts', 'index tts', 'remotion', '电影解说', '影视', '去水印'],
    entities: ['huobao-drama', 'VideoLingo', 'One-Take', 'IndexTTS'],
    concepts: ['ai视频生成', '自动化内容生产']
  },
  'ai-agent-frameworks': {
    name: 'AI Agent 框架与架构',
    keywords: ['agent框架', 'agent架构', 'clawteam', 'deerflow', 'superagent', 'openspace', 'crewai', 'opc', '一人公司', 'page-agent', 'composio', 'multi-agent', '团队协作', '进化引擎'],
    entities: ['ClawTeam', 'DeerFlow', 'OpenSpace', 'CrewAI', 'Composio', 'OpenMAIC', 'Accio-Work'],
    concepts: ['ai-agent架构', '多agent协作', '自动进化引擎']
  },
  'token-cost-accounts': {
    name: 'Token 成本 / 账号管理',
    keywords: ['token', 'codex proxy', '注册', '批量', '账号', '封号', '封禁', '轮询', '中转', '返佣', '订阅', 'copilot', '性价比', 'ultraplan', '免费', '学生优惠', '50元', '100美金'],
    entities: ['Codex-Proxy', 'GitHub-Copilot', 'AutoTeam'],
    concepts: ['token成本优化', '账号自动化管理']
  },
  'seo-geo': {
    name: 'SEO / GEO / 出海工具',
    keywords: ['seo', 'geo', 'gsc', '搜索引擎', '可见度', '出海', 'xcrawl', '抓取', '数据采集', 'last30days', '风口', '赚钱线索', '信息差'],
    entities: ['XCrawl', 'GEO-Tool', 'last30days-skill'],
    concepts: ['seo优化', 'geo策略', '出海需求挖掘']
  },
  'health-wearable': {
    name: '健康 / 可穿戴设备 + AI',
    keywords: ['apple watch', '健康', '心梗', '猝死', 'obsidian模板', '健身', '皮质醇', '前额叶', '营养', '保健品'],
    entities: ['Apple-Watch', 'Obsidian'],
    concepts: ['ai健康管理', '可穿戴数据分析']
  },
  'ai-business-money': {
    name: 'AI 变现 / 商业模式',
    keywords: ['变现', '副业', '赚钱', '小生意', '一人公司', '独立开发', '出海指南', 'opcmethodology', 'opc', '血泪教训', '起号', '月入', '日入', '信息差套利', '发卡'],
    entities: ['OPC-Methodology', 'AI副业手册'],
    concepts: ['ai变现模式', '独立开发出海', '一人公司方法论']
  },
  'web-dev-tools': {
    name: 'Web 开发 / UI 工具',
    keywords: ['react', 'next.js', 'sveltekit', 'fasthtml', 'tldraw', 'magicui', '组件库', '画布', 'sdk', 'vibe design', 'stitchui', 'design', 'landing page', 'ppt', '幻灯片'],
    entities: ['tldraw', 'MagicUI', 'FastHTML', 'nexu'],
    concepts: ['前端开发工具', 'ui组件库']
  },
  'productivity-learning': {
    name: '效率工具 / 学习方法',
    keywords: ['notebooklm', 'anki', '语言学习', '记忆', 'mem9', '龙虾导航', '知识库', '论文', '旅游攻略', 'gstack', 'office-hours', 'gbrain', 'infocard', '信息卡'],
    entities: ['NotebookLM', 'mem9', '龙虾导航', 'gstack', 'GBrain', 'Garry-Tan'],
    concepts: ['个人知识管理', 'ai辅助学习']
  },
  'ai-news-updates': {
    name: 'AI 行业动态 / 产品更新',
    keywords: ['anthropic开源', '发布', '更新', 'v0.1', 'v1.3', '新功能', '推出', '上线', '开源了', '飙到', 'star', 'github', 'coze', '扣子', '字节', '阿里', 'deepseek', 'minimax', '李继刚', '宝玉'],
    entities: ['ByteDance-Coze', 'MiniMax', 'DeepSeek', '李继刚', '宝玉-dotey'],
    concepts: ['ai行业趋势', '开源ai工具生态']
  }
};

function classifyFile(file) {
  const text = `${file.title} ${file.content.slice(0, 500)}`.toLowerCase();
  const scores = {};
  
  for (const [topicId, topic] of Object.entries(TOPIC_KEYWORDS)) {
    let score = 0;
    for (const kw of topic.keywords) {
      if (text.includes(kw.toLowerCase())) {
        score += kw.length; // longer keywords = more specific = higher weight
      }
    }
    if (score > 0) scores[topicId] = score;
  }
  
  // Return best match or 'other'
  if (Object.keys(scores).length === 0) return 'other';
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

const clusters = {};
for (const f of uniqueFiles) {
  const topic = classifyFile(f);
  if (!clusters[topic]) clusters[topic] = [];
  clusters[topic].push(f);
}

console.log('\nTopic distribution:');
for (const [topicId, files] of Object.entries(clusters).sort((a,b) => b[1].length - a[1].length)) {
  const topicName = TOPIC_KEYWORDS[topicId]?.name || topicId;
  console.log(`  [${topicName}] ${files.length} files`);
}

// Step 3: Generate wiki pages per cluster
console.log('\n=== Step 3: Generating Wiki pages ===');

const createdSources = [];
const createdEntities = new Set();
const createdConcepts = new Set();
const entityPages = {}; // entityName -> content fragments
const conceptPages = {}; // conceptName -> content fragments

// Load existing entities/concepts to append
function loadExisting(dir) {
  const existing = {};
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.md')) {
        existing[f] = fs.readFileSync(path.join(dir, f), 'utf-8');
      }
    }
  }
  return existing;
}

const existingEntities = loadExisting(ENTITIES_DIR);
const existingConcepts = loadExisting(CONCEPTS_DIR);

// Copy existing into our page trackers
for (const [name, content] of Object.entries(existingEntities)) {
  entityPages[name] = content;
  createdEntities.add(name);
}
for (const [name, content] of Object.entries(existingConcepts)) {
  conceptPages[name] = content;
  createdConcepts.add(name);
}

const today = '2026-04-26';

for (const [topicId, files] of Object.entries(clusters)) {
  const topicInfo = TOPIC_KEYWORDS[topicId];
  const topicName = topicInfo?.name || topicId;
  
  console.log(`\nProcessing [${topicName}] with ${files.length} files...`);
  
  // === Create Source Page ===
  const sourceTitle = `${today}-batch-${topicId}`;
  const sourceLines = [`# ${topicName}（批量收录）`, '', `## 来源`, '', `原始素材 ${files.length} 篇，来自 Twitter/X 平台。`, '', `## 收录文件列表`, ''];
  
  for (const f of files.slice(0, 30)) { // List up to 30 per source
    sourceLines.push('- **' + f.title + '** (' + (f.url || f.f) + ')');
  }
  if (files.length > 30) {
    sourceLines.push(`- ... 以及其他 ${files.length - 30} 篇`);
  }
  
  sourceLines.push('', `## 关键主题`, '');
  
  // Extract key themes from titles
  const themes = new Set();
  for (const f of files) {
    // Simple theme extraction from title
    const words = f.title.replace(/[^\w\u4e00-\u9fa5\s]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
    words.forEach(w => themes.add(w));
  }
  const themeList = Array.from(themes).slice(0, 15);
  sourceLines.push(...themeList.map(t => `- ${t}`));
  
  sourceLines.push('', `## 涉及实体`, '');
  const topicEntities = (topicInfo?.entities || []).filter(e => e && e.trim());
  for (const e of topicEntities) {
    sourceLines.push `- [[entities/${e}]]`;
    createdEntities.add(`${e}.md`);
  }
  
  sourceLines.push('', `## 涉及概念`, '');
  const topicConcepts = (topicInfo?.concepts || []).filter(c => c && c.trim());
  for (const c of topicConcepts) {
    sourceLines.push `- [[concepts/${c}]]`;
    createdConcepts.add(`${c}.md`);
  }
  
  sourceLines.push('', `_批量 ingest 于 ${today}_`, '');
  
  const sourcePath = path.join(SOURCES_DIR, `${sourceTitle}.md`);
  fs.writeFileSync(sourcePath, sourceLines.join('\n'));
  createdSources.push(sourceTitle);
  
  // === Update Entity Pages ===
  for (const entityName of topicEntities) {
    const entityFile = `${entityName}.md`;
    if (!entityPages[entityFile]) {
      // Create new entity page
      const lines = [
        `# ${entityName.replace(/-/g, ' ')}`,
        '',
        `## 类型`,
        `待分类`,
        '',
        `## 信息`,
        ''
      ];
      
      // Determine type
      if (['Claude-Code','Codex','OpenClaw','GitHub-Copilot','WeWrite','RedBox','RedClaw','XCrawl','GEO-Tool','NotebookLM','mem9','tldraw','MagicUI','FastHTML','nexu','huobao-drama','VideoLingo','One-Take','IndexTTS','GBrain','gstack','Codex-Proxy','AutoTeam','OPC-Methodology','AI副业手册','DeerFlow','ClawTeam','OpenSpace','CrewAI','Composio','OpenMAIC','Accio-Work','ByteDance-Coze','Apple-Watch','Tailscale','Giffgaff','龙虾导航'].includes(entityName)) {
        lines[2] = '产品/项目';
      } else if (['Anthropic','OpenAI','DeepSeek','MiniMax','ByteDance','Cloudflare'].includes(entityName)) {
        lines[2] = '公司/组织';
      } else if (['宝玉-dotey','李继刚','Garry-Tan'].includes(entityName)) {
        lines[2] = '人物';
      } else if (['飞书','微信公众号'].includes(entityName)) {
        lines[2] = '平台';
      }
      
      entityPages[entityFile] = lines.join('\n');
    }
    
    // Append info from this batch
    const relevantFiles = files.filter(f => 
      f.title.toLowerCase().includes(entityName.split('-')[0].toLowerCase()) ||
      f.content.slice(0, 300).toLowerCase().includes(entityName.split('-')[0].toLowerCase())
    ).slice(0, 5);
    
    if (relevantFiles.length > 0) {
      const infoLines = relevantFiles.map(f => 
        '- **' + f.title + '** — 来源: [[sources/' + sourceTitle + ']] (EXTRACTED)'
      );
      entityPages[entityFile] += `\n### ${today} 批量收录\n${infoLines.join('\n')}\n`;
    }
  }
  
  // === Update Concept Pages ===
  for (const conceptName of topicConcepts) {
    const conceptFile = `${conceptName}.md`;
    if (!conceptPages[conceptFile]) {
      const lines = [
        `# ${conceptName}`,
        '',
        `## 定义`,
        `（待补充）`,
        '',
        `## 来源与视角`,
        ''
      ];
      conceptPages[conceptFile] = lines.join('\n');
    }
    
    // Add perspective from this batch
    conceptPages[conceptFile] += `\n### ${topicName}视角 (${today})\n\n基于 ${files.length} 篇素材，核心观点：\n\n- 来自 [[sources/${sourceTitle}]] 的综合分析 (INFERRED)\n`;
    
    // Link entities
    if (!conceptPages[conceptFile].includes('## 关联实体')) {
      conceptPages[conceptFile] += `\n## 关联实体\n`;
    }
    for (const e of topicEntities) {
      if (!conceptPages[conceptFile].includes(`[[entities/${e}]]`)) {
        conceptPages[conceptFile] += `- [[entities/${e}]]\n`;
      }
    }
  }
}

// Write all entity pages
console.log('\n=== Writing Entity pages ===');
for (const [name, content] of Object.entries(entityPages)) {
  fs.writeFileSync(path.join(ENTITIES_DIR, name), content);
}
console.log(`Entity pages written: ${Object.keys(entityPages).length}`);

// Write all concept pages
console.log('\n=== Writing Concept pages ===');
for (const [name, content] of Object.entries(conceptPages)) {
  fs.writeFileSync(path.join(CONCEPTS_DIR, name), content);
}
console.log(`Concept pages written: ${Object.keys(conceptPages).length}`);

// Step 4: Update index.md
console.log('\n=== Step 4: Updating index.md ===');
const indexPath = path.join(WIKI_DIR, 'index.md');
let indexContent = '';
if (fs.existsSync(indexPath)) {
  indexContent = fs.readFileSync(indexPath, 'utf-8');
}

indexContent += `\n## ${today} 批量 Ingest（700 文件处理）\n\n`;
for (const [topicId, files] of Object.entries(clusters).sort((a,b) => b[1].length - a[1].length)) {
  const topicName = TOPIC_KEYWORDS[topicId]?.name || topicId;
  const sourceTitle = `${today}-batch-${topicId}`;
  indexContent += `- **${topicName}** (${files.length}篇) — [[sources/${sourceTitle}]]\n`;
}
indexContent += '\n';

fs.writeFileSync(indexPath, indexContent);

// Step 5: Update log.md
console.log('=== Step 5: Updating log.md ===');
const logPath = path.join(WIKI_DIR, 'log.md');
let logContent = '';
if (fs.existsSync(logPath)) {
  logContent = fs.readFileSync(logPath, 'utf-8');
}

logContent += `## [${today}] Batch Ingest — 700 Raw 文件批量编译\n\n`;
logContent += `- **处理文件**: ${allFiles.length} 个 raw 文件\n`;
logContent += `- **去重后**: ${uniqueFiles.length} 个唯一文件\n`;
logContent += `- **跳过空文件**: ${emptyFiles.length} 个\n`;
logContent += `- **新建 Source 页面**: ${createdSources.length} 个\n`;
logContent += `- **涉及 Entity 页面**: ${Object.keys(entityPages).length} 个\n`;
logContent += `- **涉及 Concept 页面**: ${Object.keys(conceptPages).length} 个\n`;
logContent += `- **主题分布**:\n`;

for (const [topicId, files] of Object.entries(clusters).sort((a,b) => b[1].length - a[1].length)) {
  const topicName = TOPIC_KEYWORDS[topicId]?.name || topicId;
  logContent += `  - ${topicName}: ${files.length}篇\n`;
}
logContent += '\n';

fs.writeFileSync(logPath, logContent);

// Final report
console.log('\n' + '='.repeat(60));
console.log('BATCH INGEST COMPLETE');
console.log('='.repeat(60));
console.log(`Total raw files:       ${allFiles.length}`);
console.log(`After dedup:           ${uniqueFiles.length}`);
console.log(`Empty/skipped:         ${emptyFiles.length}`);
console.log(`Source pages created:  ${createdSources.length}`);
console.log(`Entity pages total:    ${Object.keys(entityPages).length}`);
console.log(`Concept pages total:   ${Object.keys(conceptPages).length}`);
console.log(`Topic clusters:        ${Object.keys(clusters).length}`);
console.log('');

console.log('Top entities:');
const entityCounts = {};
for (const [topicId, topic] of Object.entries(TOPIC_KEYWORDS)) {
  for (const e of (topic.entities || [])) {
    entityCounts[e] = (entityCounts[e] || 0) + (clusters[topicId]?.length || 0);
  }
}
for (const [e, c] of Object.entries(entityCounts).sort((a,b) => b[1]-a[1]).slice(0, 10)) {
  console.log(`  ${e}: mentioned in ~${c} files`);
}

console.log('\nTop concepts:');
const conceptCounts = {};
for (const [topicId, topic] of Object.entries(TOPIC_KEYWORDS)) {
  for (const c of (topic.concepts || [])) {
    conceptCounts[c] = (conceptCounts[c] || 0) + (clusters[topicId]?.length || 0);
  }
}
for (const [c, cnt] of Object.entries(conceptCounts).sort((a,b) => b[1]-a[1]).slice(0, 10)) {
  console.log(`  ${c}: covered by ~${cnt} files`);
}
