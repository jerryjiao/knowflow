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
  assert.equal(result.stdout.trim(), '0.3.0');
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

test('tags builds hub pages that resolve tag links and de-orphan sources', () => withTempProject(temp => {
  const project = join(temp, 'project');
  assert.equal(run(['init', project]).status, 0);
  writeFileSync(join(project, 'wiki', 'sources', 'note-a.md'),
    '# Note A\n\nTagged [[tag/AI]] and [[tag/效率]].\n\nSome padding so the file clears the 100-byte empty-file threshold.\n', 'utf8');
  writeFileSync(join(project, 'wiki', 'sources', 'note-b.md'),
    '# Note B\n\nTagged [[tag/AI|alias]].\n\nSome padding so the file clears the 100-byte empty-file threshold.\n', 'utf8');

  const before = run(['health'], project);
  assert.match(before.stdout, /tag\/AI/);

  const result = run(['tags'], project);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /2 hub page/);
  const hub = readFileSync(join(project, 'wiki', 'tag', 'AI.md'), 'utf8');
  assert.match(hub, /\[\[sources\/note-a\]\]/);
  assert.match(hub, /\[\[sources\/note-b\]\]/);
  assert.ok(existsSync(join(project, 'wiki', 'tag', '效率.md')));

  const after = run(['health'], project);
  assert.equal(after.status, 0, after.stderr);
  assert.match(after.stdout, /All checks passed/);

  // Stale hubs disappear once the tag is no longer used anywhere.
  writeFileSync(join(project, 'wiki', 'sources', 'note-b.md'),
    '# Note B\n\nNo tags anymore.\n\nSome padding so the file clears the 100-byte empty-file threshold.\n', 'utf8');
  writeFileSync(join(project, 'wiki', 'sources', 'note-a.md'),
    '# Note A\n\nOnly [[tag/效率]] now.\n\nSome padding so the file clears the 100-byte empty-file threshold.\n', 'utf8');
  assert.equal(run(['tags'], project).status, 0);
  assert.equal(existsSync(join(project, 'wiki', 'tag', 'AI.md')), false);
  assert.ok(existsSync(join(project, 'wiki', 'tag', '效率.md')));
}));

test('health excludeOrphanDirs skips configured feed directories', () => withTempProject(temp => {
  const project = join(temp, 'project');
  assert.equal(run(['init', project]).status, 0);
  writeFileSync(join(project, '.knowflowrc'), JSON.stringify({
    wiki: { root: './wiki', rawDir: './raw' },
    health: { excludeOrphanDirs: ['sources/'] },
  }), 'utf8');
  writeFileSync(join(project, 'wiki', 'sources', 'feed-item.md'),
    '# Feed item\n\nUnreferenced on purpose; a daily-sync page that nobody links back to. Adding more words here so the file clears the 100-byte empty-file threshold in the health check.\n', 'utf8');
  writeFileSync(join(project, 'wiki', 'concepts', 'lonely.md'),
    '# Lonely\n\nUnreferenced concept; this one should still be reported as an orphan. Padding to clear the 100-byte empty-file threshold as well.\n', 'utf8');

  const result = run(['health'], project);
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /sources\/feed-item\.md/);
  assert.match(result.stdout, /concepts\/lonely\.md/);
}));

test('health counts every wikilink on index-style single-line lists', () => withTempProject(temp => {
  const project = join(temp, 'project');
  assert.equal(run(['init', project]).status, 0);
  writeFileSync(join(project, 'wiki', 'index.md'), [
    '# Index',
    '',
    '[[concepts/first]] · [[concepts/second]] · [[concepts/third]]',
    '',
    'Padding line so this index page clears the 100-byte empty-file threshold.',
  ].join('\n'), 'utf8');
  for (const name of ['first', 'second', 'third']) {
    writeFileSync(join(project, 'wiki', 'concepts', `${name}.md`),
      `# ${name}\n\nReferenced from the one-line index above; padded generously so the file clears the 100-byte empty-file threshold.\n`, 'utf8');
  }

  const result = run(['health'], project);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /All checks passed/);
}));
