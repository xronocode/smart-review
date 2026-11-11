import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { main } from '../../skills/smart-audit/cli/smart-audit.mjs';
import { diffRuns } from '../../skills/smart-audit/cli/lib/diff.mjs';
import { finding, findingsDoc, makeRepo, write, read, CLI } from './helpers.mjs';

const quiet = () => {};

function finishedRun(lang) {
  const r = makeRepo();
  const lines = [];
  main(['start', '--repo', r.repo, '--profile', 'quick', '--lang', lang], (l) => lines.push(l));
  const run = JSON.parse(lines.join('\n'));
  write(join(run.runDir, 'security.findings.json'), findingsDoc('security', r.commit, [finding(1, { severity: 'high', title: 'Unchecked <script> & "quotes"' }), finding(2, { severity: 'low' })], { lang }));
  write(join(run.runDir, 'tests.findings.json'), findingsDoc('tests', r.commit, [], { lang }));
  write(join(run.runDir, 'dependencies.findings.json'), findingsDoc('dependencies', r.commit, [finding(1)], { lang }));
  return { ...r, run };
}

test('finish writes summary, Markdown, and one self-contained HTML file', () => {
  const fx = finishedRun('en');
  try {
    assert.equal(main(['finish', fx.run.runDir, '--repo', fx.repo], quiet), 0);
    const summary = read(join(fx.run.runDir, 'summary.json'));
    assert.deepEqual(Object.fromEntries(Object.entries(summary.audits).map(([k, v]) => [k, v.score])), { security: 69, tests: 100, dependencies: 94 });
    assert.deepEqual(Object.keys(summary.audits), ['security', 'tests', 'dependencies'], 'audits keep the order of the run');
    assert.equal(summary.overall, 88);
    assert.equal(summary.band, 'good');
    const html = readFileSync(join(fx.run.runDir, 'report.html'), 'utf8');
    assert.ok(html.startsWith('<!doctype html>'));
    assert.ok(!/<script|<link|<img|src=|url\(|@import|https?:\/\//i.test(html), 'no scripts or external resources');
    assert.ok(html.includes('prefers-color-scheme:dark'));
    assert.ok(html.includes('Unchecked &lt;script&gt; &amp; &quot;quotes&quot;'), 'content is escaped');
    assert.ok(html.includes('69/100') && html.includes('Cap applied'));
    assert.ok(html.includes('src/app.js:3'));
    const md = readFileSync(join(fx.run.runDir, 'report.md'), 'utf8');
    assert.ok(md.includes('**Overall score: 88/100**'));
    assert.ok(md.includes('High: 1 × 15 = −15 → 85'));
    assert.ok(md.includes('Secrets and credentials'));
  } finally {
    fx.cleanup();
  }
});

test('report language follows the run and keeps paths untranslated', () => {
  const fx = finishedRun('ru');
  try {
    assert.equal(main(['finish', fx.run.runDir, '--repo', fx.repo], quiet), 0);
    const md = readFileSync(join(fx.run.runDir, 'report.md'), 'utf8');
    assert.ok(md.includes('Общий балл: 88/100'));
    assert.ok(md.includes('Секреты и учётные данные'));
    assert.ok(md.includes('`src/app.js:3`'));
    assert.ok(readFileSync(join(fx.run.runDir, 'report.html'), 'utf8').includes('<html lang="ru">'));
  } finally {
    fx.cleanup();
  }
});

test('finish stops before reporting when lint fails', () => {
  const fx = finishedRun('en');
  try {
    const file = join(fx.run.runDir, 'tests.findings.json');
    const doc = read(file);
    doc.limits = [];
    write(file, doc);
    assert.equal(main(['finish', fx.run.runDir, '--repo', fx.repo], quiet), 1);
    assert.throws(() => readFileSync(join(fx.run.runDir, 'report.html')));
  } finally {
    fx.cleanup();
  }
});

test('diff separates new findings from ones the previous run missed', () => {
  const mk = (findings, score) => ({ run: { repo: { commit: 'a'.repeat(40) } }, docs: { security: { doc: { rubricVersion: '1.0.0', findings, previous: [{ key: 'gone', status: 'not-reproduced', note: 'n' }], score: { value: score, scoringVersion: '1' } } } } });
  const prev = mk([finding(1), finding(2, { key: 'gone' }), finding(3, { key: 'silent' })], 82);
  const cur = mk([finding(1, { severity: 'low' }), finding(4, { key: 'brand-new' }), finding(5, { key: 'old-miss', origin: 'missed-earlier' })], 80);
  const d = diffRuns(cur, prev).audits.security;
  assert.deepEqual(d.items.map((i) => [i.key, i.status]), [['sample-finding-1', 'still-present'], ['gone', 'not-reproduced'], ['silent', 'unaccounted'], ['brand-new', 'new'], ['old-miss', 'missed-earlier']]);
  assert.equal(d.items[0].severityBefore, 'medium');
  assert.equal(d.delta, -2);
  assert.equal(d.comparable, true);
});

test('the CLI runs as a standalone executable', () => {
  const out = execFileSync(process.execPath, [CLI, 'rubrics', '--json'], { encoding: 'utf8' });
  const data = JSON.parse(out);
  assert.deepEqual(data.profiles.full, ['security', 'tests', 'dependencies', 'ai-readiness', 'hygiene']);
  assert.deepEqual(data.weights, { critical: 40, high: 15, medium: 6, low: 2, info: 0 });
  assert.equal(main(['nonsense', 'x'], quiet), 2);
});

test('the report names the repository after its remote, or an explicit name', () => {
  const r = makeRepo();
  try {
    const start = (...extra) => { const l = []; main(['start', '--repo', r.repo, '--audits', 'tests', '--out', join(r.repo, 'o'), ...extra], (x) => l.push(x)); return JSON.parse(l.join('\n')).repo.name; };
    assert.match(start(), /^smart-audit-test-/);
    execFileSync('git', ['-C', r.repo, 'remote', 'add', 'upstream', 'git@example.invalid:team/widget.git']);
    assert.equal(start(), 'widget');
    assert.equal(start('--name', 'custom'), 'custom');
  } finally {
    r.cleanup();
  }
});

test('starting again on the same commit keeps the earlier findings as the prior pass', () => {
  const fx = finishedRun('en');
  try {
    assert.equal(main(['finish', fx.run.runDir, '--repo', fx.repo], quiet), 0);
    write(join(fx.run.runDir, 'drafts', 'security.draft.json'), {});
    const lines = [];
    main(['start', '--repo', fx.repo, '--profile', 'quick'], (l) => lines.push(l));
    const again = JSON.parse(lines.join('\n'));
    assert.equal(again.runDir, fx.run.runDir);
    assert.deepEqual(again.priorPass.sort(), ['dependencies', 'security', 'tests']);
    assert.equal(read(join(again.runDir, 'prior', 'security.findings.json')).score.value, 69);
    for (const gone of ['security.findings.json', 'report.html', 'summary.json', 'drafts']) assert.equal(existsSync(join(again.runDir, gone)), false, gone);
    assert.equal(again.previous, null, 'the same commit is never its own previous run');
  } finally {
    fx.cleanup();
  }
});
