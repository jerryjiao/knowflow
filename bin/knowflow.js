#!/usr/bin/env node
/**
 * KnowFlow CLI — AI 知识流系统命令行入口
 *
 * 子命令：
 *   init          初始化 .knowflowrc 配置文件
 *   ingest <url>  消化 URL/文本，写入 wiki
 *   query <text>  向量检索知识库
 *   graph         构建并打开知识图谱
 *   health        Wiki 健康检查
 *   status        显示 wiki 统计信息
 */

import { program } from 'commander';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
// open package removed — using `open` command instead

// ── Paths ──────────────────────────────────────────────
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const SCRIPTS = join(ROOT, 'scripts');
const WIKI_DIR = join(ROOT, 'wiki');
const GRAPH_DIR = join(ROOT, 'graph');
const GRAPH_HTML = join(GRAPH_DIR, 'graph.html');

// ── Helpers ────────────────────────────────────────────
function run(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      stdio: opts.silent ? 'pipe' : 'inherit',
      cwd: opts.cwd || ROOT,
      timeout: opts.timeout || 120_000,
      ...opts,
    });
  } catch (err) {
    if (opts.ignoreError) return err.stdout?.toString() || '';
    throw err;
  }
}

function countFiles(dir, ext = '.md') {
  if (!existsSync(dir)) return 0;
  let count = 0;
  function walk(d) {
    for (const f of readdirSync(d)) {
      const fp = join(d, f);
      const s = statSync(fp);
      if (s.isDirectory()) walk(fp);
      else if (f.endsWith(ext)) count++;
    }
  }
  walk(dir);
  return count;
}

function countLines(dir) {
  if (!existsSync(dir)) return 0;
  let lines = 0;
  function walk(d) {
    for (const f of readdirSync(d)) {
      const fp = join(d, f);
      const s = statSync(fp);
      if (s.isDirectory()) walk(fp);
      else if (f.endsWith('.md')) {
        try { lines += readFileSync(fp, 'utf-8').split('\n').length; } catch {}
      }
    }
  }
  walk(dir);
  return lines;
}

// ── Welcome (no command) ───────────────────────────────
const banner = `
${chalk.cyan.bold('  KnowFlow')} ${chalk.dim('v0.1.0')}
${chalk.green('  AI 知识流系统 — 将 URL 变成结构化 Wiki + 知识图谱')}
`;

program
  .name('knowflow')
  .description('AI 知识流系统 — 将 URL 变成结构化 Wiki + 知识图谱')
  .version('0.1.0')
  .addHelpText('beforeAll', banner)
  .addHelpCommand();

// ── init ───────────────────────────────────────────────
program
  .command('init')
  .description('初始化 .knowflowrc 配置文件模板')
  .action(() => {
    const rcPath = join(ROOT, '.knowflowrc');
    if (existsSync(rcPath)) {
      console.log(chalk.yellow('⚠️  .knowflowrc 已存在，跳过初始化'));
      return;
    }
    const template = `# KnowFlow 配置文件
# 生成于: ${new Date().toISOString()}

[wiki]
root = ./wiki
raw_dir = ./raw

[ingest]
auto_detect = true
default_source = auto

[vector]
store_path = ./scripts/vector-store.mjs

[graph]
output = ./graph/graph.html
wiki_dir = ./wiki

[health]
min_file_size = 100
`;
    writeFileSync(rcPath, template, 'utf-8');
    console.log(chalk.green('✅ 已创建 .knowflowrc 配置文件'));
  });

// ── ingest ─────────────────────────────────────────────
program
  .command('ingest <url>')
  .description('消化 URL 或文本，自动识别来源并提取全文')
  .option('-s, --source <type>', '指定来源类型', 'auto')
  .action((url, opts) => {
    console.log(chalk.blue('🔗 开始消化素材...'));
    console.log(chalk.dim(`   URL: ${url}`));
    console.log();
    try {
      run(`bash ${SCRIPTS}/ingest.sh "${url}" ${opts.source}`);
      console.log();
      console.log(chalk.green('✅ 消化完成！'));
    } catch (e) {
      console.error(chalk.red('❌ 消化失败:'), e.message);
      process.exit(1);
    }
  });

