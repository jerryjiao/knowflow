#!/usr/bin/env node
/**
 * Jerry Wiki Vector Store v2.1
 * 智谱 embedding-3 向量检索引擎
 *
 * 用法:
 *   node vector-store.mjs build              全量构建索引
 *   node vector-store.mjs build --incremental 增量构建（只处理新增/修改）
 *   node vector-store.mjs build --stats      构建后显示统计
 *   node vector-store.mjs query "关键词"      语义搜索 Top10（混合排序）
 *   node vector-store.mjs query "关键词" --stats 查询后显示统计
 *   node vector-store.mjs search "query"      语义搜索 Top5（精简版）
 *   node vector-store.mjs ask "你的问题"      LLM 问答（基于检索上下文）
 *   node vector-store.mjs stats             统计
 *   node vector-store.mjs stats --verbose   详细统计（含 per-type 明细行）
 *   node vector-store.mjs stats --json      JSON 格式输出统计
 *   node vector-store.mjs build --stats --json  构建后 JSON 统计
 *   node vector-store.mjs query "关键词" --stats --json  查询后 JSON 统计
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import { fileURLToPath } from 'url';

const WIKI_DIR = join(fileURLToPath(import.meta.url), '../../wiki');
const INDEX_FILE = join(WIKI_DIR, '.vector-index.json');
const CACHE_FILE = join(WIKI_DIR, '.embed-cache.json');
const MANIFEST_FILE = join(WIKI_DIR, '.vector-manifest.json'); // 增量用：记录文件 mtime
const API_URL = 'https://open.bigmodel.cn/api/paas/v4/embeddings';
const MODEL = 'embedding-3';
const CHAT_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const CHAT_MODEL = 'glm-4-flash';
const DIMS = 1024;
const BATCH_SIZE = 20;
const MIN_SIZE = 300; // 最小文件大小阈值
const QUERY_CACHE_TTL = 60_000; // 查询缓存 TTL: 60 秒
const QUERY_CACHE_MAX = 100; // 最大缓存条目数

// ─── 查询缓存（模块级） ───
const queryCache = new Map();
function getQueryCacheKey(text) { return text.trim().toLowerCase(); }

// ─── 类型权重（混合排序） ───
const TYPE_WEIGHTS = {
  concepts: 1.15,  // 概念页略高
  entities: 1.10,  // 实体页略高
  topics: 1.00,    // 专题页基准
  sources: 0.90,   // 来源页略低
};

// 加载 .env
const envPath = join(fileURLToPath(import.meta.url), '../../.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const [k, ...v] = line.split('=');
    if (k?.trim() && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
  }
}
const API_KEY = process.env.ZHIPUAI_API_KEY || '';

if (!API_KEY) {
  console.error('❌ Error: ZHIPUAI_API_KEY environment variable is required');
  console.error('   export ZHIPUAI_API_KEY="your-key-here"');
  // Don't exit for stats/help commands, only block LLM calls
  const isLlmCommand = process.argv[2] === 'ask' || process.argv[2] === 'query';
  if (isLlmCommand) process.exit(1);
}

// ─── 工具函数 ───

function log(msg) { console.log(`[${new Date().toLocaleTimeString()}] ${msg}`); }

function getAllMdFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...getAllMdFiles(full));
    else if (extname(entry.name) === '.md') files.push(full);
  }
  return files;
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

function getTypeWeight(path) {
  const type = path.split('/')[0];
  return TYPE_WEIGHTS[type] || 1.0;
}

function extractTitle(content) {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : '(untitled)';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function formatDuration(ms) {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  const h = Math.floor(ms / 3600000);
  const m = Math.round((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// ─── Embedding API ───

async function getEmbedding(texts) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({ model: MODEL, input: texts, dimensions: DIMS })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.data.sort((a, b) => a.index - b.index).map(item => item.embedding);
}

// ─── Manifest（增量更新用） ───

function loadManifest() {
  if (existsSync(MANIFEST_FILE)) return JSON.parse(readFileSync(MANIFEST_FILE, 'utf8'));
  return {};
}

function saveManifest(manifest) {
  writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8');
}

// ─── Build 索引 ───

async function buildIndex(incremental = false) {
  if (!API_KEY) throw new Error('需要 ZHIPUAI_API_KEY 环境变量');

  log('📂 扫描 wiki 目录...');
  const files = getAllMdFiles(WIKI_DIR);
  log(`找到 ${files.length} 个 md 文件${incremental ? ' (增量模式)' : ''}`);

  // 加载缓存和 manifest
  let cache = {};
  if (existsSync(CACHE_FILE)) cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
  const manifest = incremental ? loadManifest() : {};
  if (incremental) log(`Manifest: 已记录 ${Object.keys(manifest).length} 个文件`);

  const index = [];
  let cached = 0, newReq = 0, skipped = 0, failed = 0, unchanged = 0;
  const toEmbed = [];

  for (const filePath of files) {
    const relPath = relative(WIKI_DIR, filePath);
    const content = readFileSync(filePath, 'utf8').trim();

    // 跳过小文件
    if (content.length < MIN_SIZE) { skipped++; continue; }

    const fingerprint = relPath + '::' + content.slice(0, 500);
    const mtime = statSync(filePath).mtimeMs;

    // 增量模式：检查文件是否变化
    if (incremental && manifest[relPath] === mtime && cache[fingerprint]) {
      index.push({ path: relPath, title: extractTitle(content), size: content.length, embedding: cache[fingerprint] });
      cached++;
      unchanged++;
      continue;
    }

    if (cache[fingerprint]) {
      index.push({ path: relPath, title: extractTitle(content), size: content.length, embedding: cache[fingerprint] });
      cached++;
    } else {
      toEmbed.push({ path: relPath, title: extractTitle(content), text: content.slice(0, 1500), fingerprint, mtime });
    }
  }

  log(`统计: 缓存命中=${cached}, 新增/变更=${toEmbed.length}, 跳过小文件=${skipped}${incremental ? ', 未变化=' + unchanged : ''}`);

  // 分批请求 embedding
  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE);
    const texts = batch.map(b => `${b.title}\n${b.text}`);
    process.stdout.write(`\r🔄 Embedding ${Math.min(i + BATCH_SIZE, toEmbed.length)}/${toEmbed.length}...`);

    try {
      const embeddings = await getEmbedding(texts);
      for (let j = 0; j < batch.length; j++) {
        const b = batch[j];
        index.push({ path: b.path, title: b.title, size: b.text.length, embedding: embeddings[j] });
        cache[b.fingerprint] = embeddings[j];
        newReq++;
        // 更新 manifest
        if (b.mtime) manifest[b.path] = b.mtime;
      }
    } catch (err) {
      console.log(`\n⚠️ 批次 ${i} 失败: ${err.message}，将在下次重试`);
      failed += batch.length;
    }

    if (i + BATCH_SIZE < toEmbed.length) await sleep(300);
  }

  console.log();

  // 保存
  const indexData = {
    builtAt: new Date().toISOString(),
    pages: index,
  };
  writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2), 'utf8');
  writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8');
  if (incremental) saveManifest(manifest);

  const hasEmbed = index.filter(x => x.embedding).length;
  log(`✅ 完成! ${index.length} 页 (${hasEmbed} 有向量, ${skipped} 跳过, ${failed} 重试中)`);
  log(`缓存: ${Object.keys(cache).length} 条 | ${incremental ? 'Manifest: ' + Object.keys(manifest).length + ' 文件' : ''}`);
}

// ─── 关键词匹配（BM25 简化版） ───
function keywordMatch(queryTerms, content, title) {
  const text = `${title} ${content}`.toLowerCase();
  let score = 0;
  for (const term of queryTerms) {
    if (!term) continue;
    // 标题命中权重更高
    const inTitle = title.toLowerCase().includes(term) ? 2 : 0;
    // 内容中出现的次数
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = text.match(regex);
    const count = matches ? matches.length : 0;
    score += inTitle + Math.min(count, 5) * 0.5; // 单个词最多贡献 2.5 分
  }
  return score / queryTerms.length; // 归一化
}

// ─── Query 查询（混合检索：向量 + 关键词） ───

async function queryIndex(queryText, topK = 10) {
  if (!API_KEY) throw new Error('需要 ZHIPUAI_API_KEY 环境变量，请先运行 knowflow init 配置');
  if (!existsSync(INDEX_FILE)) { log('❌ 向量索引不存在，请先运行 knowflow ingest 添加内容后自动构建索引'); return []; }

  const raw = JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
  const index = Array.isArray(raw) ? raw : raw.pages || [];
  const validIndex = index.filter(x => x.embedding);

  if (validIndex.length === 0) {
    log('⚠️ 索引中没有可用的向量数据，可能需要重新构建索引 (knowflow ingest + pipeline)');
    return [];
  }

  log(`🔍 查询: "${queryText}" (${validIndex.length}/${index.length} 有向量)`);

  // ── 检查查询缓存 ──
  const cacheKey = getQueryCacheKey(queryText);
  const cached = queryCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < QUERY_CACHE_TTL) {
    log('♻️ 使用查询缓存');
    return cached.results.slice(0, topK);
  }

  // ── 向量搜索 ──
  const [queryEmb] = await getEmbedding([queryText]);

  const vectorResults = validIndex.map(item => ({
    ...item,
    vectorScore: cosineSimilarity(queryEmb, item.embedding),
    typeWeight: getTypeWeight(item.path),
  })).map(item => ({
    ...item,
    vectorFinal: item.vectorScore * item.typeWeight,
  }));

  // ── 关键词匹配 ──
  const queryTerms = queryText.toLowerCase().split(/\s+/).filter(t => t.length > 1);
  const keywordResults = vectorResults.map(item => {
    // 读取文件内容用于关键词匹配（使用缓存的标题+前缀）
    const filePath = join(WIKI_DIR, item.path);
    let content = '';
    try { content = readFileSync(filePath, 'utf8').slice(0, 2000); } catch {}
    return {
      ...item,
      kwScore: keywordMatch(queryTerms, content, item.title || ''),
    };
  });

  // ── 混合评分: 向量 70% + 关键词 30%（归一化后） ──
  const maxVector = Math.max(...keywordResults.map(r => r.vectorFinal), 0.01);
  const maxKW = Math.max(...keywordResults.map(r => r.kwScore), 0.01);

  const results = keywordResults
    .map(item => ({
      ...item,
      score: (item.vectorFinal / maxVector) * 0.7 + (item.kwScore / maxKW) * 0.3,
    }))
    .filter(item => item.vectorScore > 0.05 || item.kwScore > 0) // 至少一个维度有信号
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // ── 写入缓存 ──
  if (queryCache.size >= QUERY_CACHE_MAX) {
    // 删除最旧的条目
    const oldest = queryCache.keys().next().value;
    queryCache.delete(oldest);
  }
  queryCache.set(cacheKey, { ts: Date.now(), results: [...results] });

  log(`\n📋 Top ${results.length} 结果 (混合检索: 向量70% + 关键词30%):\n`);
  for (const r of results) {
    const type = r.path.split('/')[0];
    const wikiUrl = `wiki/${r.path}`;
    console.log(`  📄 [${(r.score * 100).toFixed(1)}%] ${r.title}`);
    console.log(`     📍 ${r.path} (${type})`);
    console.log(`     🔗 → ${wikiUrl}`);
    console.log(`     📊 向量:${(r.vectorScore * 100).toFixed(1)}% | 关键词:${r.kwScore.toFixed(2)} | 权重:${r.typeWeight}x`);
    console.log();
  }

  return results;
}

// ─── Stats ───

function showStats(verbose = false, json = false) {
  if (!existsSync(INDEX_FILE)) { if (json) { console.log(JSON.stringify({ error: '索引不存在' }, null, 2)); return null; } log('索引不存在'); return; }
  const raw = JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
  const index = Array.isArray(raw) ? raw : raw.pages || [];
  const hasEmbed = index.filter(x => x.embedding).length;

  // Index freshness
  const lastBuilt = statSync(INDEX_FILE).mtime;
  const builtAtISO = raw.builtAt;
  const freshnessMs = builtAtISO ? Date.now() - new Date(builtAtISO).getTime() : null;

  // ── Summary metrics ──
  const total = index.length;
  const embedCoverage = total > 0 ? parseFloat((hasEmbed / total * 100).toFixed(1)) : 0;

  // Cache hit ratio
  let cacheEntries = 0;
  if (existsSync(CACHE_FILE)) {
    cacheEntries = Object.keys(JSON.parse(readFileSync(CACHE_FILE, 'utf8'))).length;
  }
  const cacheHitRatio = total > 0 ? parseFloat((cacheEntries / total * 100).toFixed(1)) : 0;

  // Estimated total API tokens (title + first 1500 chars of content per entry)
  const estimatedApiTokens = index.reduce((sum, item) => {
    const apiInputLen = (item.title || '').length + 1 + Math.min(item.size || 0, 1500);
    return sum + estimateTokens('x'.repeat(apiInputLen));
  }, 0);

  // Per-type breakdown
  const typeStats = {};
  for (const item of index) {
    const type = item.path.split('/')[0];
    if (!typeStats[type]) typeStats[type] = { count: 0, embedded: 0, tokens: 0, size: 0 };
    typeStats[type].count++;
    if (item.embedding) typeStats[type].embedded++;
    typeStats[type].tokens += estimateTokens((item.title || '') + 'x'.repeat(Math.min(item.size || 0, 1500)));
    typeStats[type].size += item.size || 0;
  }

  // ── JSON mode: return structured object ──
  if (json) {
    let manifestEntries = 0;
    if (existsSync(MANIFEST_FILE)) {
      manifestEntries = Object.keys(JSON.parse(readFileSync(MANIFEST_FILE, 'utf8'))).length;
    }
    const typeBreakdown = {};
    for (const [type, s] of Object.entries(typeStats)) {
      typeBreakdown[type] = {
        pages: s.count,
        embedded: s.embedded,
        coverage: s.count > 0 ? parseFloat((s.embedded / s.count * 100).toFixed(1)) : 0,
        tokens: s.tokens,
        size: s.size,
      };
    }
    const result = {
      builtAt: builtAtISO || null,
      freshnessMs,
      pages: total,
      embedded: hasEmbed,
      embedCoverage,
      cacheEntries,
      cacheHitRatio,
      estimatedApiTokens,
      manifestEntries,
      typeBreakdown,
    };
    if (verbose) {
      result.files = index.map(item => ({
        path: item.path,
        title: item.title || '(untitled)',
        size: item.size || 0,
        tokens: Math.ceil((item.size || 0) / 4),
        hasEmbedding: !!item.embedding,
      }));
    }
    return result;
  }

  // ── Human-readable mode (original behavior) ──
  log(`📊 向量索引统计    Last Built: ${lastBuilt.toLocaleString()}`);

  log('');
  log(`  Pages:        ${total}`);
  log(`  Embedding:    ${hasEmbed}/${total} (${embedCoverage}% coverage)`);
  log(`  Cache:        ${cacheEntries} entries (${cacheHitRatio}% hit ratio)`);
  log(`  API Tokens:   ~${estimatedApiTokens.toLocaleString()} (estimated total)`);
  log(`  Freshness:    ${freshnessMs !== null ? formatDuration(freshnessMs) + ' ago' : 'unknown'}`);
  log(`  类型权重:     concepts×1.15 | entities×1.10 | topics×1.0 | sources×0.90`);
  if (existsSync(MANIFEST_FILE)) {
    log(`  Manifest:     ${Object.keys(JSON.parse(readFileSync(MANIFEST_FILE, 'utf8'))).length} 文件`);
  }

  // ── Per-type breakdown table (always shown) ──
  log('');
  log('── Per-Type Breakdown ──');

  const typeHeader = { type: 'Type', pages: 'Pages', embedded: 'Embedded', coverage: 'Coverage', tokens: 'Tokens' };
  const typeColWidths = {};
  for (const key of Object.keys(typeHeader)) {
    const maxData = Object.keys(typeStats).reduce((m, t) => {
      const s = typeStats[t];
      const vals = { type: t, pages: String(s.count), embedded: String(s.embedded), coverage: (s.count > 0 ? (s.embedded / s.count * 100).toFixed(1) + '%' : '0.0%'), tokens: s.tokens.toLocaleString() };
      return Math.max(m, String(vals[key]).length);
    }, 0);
    typeColWidths[key] = Math.max(typeHeader[key].length, maxData);
  }

  const pad = (s, w, align = 'left') => {
    s = String(s);
    return align === 'right' ? s.padStart(w) : s.padEnd(w);
  };

  const typeSep = Object.keys(typeHeader).map(k => '─'.repeat(typeColWidths[k] + 2)).join('┼');
  const typeHeaderLine = Object.entries(typeHeader).map(([k, v]) => ` ${pad(v, typeColWidths[k])} `).join('│');

  log(typeHeaderLine);
  log(typeSep);

  const sortedTypes = Object.keys(typeStats).sort((a, b) => {
    const order = ['concepts', 'entities', 'topics', 'sources'];
    return order.indexOf(a) - order.indexOf(b);
  });

  let grandPages = 0, grandEmbedded = 0, grandTokens = 0;
  for (const type of sortedTypes) {
    const s = typeStats[type];
    grandPages += s.count;
    grandEmbedded += s.embedded;
    grandTokens += s.tokens;
    const coverage = s.count > 0 ? (s.embedded / s.count * 100).toFixed(1) + '%' : '0.0%';
    log([
      ` ${pad(type, typeColWidths.type)} `,
      ` ${pad(s.count, typeColWidths.pages, 'right')} `,
      ` ${pad(s.embedded, typeColWidths.embedded, 'right')} `,
      ` ${pad(coverage, typeColWidths.coverage, 'right')} `,
      ` ${pad(s.tokens.toLocaleString(), typeColWidths.tokens, 'right')} `,
    ].join('│'));
  }

  log(typeSep);
  const grandCoverage = grandPages > 0 ? (grandEmbedded / grandPages * 100).toFixed(1) + '%' : '0.0%';
  log([
    ` ${pad(`TOTAL`, typeColWidths.type)} `,
    ` ${pad(grandPages, typeColWidths.pages, 'right')} `,
    ` ${pad(grandEmbedded, typeColWidths.embedded, 'right')} `,
    ` ${pad(grandCoverage, typeColWidths.coverage, 'right')} `,
    ` ${pad(grandTokens.toLocaleString(), typeColWidths.tokens, 'right')} `,
  ].join('│'));

  // ── Per-file table (only in verbose mode) ──
  if (verbose) {
    log('');
    log('── Per-File Detail ──');

    const rows = index.map(item => ({
      path: item.path,
      chunks: 1,
      tokens: Math.ceil((item.size || 0) / 4),
      size: item.size || 0,
      hasVec: !!item.embedding,
    }));

    const header = { path: 'Path', chunks: 'Chunks', tokens: 'Tokens', size: 'Size', hasVec: 'Vector' };
    const colWidths = {};
    for (const key of Object.keys(header)) {
      const maxData = rows.reduce((m, r) => Math.max(m, String(r[key]).length), 0);
      colWidths[key] = Math.max(header[key].length, maxData);
    }

    const sep = Object.values(header).map((h, i) => {
      const key = Object.keys(header)[i];
      return '─'.repeat(colWidths[key] + 2);
    }).join('┼');

    const headerLine = Object.entries(header).map(([k, v]) => ` ${pad(v, colWidths[k])} `).join('│');
    log(headerLine);
    log(sep);

    let totalTokens = 0, totalSize = 0;
    for (const r of rows) {
      const tokens = r.tokens;
      totalTokens += tokens;
      totalSize += r.size;
      const line = [
        ` ${pad(r.path, colWidths.path)} `,
        ` ${pad(r.chunks, colWidths.chunks, 'right')} `,
        ` ${pad(tokens.toLocaleString(), colWidths.tokens, 'right')} `,
        ` ${pad(r.size.toLocaleString(), colWidths.size, 'right')} `,
        ` ${pad(r.hasVec ? '✓' : '✗', colWidths.hasVec)} `,
      ].join('│');
      log(line);
    }

    log(sep);
    const summaryLine = [
      ` ${pad(`TOTAL (${rows.length} entries)`, colWidths.path)} `,
      ` ${pad(rows.length, colWidths.chunks, 'right')} `,
      ` ${pad(totalTokens.toLocaleString(), colWidths.tokens, 'right')} `,
      ` ${pad(totalSize.toLocaleString(), colWidths.size, 'right')} `,
      ` ${pad(`${hasEmbed}/${rows.length}`, colWidths.hasVec)} `,
    ].join('│');
    log(summaryLine);
  }

  log('');
  log(`  Store: ${INDEX_FILE}`);
}

// ─── Ask (LLM Q&A) ───

async function askQuestion(queryText) {
  if (!API_KEY) throw new Error('需要 ZHIPUAI_API_KEY 环境变量');
  if (!existsSync(INDEX_FILE)) { log('❌ 索引不存在，先运行 build'); return; }

  // Step 1 & 2: Find top 5 relevant passages using existing queryIndex logic
  const results = await queryIndex(queryText, 5);
  if (!results || results.length === 0) {
    log('未找到相关内容');
    return;
  }

  // Read file content for context passages
  const contexts = [];
  for (const r of results) {
    const filePath = join(WIKI_DIR, r.path);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf8');
      contexts.push({ path: r.path, title: r.title, content: content.slice(0, 2000) });
    }
  }

  if (contexts.length === 0) {
    log('未找到可用的上下文文件');
    return;
  }

  // Step 3: Call ZhipuAI chat completion API with context
  const contextText = contexts.map((c, i) => `[${i + 1}] ${c.title} (${c.path})\n${c.content}`).join('\n\n---\n\n');

  const systemPrompt = `你是一个知识助手。请根据以下提供的上下文内容回答用户的问题。要求：
1. 基于提供的上下文内容回答，不要编造信息
2. 在回答中引用来源，使用 [1], [2] 等标记
3. 如果上下文中没有足够的信息来回答问题，请如实说明
4. 回答要简洁准确

上下文：
${contextText}`;

  log('🤖 生成回答...');

  const res = await fetch(CHAT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: queryText }
      ]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Chat API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const answer = data.choices?.[0]?.message?.content || '(无回答)';

  // Step 4: Output answer + citation list
  console.log('\n' + '─'.repeat(60));
  console.log(answer);
  console.log('\n' + '─'.repeat(60));
  console.log('📎 引用来源:');
  for (let i = 0; i < contexts.length; i++) {
    console.log(`  [${i + 1}] ${contexts[i].path} — ${contexts[i].title}`);
  }
  console.log();
}

// ─── 模块化导出 ───
export function init() { return buildIndex(false); }
export function incrementalBuild() { return buildIndex(true); }
export { queryIndex as search };
export { queryIndex as query };
export function add(filePath) {
  // 单文件添加到索引（未来扩展）
  log(`📎 add: ${filePath} — 即将支持单文件增量索引`);
}
export function getStats(verbose = false, json = false) { return showStats(verbose, json); }
export function getIndexInfo() {
  if (!existsSync(INDEX_FILE)) return null;
  const raw = JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
  const index = Array.isArray(raw) ? raw : raw.pages || [];
  return {
    exists: true,
    builtAt: raw.builtAt || null,
    pageCount: index.length,
    embeddedCount: index.filter(x => x.embedding).length,
    mtime: statSync(INDEX_FILE).mtime.toISOString(),
  };
}

// ─── CLI ───

const cmd = process.argv[2];

const wantStats = process.argv.includes('--stats');
const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
const jsonMode = process.argv.includes('--json');

if (cmd === 'build') {
  const incremental = process.argv.includes('--incremental') || process.argv.includes('-i');
  buildIndex(incremental)
    .then(() => { if (wantStats) { if (jsonMode) { const s = showStats(verbose, true); if (s) console.log(JSON.stringify(s, null, 2)); } else { showStats(verbose, false); } } })
    .catch(e => { console.error(e.message); process.exit(1); });
} else if (cmd === 'query') {
  const args = process.argv.slice(3).filter(a => a !== '--stats' && a !== '--verbose' && a !== '-v' && a !== '--json');
  const q = args.join(' ');
  if (!q) { log('用法: query "查询内容"'); process.exit(1); }
  queryIndex(q)
    .then(() => { if (wantStats) { if (jsonMode) { const s = showStats(verbose, true); if (s) console.log(JSON.stringify(s, null, 2)); } else { showStats(verbose, false); } } })
    .catch(e => { console.error(e.message); process.exit(1); });
} else if (cmd === 'search') {
  const args = process.argv.slice(3).filter(a => a !== '--stats' && a !== '--verbose' && a !== '-v' && a !== '--json');
  const q = args.join(' ');
  if (!q) { log('用法: search "查询内容"'); process.exit(1); }
  queryIndex(q, 5)
    .then(() => { if (wantStats) { if (jsonMode) { const s = showStats(verbose, true); if (s) console.log(JSON.stringify(s, null, 2)); } else { showStats(verbose, false); } } })
    .catch(e => { console.error(e.message); process.exit(1); });
} else if (cmd === 'ask') {
  const args = process.argv.slice(3).filter(a => a !== '--stats' && a !== '--verbose' && a !== '-v' && a !== '--json');
  const q = args.join(' ');
  if (!q) { log('用法: ask "你的问题"'); process.exit(1); }
  askQuestion(q)
    .then(() => { if (wantStats) { if (jsonMode) { const s = showStats(verbose, true); if (s) console.log(JSON.stringify(s, null, 2)); } else { showStats(verbose, false); } } })
    .catch(e => { console.error(e.message); process.exit(1); });
} else if (cmd === 'stats') {
  if (jsonMode) { const s = showStats(verbose, true); if (s) console.log(JSON.stringify(s, null, 2)); }
  else { showStats(verbose, false); }
} else {
  console.log(`
Jerry Wiki Vector Store v2.1
用法:
  node vector-store.mjs build                 全量构建索引
  node vector-store.mjs build --incremental   增量构建（只处理新增/修改文件）
  node vector-store.mjs build --stats         构建后显示统计
  node vector-store.mjs query "关键词"         语义搜索 Top10（混合排序）
  node vector-store.mjs query "关键词" --stats  查询后显示统计
  node vector-store.mjs search "query"         语义搜索 Top5（精简版）
  node vector-store.mjs ask "你的问题"         LLM 问答（基于检索上下文回答+引用来源）
  node vector-store.mjs stats                查看统计
  node vector-store.mjs stats --verbose      详细统计（含 per-file 明细表）
  node vector-store.mjs stats --json         JSON 格式输出统计
  node vector-store.mjs build --stats --json 构建后 JSON 统计
  node vector-store.mjs query "关键词" --stats --json  查询后 JSON 统计

特性:
  ✅ 增量更新 (--incremental): 基于 mtime，跳过未变化的文件
  ✅ 混合排序: 相似度 × 类型权重 (concepts×1.15 > entities×1.10 > topics×1 > sources×0.90)
  ✅ 失败重试: API 失败的页面不缓存，下次自动重试
  ✅ 小文件过滤: 跳过 <${MIN_SIZE}B 的空壳页
  ✅ 统计 (--stats): build/query 后追加显示索引统计（含构建时间）
  ✅ 详细统计 (--verbose): 显示 per-file 明细表 + per-type 分组统计
  ✅ JSON 输出 (--json): 配合 stats 或 --stats 输出结构化 JSON（含 --verbose 时追加 files 数组）
  ✅ builtAt: 索引文件记录 ISO 构建时间戳
`);
}
