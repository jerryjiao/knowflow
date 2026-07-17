#!/usr/bin/env node
/** KnowFlow CLI */

import { program } from 'commander';
import chalk from 'chalk';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = join(PACKAGE_ROOT, 'scripts');
const VERSION = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')).version;
const RC_NAME = '.knowflowrc';
const DEFAULT_CONFIG = {
  wiki: { root: './wiki', rawDir: './raw' },
  graph: { output: './graph/graph.html' },
  health: { minFileSize: 100 },
};

function findProjectRoot(start = process.cwd()) {
  let current = resolve(start);
  const filesystemRoot = parse(current).root;
  while (true) {
    if (existsSync(join(current, RC_NAME))) return current;
    if (current === filesystemRoot) return resolve(start);
    current = dirname(current);
  }
}

function loadProject(start = process.cwd()) {
  const root = findProjectRoot(start);
  const rcPath = join(root, RC_NAME);
  let userConfig = {};
  if (existsSync(rcPath)) {
    try {
      userConfig = JSON.parse(readFileSync(rcPath, 'utf8'));
    } catch (error) {
      throw new Error(`无法解析 ${rcPath}: ${error.message}`);
    }
  }

  const config = {
    wiki: { ...DEFAULT_CONFIG.wiki, ...userConfig.wiki },
    graph: { ...DEFAULT_CONFIG.graph, ...userConfig.graph },
    health: { ...DEFAULT_CONFIG.health, ...userConfig.health },
  };
  const pathValue = (value, label) => {
    if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} 必须是非空路径`);
    return resolve(root, value);
  };

  return {
    root,
    config,
    wikiDir: pathValue(config.wiki.root, 'wiki.root'),
    rawDir: pathValue(config.wiki.rawDir, 'wiki.rawDir'),
    graphHtml: pathValue(config.graph.output, 'graph.output'),
  };
}

function projectEnv(project) {
  return {
    ...process.env,
    KNOWFLOW_ROOT: project.root,
    KNOWFLOW_WIKI_DIR: project.wikiDir,
    KNOWFLOW_RAW_DIR: project.rawDir,
    KNOWFLOW_GRAPH_OUTPUT: project.graphHtml,
  };
}

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    cwd: opts.cwd,
    env: opts.env,
    encoding: 'utf8',
    stdio: opts.silent ? 'pipe' : 'inherit',
    timeout: opts.timeout ?? 120_000,
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = opts.silent ? (result.stderr || result.stdout || '').trim() : '';
    const error = new Error(detail || `${command} 退出，状态码 ${result.status}`);
    error.status = result.status;
    throw error;
  }
  return result.stdout || '';
}

function countFiles(dir, ext = '.md') {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) count += countFiles(path, ext);
    else if (entry.name.endsWith(ext)) count++;
  }
  return count;
}

function countLines(dir) {
  if (!existsSync(dir)) return 0;
  let lines = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) lines += countLines(path);
    else if (entry.name.endsWith('.md')) {
      try { lines += readFileSync(path, 'utf8').split('\n').length; } catch {}
    }
  }
  return lines;
}

function hasApiKey(project) {
  if (process.env.ZHIPUAI_API_KEY) return true;
  try {
    return readFileSync(join(project.root, '.env'), 'utf8')
      .split(/\r?\n/)
      .some(line => /^\s*ZHIPUAI_API_KEY\s*=\s*[^$\s]/.test(line));
  } catch {
    return false;
  }
}

function initialise(directory) {
  const root = resolve(directory);
  mkdirSync(root, { recursive: true });
  const rcPath = join(root, RC_NAME);
  if (!existsSync(rcPath)) {
    writeFileSync(rcPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, 'utf8');
    console.log(chalk.green(`✅ 已创建 ${rcPath}`));
  } else {
    console.log(chalk.yellow(`⚠️  ${rcPath} 已存在，保留原配置`));
  }

  const project = loadProject(root);
  for (const dir of [
    project.wikiDir,
    ...['sources', 'entities', 'concepts', 'comparisons'].map(name => join(project.wikiDir, name)),
    project.rawDir,
    ...['web', 'twitter', 'xiaohongshu', 'wechat'].map(name => join(project.rawDir, name)),
    dirname(project.graphHtml),
  ]) mkdirSync(dir, { recursive: true });

  const templatesDir = join(root, 'templates');
  mkdirSync(templatesDir, { recursive: true });
  for (const name of readdirSync(join(PACKAGE_ROOT, 'templates'))) {
    const source = join(PACKAGE_ROOT, 'templates', name);
    const destination = join(templatesDir, name);
    if (!existsSync(destination)) cpSync(source, destination);
  }

  const indexPath = join(project.wikiDir, 'index.md');
  if (!existsSync(indexPath)) {
    writeFileSync(indexPath, [
      '# KnowFlow Wiki',
      '',
      '欢迎使用 KnowFlow。这里是知识库的首页与导航入口。',
      '',
      '## 开始使用',
      '',
      '- 将来源页放在 `sources/`',
      '- 将实体页放在 `entities/`',
      '- 将概念页放在 `concepts/`',
      '- 使用双中括号 Wiki 链接建立页面之间的联系',
      '',
    ].join('\n'), 'utf8');
  }
  console.log(chalk.green(`✅ KnowFlow 项目已初始化: ${root}`));
}

const banner = `\n${chalk.cyan.bold('  KnowFlow')} ${chalk.dim(`v${VERSION}`)}\n${chalk.green('  AI 知识流系统 — 将 URL 变成结构化 Wiki + 知识图谱')}\n`;

program
  .name('knowflow')
  .description('AI 知识流系统 — 将 URL 变成结构化 Wiki + 知识图谱')
  .version(VERSION)
  .addHelpText('beforeAll', banner)
  .addHelpCommand();

program
  .command('init [directory]')
  .description('在指定目录初始化 KnowFlow 项目（默认当前目录）')
  .action((directory = '.') => initialise(directory));

program
  .command('ingest <url-or-text>')
  .description('采集 URL 或文本，自动识别来源并保存到 raw 目录')
  .option('-s, --source <type>', '指定来源类型', 'auto')
  .action((input, opts) => {
    const project = loadProject();
    console.log(chalk.blue('🔗 开始采集素材...'));
    try {
      run('bash', [join(SCRIPTS, 'ingest.sh'), input, opts.source], {
        cwd: project.root,
        env: projectEnv(project),
      });
      console.log(chalk.green('✅ 采集完成！'));
    } catch (error) {
      console.error(chalk.red('❌ 采集失败:'), error.message);
      process.exitCode = 1;
    }
  });

program
  .command('query <text>')
  .description('混合检索知识库（向量搜索 + 关键词匹配）')
  .option('-n, --top <n>', '返回结果数量', value => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) throw new Error('--top 必须是 1-100 的整数');
    return parsed;
  }, 5)
  .action((text, opts) => {
    const project = loadProject();
    if (!hasApiKey(project)) {
      console.error(chalk.yellow('⚠️  未检测到 ZHIPUAI_API_KEY，请在项目 .env 或环境变量中配置。'));
      process.exitCode = 1;
      return;
    }
    try {
      run(process.execPath, [join(SCRIPTS, 'vector-store.mjs'), 'query', text, '--top', String(opts.top)], {
        cwd: project.root,
        env: projectEnv(project),
      });
    } catch (error) {
      console.error(chalk.red('❌ 检索失败:'), error.message);
      process.exitCode = 1;
    }
  });

program
  .command('graph')
  .description('构建知识图谱并在浏览器中打开')
  .option('--no-open', '构建但不打开浏览器')
  .action(opts => {
    const project = loadProject();
    mkdirSync(dirname(project.graphHtml), { recursive: true });
    console.log(chalk.cyan('🕸️  构建知识图谱...'));
    try {
      run('python3', [join(SCRIPTS, 'graph_builder.py'), '--wiki-dir', project.wikiDir, '--output', project.graphHtml], {
        cwd: project.root,
        env: projectEnv(project),
        silent: true,
      });
      console.log(chalk.green(`✅ 图谱已生成: ${project.graphHtml}`));
      if (opts.open !== false) {
        const opener = process.platform === 'darwin' ? ['open', [project.graphHtml]]
          : process.platform === 'win32' ? ['explorer.exe', [project.graphHtml]]
            : ['xdg-open', [project.graphHtml]];
        run(opener[0], opener[1], { cwd: project.root, env: projectEnv(project), silent: true });
      }
    } catch (error) {
      console.error(chalk.red('❌ 图谱构建失败:'), error.message);
      process.exitCode = 1;
    }
  });

program
  .command('health')
  .description('Wiki 健康检查（断链、空文件、孤立页面）')
  .action(() => {
    const project = loadProject();
    console.log(chalk.yellow('🏥 Wiki 健康检查...'));
    try {
      run('bash', [join(SCRIPTS, 'wiki-health.sh'), '--wiki-dir', project.wikiDir, '--min-size', String(project.config.health.minFileSize)], {
        cwd: project.root,
        env: projectEnv(project),
      });
    } catch {
      console.log(chalk.yellow('⚠️  发现一些问题，建议修复'));
    }
  });

program
  .command('status')
  .description('显示 Wiki 统计信息（含向量索引状态）')
  .action(() => {
    const project = loadProject();
    const articleCount = countFiles(project.wikiDir);
    const lineCount = countLines(project.wikiDir);
    const rawCount = countFiles(project.rawDir);
    let nodes = '-', edges = '-';
    const graphJson = project.graphHtml.replace(/\.html$/i, '.json');
    if (existsSync(graphJson)) {
      try {
        const graph = JSON.parse(readFileSync(graphJson, 'utf8'));
        nodes = graph.nodes?.length ?? '-';
        edges = graph.edges?.length ?? '-';
      } catch {}
    }
    let vectorStatus = chalk.red('❌ 未构建');
    const vectorFile = join(project.wikiDir, '.vector-index.json');
    if (existsSync(vectorFile)) {
      try {
        const raw = JSON.parse(readFileSync(vectorFile, 'utf8'));
        const pages = Array.isArray(raw) ? raw : raw.pages || [];
        const embedded = pages.filter(item => item.embedding).length;
        vectorStatus = chalk.green(`✅ ${pages.length} 页，${embedded} 页已向量化`);
      } catch { vectorStatus = chalk.yellow('⚠️ 索引损坏'); }
    }
    console.log(`\n${chalk.bold.cyan('  📊 KnowFlow 状态概览')}`);
    console.log(`  Wiki 文章数:  ${articleCount} 篇`);
    console.log(`  总行数:       ${lineCount} 行`);
    console.log(`  原始素材:     ${rawCount} 个`);
    console.log(`  向量索引:     ${vectorStatus}`);
    console.log(`  图谱:         ${nodes} 个节点 / ${edges} 条关系`);
    console.log(`  API Key:      ${hasApiKey(project) ? '✅ 已配置' : '❌ 未配置'}`);
    console.log(chalk.dim(`  项目目录: ${project.root}`));
    console.log(chalk.dim(`  Wiki 目录: ${project.wikiDir}\n`));
  });

program.configureHelp({ sortSubcommands: true, helpWidth: 60 });

if (process.argv.length === 2) program.outputHelp();
else program.parse(process.argv);