// ── query ──────────────────────────────────────────────
program
  .command('query <text>')
  .description('混合检索知识库（向量搜索 + 关键词匹配）')
  .option('-n, --top <n>', '返回结果数量', '5')
  .action((text, opts) => {
    // 检查 API key
    const envPath = join(ROOT, '.env');
    let hasKey = !!process.env.ZHIPUAI_API_KEY;
    if (!hasKey && existsSync(envPath)) {
      try {
        const envContent = readFileSync(envPath, 'utf8');
        hasKey = envContent.includes('ZHIPUAI_API_KEY=') && !envContent.includes('ZHIPUAI_API_KEY=$');
      } catch {}
    }

    if (!hasKey) {
      console.log();
      console.log(chalk.yellow('⚠️  未检测到 ZHIPUAI_API_KEY'));
      console.log(chalk.dim('   请先配置 API Key 后再使用查询功能：'));
      console.log();
      console.log(chalk.cyan('   1. 运行 knowflow init 初始化配置文件'));
      console.log(chalk.cyan('   2. 编辑 .env 文件，添加：'));
      console.log(chalk.dim('      ZHIPUAI_API_KEY=your-key-here'));
      console.log();
      console.log(chalk.dim('   获取 API Key: https://open.bigmodel.cn/'));
      console.log();
      process.exit(1);
    }

    console.log(chalk.magenta('🔍 正在检索知识库...'));
    console.log(chalk.dim(`   查询: "${text}" | Top ${opts.top}`));
    console.log();
    try {
      const vsPath = join(SCRIPTS, 'vector-store.mjs');
      if (!existsSync(vsPath)) {
        console.error(chalk.red('❌ 找不到 vector-store.mjs'));
        process.exit(1);
      }
      run(`node ${vsPath} query "${text}"`);
    } catch (e) {
      console.error(chalk.red('❌ 检索失败:'), e.message);
      process.exit(1);
    }
  });

// ── graph ──────────────────────────────────────────────
program
  .command('graph')
  .description('构建知识图谱并在浏览器中打开')
  .option('--no-open', '构建但不打开浏览器')
  .action((opts) => {
    console.log(chalk.cyan('🕸️  构建知识图谱...'));
    try {
      const pyPath = join(SCRIPTS, 'graph_builder.py');
      run(`python3 "${pyPath}" --wiki-dir "${WIKI_ROOT}" --output "${GRAPH_HTML}"`, { silent: true });
      console.log(chalk.green(`✅ 图谱已生成: ${GRAPH_HTML}`));

      if (opts.open !== false) {
        console.log(chalk.dim('🌐 打开浏览器...'));
        exec(`open "${GRAPH_HTML}"`, { stdio: 'ignore', silent: true });
        console.log(chalk.green('✅ 已在浏览器中打开'));
      }
    } catch (e) {
      console.error(chalk.red('❌ 图谱构建失败:'), e.message);
      process.exit(1);
    }
  });

// ── health ─────────────────────────────────────────────
program
  .command('health')
  .description('Wiki 健康检查（断链、空文件、孤立页面）')
  .action(() => {
    console.log(chalk.yellow('🏥 Wiki 健康检查...'));
    console.log();
    try {
      run(`bash ${SCRIPTS}/wiki-health.sh`);
    } catch (e) {
      // wiki-health.sh exits non-zero when issues found — still show output
      console.log();
      console.log(chalk.yellow('⚠️  发现一些问题，建议修复'));
    }
  });

