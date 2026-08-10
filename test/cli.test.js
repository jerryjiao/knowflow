import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'bin', 'knowflow.js');

function run(args, cwd = ROOT) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

function withTempProject(callback) {
  const temp = mkdtempSync(join(tmpdir(), 'knowflow-test-'));
  try { callback(temp); } finally { rmSync(temp, { recursive: true, force: true }); }
}

test('reports the package version', () => {
  const result = run(['--version']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '0.2.1');
});

test('init creates a usable project without overwriting templates', () => withTempProject(temp => {
  const project = join(temp, 'my wiki');
  let result = run(['init', project]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(readFileSync(join(project, '.knowflowrc'), 'utf8')).wiki, {
    root: './wiki',
    rawDir: './raw',
  });
  assert.ok(readFileSync(join(project, 'wiki', 'index.md'), 'utf8').length >= 100);
  assert.ok(existsSync(join(project, 'templates', 'entity.md')));
  const health = run(['health'], project);
  assert.equal(health.status, 0, health.stderr);
  assert.match(health.stdout, /All checks passed/);

  writeFileSync(join(project, 'templates', 'entity.md'), 'custom', 'utf8');
  result = run(['init', project]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(project, 'templates', 'entity.md'), 'utf8'), 'custom');
}));

test('status discovers config from a nested directory and respects custom paths', () => withTempProject(temp => {
  const project = join(temp, 'project');
  assert.equal(run(['init', project]).status, 0);
  writeFileSync(join(project, '.knowflowrc'), JSON.stringify({
    wiki: { root: './knowledge', rawDir: './inbox' },
    graph: { output: './output/map.html' },
    health: { minFileSize: 50 },
  }), 'utf8');
  const nested = join(project, 'knowledge', 'concepts');
  mkdirSync(nested, { recursive: true });
  const result = run(['status'], nested);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /knowledge/);
}));

test('ingest treats shell metacharacters as text, not commands', () => withTempProject(temp => {
  const project = join(temp, 'project');
  assert.equal(run(['init', project]).status, 0);
  const marker = join(project, 'injected');
  const result = run(['ingest', `hello; touch ${marker}`], project);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(marker), false);
  assert.match(result.stdout, /采集完成/);
}));

test('graph smoke test writes configured HTML and JSON', () => withTempProject(temp => {
  const project = join(temp, 'project');
  assert.equal(run(['init', project]).status, 0);
  const result = run(['graph', '--no-open'], project);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(join(project, 'graph', 'graph.html')));
  assert.ok(existsSync(join(project, 'graph', 'graph.json')));
}));

test('fix creates missing entity pages and pads tiny files', () => withTempProject(temp => {
  const project = join(temp, 'project');
  assert.equal(run(['init', project]).status, 0);
  // A source page that links to a not-yet-existing entity, plus a stub file under min size.
  writeFileSync(join(project, 'wiki', 'sources', 'seed.md'),
    '# Seed\n\nSee [[entities/missing-thing]] for context.\n', 'utf8');
  const stub = join(project, 'wiki', 'entities', 'stub.md');
  mkdirSync(join(project, 'wiki', 'entities'), { recursive: true });
  writeFileSync(stub, 'x', 'utf8');
  const sizeBefore = readFileSync(stub, 'utf8').length;

  const result = run(['fix'], project);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /修复完成/);
  // Fix 2 creates the missing entity page.
  assert.ok(existsSync(join(project, 'wiki', 'entities', 'missing-thing.md')));
  // Fix 3 pads the tiny file with a note; it must grow (the appended marker is
  // what matters, not exceeding any specific threshold).
  const sizeAfter = readFileSync(stub, 'utf8').length;
  assert.ok(sizeAfter > sizeBefore, `expected padded size > ${sizeBefore}, got ${sizeAfter}`);
}));

test('fix --dry-run reports without modifying files', () => withTempProject(temp => {
  const project = join(temp, 'project');
  assert.equal(run(['init', project]).status, 0);
  writeFileSync(join(project, 'wiki', 'sources', 'seed.md'),
    '# Seed\n\nSee [[entities/missing-thing]] for context.\n', 'utf8');
  const stub = join(project, 'wiki', 'entities', 'stub.md');
  mkdirSync(join(project, 'wiki', 'entities'), { recursive: true });
  writeFileSync(stub, 'x', 'utf8');

  const result = run(['fix', '--dry-run'], project);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /DRY RUN/);
  assert.match(result.stdout, /Auto-Fix Summary/);
  // Dry run leaves the wiki untouched.
  assert.equal(existsSync(join(project, 'wiki', 'entities', 'missing-thing.md')), false);
  assert.equal(readFileSync(stub, 'utf8'), 'x');
}));
