// Test helpers: a throwaway git repository and a valid findings document.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SKILL = join(ROOT, 'skills', 'smart-review');
export const CLI = join(SKILL, 'cli', 'smart-review.mjs');

const g = (cwd, ...args) =>
  execFileSync('git', ['-C', cwd, '-c', 'user.name=test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' }).trim();

export function commitAll(repo, message) {
  g(repo, 'add', '-A');
  g(repo, 'commit', '-q', '-m', message);
  return g(repo, 'rev-parse', 'HEAD');
}

export function makeRepo(extra = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'smart-review-test-'));
  g(repo, 'init', '-q', '-b', 'main');
  const files = {
    'README.md': '# demo\n\nRun `npm test`.\n',
    'src/app.js': Array.from({ length: 10 }, (_, i) => `export const line${i + 1} = ${i + 1};`).join('\n') + '\n',
    'src/empty.js': '',
    ...extra,
  };
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, p)), { recursive: true });
    writeFileSync(join(repo, p), body);
  }
  const commit = commitAll(repo, 'init');
  return { repo, commit, cleanup: () => rmSync(repo, { recursive: true, force: true }) };
}

export function rubric(id) {
  return JSON.parse(readFileSync(join(SKILL, 'rubrics', `${id}.json`), 'utf8'));
}

export function finding(n, over = {}) {
  return {
    id: `F-00${n}`,
    key: `sample-finding-${n}`,
    title: `Sample finding ${n}`,
    severity: 'medium',
    confidence: 'high',
    what: 'A value is used without a check.',
    impact: 'A caller can pass an unexpected value.',
    fix: 'Validate the value before use.',
    affected: ['demo module'],
    evidence: [{ path: 'src/app.js', line: 3 }],
    verify: ['A test with an invalid value fails before the fix and passes after.'],
    verification: { result: 'confirmed', note: 'Re-read src/app.js at the reviewed commit.' },
    ...over,
  };
}

export function findingsDoc(section, commit, findings = [finding(1)], over = {}) {
  const r = rubric(section);
  return {
    schemaVersion: 1,
    section,
    rubricVersion: r.version,
    commit,
    lang: 'en',
    verdict: 'One confirmed problem.',
    summary: 'The section found one confirmed problem and no critical issues.',
    findings,
    unconfirmed: [],
    criteria: r.criteria.map((c, i) => (i === 0 ? { id: c.id, status: 'na', note: 'No such surface in this repository.' } : { id: c.id, status: 'scored', score: 4, note: 'Reviewed.' })),
    strengths: ['Small, readable modules.'],
    checked: [{ area: 'Source', note: 'Read src/app.js in full.' }],
    limits: [{ text: 'Nothing was executed.', effect: 'Runtime behavior is not confirmed.' }],
    tools: [{ name: 'gitleaks', status: 'absent' }],
    ...over,
  };
}

export function write(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
}

export function read(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
