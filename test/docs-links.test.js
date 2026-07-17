import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRECTORIES = new Set(['.git', 'node_modules']);

function markdownFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...markdownFiles(path));
    else if (entry.name.endsWith('.md')) files.push(path);
  }
  return files;
}

function documentationFiles() {
  const roots = [
    'README.md',
    'README.zh-CN.md',
    'CONTRIBUTING.md',
    'SECURITY.md',
    'CHANGELOG.md',
    'docs',
    'examples',
  ];
  return roots.flatMap(name => {
    const path = join(ROOT, name);
    return name.endsWith('.md') ? [path] : markdownFiles(path);
  });
}

test('relative links in project documentation resolve in the repository', () => {
  const missing = [];
  for (const markdownFile of documentationFiles()) {
    const content = readFileSync(markdownFile, 'utf8').replace(/```[\s\S]*?```/g, '');
    for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      let target = match[1].trim();
      if (!target || target.startsWith('#') || /^[a-z][a-z\d+.-]*:/i.test(target)) continue;
      if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
      target = target.split('#', 1)[0].split('?', 1)[0];
      try { target = decodeURIComponent(target); } catch {}
      if (!target) continue;
      const resolved = resolve(dirname(markdownFile), target);
      if (!existsSync(resolved)) {
        missing.push(`${markdownFile.slice(ROOT.length + 1)} -> ${match[1]}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});
