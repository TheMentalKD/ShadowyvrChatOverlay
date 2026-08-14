#!/usr/bin/env node
/**
 * Fails if any module required by src/ is not declared in package.json.
 *
 * Undeclared modules usually still work locally because some other package
 * happens to pull them in, but that is silent breakage waiting to happen:
 * the day that package drops the dependency, the app breaks at runtime with
 * no build-time warning.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SRC = join(ROOT, 'src');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
  'electron', // provided by the Electron runtime itself
]);
const builtin = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}

// Bare specifiers only: skip './x', '../x', '/x'.
const REQUIRE_RE = /\brequire\(\s*['"]([^'".\/][^'"]*)['"]\s*\)/g;

const problems = [];
for (const file of walk(SRC)) {
  const source = readFileSync(file, 'utf8');
  for (const [, specifier] of source.matchAll(REQUIRE_RE)) {
    // 'ws' from '@scope/pkg/sub' -> '@scope/pkg'; 'pkg/sub' -> 'pkg'
    const name = specifier.startsWith('@')
      ? specifier.split('/').slice(0, 2).join('/')
      : specifier.split('/')[0];
    if (builtin.has(name) || declared.has(name)) continue;
    problems.push(`${file.slice(ROOT.length)}: require('${specifier}') is not a declared dependency`);
  }
}

if (problems.length) {
  console.error('Undeclared dependencies found:\n');
  for (const p of [...new Set(problems)]) console.error(`  ${p}`);
  console.error('\nAdd them to "dependencies" in package.json.');
  process.exit(1);
}

console.log('All required modules are declared in package.json.');