// ── status ─────────────────────────────────────────────
program
  .command('status')
  .description('显示 Wiki 统计信息（含向量索引状态）')
  .action(() => {
    const articleCount = countFiles(WIKI_DIR);
    const lineCount = countLines(WIKI_DIR);
    const rawCount = countFiles(join(ROOT, 'raw'));

    // Try to get graph stats from graph.html or json
    let nodes = '-', edges = '-';
    const graphJson = join(GRAPH_DIR, 'knowledge-graph.json');
    if (existsSync(graphJson)) {
      try {
        const g = JSON.parse(readFileSync(graphJson, 'utf-8'));
        nodes = g.nodes?.length ?? g.node_count ?? '-';
        edges = g.edges?.length ?? g.edge_count ?? '-';
      } catch {}
    }

    // 向量索引状态
    let vecStatus = chalk.red('❌ 未构建');
    let vecPages = '-', vecEmbedded = '-', vecBuiltAt = '-';
    const vecIndexFile = join(WIKI_DIR, '.vector-index.json');
    if (existsSync(vecIndexFile)) {
      try {
        const raw = JSON.parse(readFileSync(vecIndexFile, 'utf-8'));
        const index = Array.isArray(raw) ? raw : raw.pages || [];
        vecPages = String(index.length);
        vecEmbedded = String(index.filter(x => x.embedding).length);
        vecBuiltAt = raw.builtAt ? new Date(raw.builtAt).toLocaleString() : statSync(vecIndexFile).mtime.toLocaleString();
        const coverage = index.length > 0 ? ((index.filter(x => x.embedding).length / index.length * 100).toFixed(0)) : '0';
        vecStatus = chalk.green(`✅ ${vecPages} 页 (${coverage}% 向量化)`);
      } catch { vecStatus = chalk.yellow('⚠️ 索引损坏'); }
    }

    // API Key 状态
    const hasApiKey = !!process.env.ZHIPUAI_API_KEY || (() => {
      try { return readFileSync(join(ROOT, '.env'), 'utf-8').includes('ZHIPUAI_API_KEY'); } catch { return false; }
    })();

    console.log();
    console.log(chalk.bold.cyan('  📊 KnowFlow 状态概览'));
    console.log(chalk.dim('  ' + '─'.repeat(40)));
    console.log(`  ${chalk.white('Wiki 文章数:')}  ${chalk.green.bold(String(articleCount))} 篇`);
    console.log(`  ${chalk.white('总行数:')}       ${chalk.gray(String(lineCount))} 行`);
    console.log(`  ${chalk.white('原始素材:')}     ${chalk.yellow(String(rawCount))} 个`);
    console.log(`  ${chalk.white('向量索引:')}     ${vecStatus}`);
    if (vecPages !== '-') {
      console.log(`  ${chalk.white('  已向量化:')}    ${vecEmbedded}/${vecPages} 页`);
      console.log(`  ${chalk.white('  构建时间:')}    ${chalk.dim(vecBuiltAt)}`);
    }
    console.log(`  ${chalk.white('图谱节点:')}     ${chalk.cyan(String(nodes))} 个`);
    console.log(`  ${chalk.white('图谱关系:')}     ${chalk.magenta(String(edges))} 条`);
    console.log(`  ${chalk.white('API Key:')}      ${hasApiKey ? chalk.green('✅ 已配置') : chalk.red('❌ 未配置')}`);
    console.log(chalk.dim('  ' + '─'.repeat(40)));
    console.log(`  ${chalk.dim(`Wiki 目录: ${WIKI_DIR}`)}`);
    console.log(`  ${chalk.dim(`图谱文件: ${GRAPH_HTML}`)}`);
    console.log();
  });

// ── Run ───────────────────────────────────────────────
program.configureHelp({
  sortSubcommands: true,
  helpWidth: 40,
});

// No arguments → show welcome + command list
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log(banner);
  console.log(chalk.dim('\n  可用命令:\n'));
  console.log(`  ${chalk.cyan('init')}         初始化 .knowflowrc 配置文件`);
  console.log(`  ${chalk.cyan('ingest')}       消化 URL/文本，写入 wiki`);
  console.log(`  ${chalk.cyan('query')}        混合检索知识库（向量+关键词）`);
  console.log(`  ${chalk.cyan('graph')}        构建并打开知识图谱`);
  console.log(`  ${chalk.cyan('health')}       Wiki 健康检查`);
  console.log(`  ${chalk.cyan('status')}       显示 wiki 统计信息`);
  console.log(chalk.dim('\n  示例:'));
  console.log(chalk.dim('    knowflow init'));
  console.log(chalk.dim('    knowflow ingest https://example.com'));
  console.log(chalk.dim('    knowflow query "AI Agent"'));
  console.log(chalk.dim('    knowflow graph\n'));
} else {
  program.parse(process.argv);
}
