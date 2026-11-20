import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../../skills/smart-review/cli/smart-review.mjs';
import { diffRuns } from '../../skills/smart-review/cli/lib/diff.mjs';
import { computeScore } from '../../skills/smart-review/cli/lib/score.mjs';
import { finding, findingsDoc, read, write } from './helpers.mjs';

const earlier = 'a'.repeat(40);
const later = 'b'.repeat(40);
const moved = finding(1, { key: 'floating-action', title: 'Release action follows a moving tag' });
const retained = { key: moved.key, status: 'still-present', note: 'The same release step still uses the tag.' };

function attempt(commit, documents) {
  const run = {
    repo: { commit, branch: 'main' }, sections: documents.map(doc => doc.section),
    lang: 'en', profile: 'custom', scoringVersion: '4', toolVersion: '2.2.0', startedAt: '2026-11-20',
  };
  const docs = Object.fromEntries(documents.map(doc => [doc.section, { doc: { ...doc, score: computeScore(doc) } }]));
  return { run, docs };
}

function saveAttempt(dir, { run, docs }) {
  write(join(dir, 'run.json'), run);
  for (const [id, { doc }] of Object.entries(docs)) write(join(dir, id + '.findings.json'), doc);
}

function cli(...args) {
  const lines = [];
  assert.equal(main(args, line => lines.push(line)), 0, lines.join('\n'));
  return lines.join('\n');
}

test('catalogue upgrade reports a transferred finding once and distinguishes first inspections', t => {
  const root = mkdtempSync(join(tmpdir(), 'diff-catalog-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const before = join(root, 'before'), after = join(root, 'after');
  saveAttempt(before, attempt(earlier, [findingsDoc('security', earlier, [moved], { rubricVersion: '1.1.0' })]));
  saveAttempt(after, attempt(later, [
    findingsDoc('dependencies', later, [moved, finding(2, { title: 'Unsupported release line' })]),
    findingsDoc('security', later, [], { previous: [retained] }),
    findingsDoc('frontend', later, []),
  ]));

  const output = cli('diff', after, '--prev', before);
  assert.match(output, /dependencies: .*previously unreviewed.*current findings: 2/i);
  assert.match(output, /frontend: .*previously unreviewed.*current findings: 0/i);
  assert.match(output, /security: .*not directly comparable/i);
  assert.match(output, /security → dependencies/);
  assert.doesNotMatch(output, /94 → 100|not-reproduced/);
  const { sections } = read(join(after, 'diff.json'));
  assert.equal(sections.security.comparable, false);
  assert.equal(sections.security.delta, null);
  assert.deepEqual(sections.security.items, []);
  assert.equal(sections.dependencies.previouslyUnreviewed, true);
  assert.equal(sections.dependencies.delta, null);
  const [transfer, observed] = sections.dependencies.items;
  assert.deepEqual(transfer, { key: moved.key, title: moved.title, severity: moved.severity,
    status: 'still-present', fromSection: 'security', toSection: 'dependencies', severityBefore: moved.severity, note: retained.note });
  assert.equal(observed.status, 'observed');
  assert.equal(observed.title, 'Unsupported release line');

  for (const [lang, sectionLabel, countLabel] of [['en', 'Previously unreviewed', 'Current findings'], ['ru', 'Ранее не проверялась', 'Текущие находки']]) {
    cli('report', after, '--lang', lang);
    for (const format of ['md', 'html']) {
      const report = readFileSync(join(after, 'report.' + format), 'utf8');
      for (const expected of [sectionLabel, countLabel + ': 2', countLabel + ': 0', 'security → dependencies', observed.title]) {
        assert.ok(report.includes(expected), format + ': ' + expected);
      }
      assert.doesNotMatch(report, /94 → 100|\(\+6\)/);
    }
  }
});

test('rendering a saved diff preserves comparable history and suppresses obsolete incompatible arithmetic', t => {
  const dir = mkdtempSync(join(tmpdir(), 'diff-history-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  saveAttempt(dir, attempt(later, [findingsDoc('security', later, []), findingsDoc('tests', later, [])]));
  const change = { scoreBefore: 94, scoreAfter: 100, delta: 6,
    items: [{ key: 'regression', title: 'Regression in earlier version', severity: 'medium', status: 'fixed' }] };
  write(join(dir, 'diff.json'), { previousCommit: earlier, commit: later, sections: {
    security: { ...change, comparable: false }, tests: { ...change, comparable: true },
  } });
  cli('report', dir);
  for (const format of ['md', 'html']) {
    const report = readFileSync(join(dir, 'report.' + format), 'utf8');
    assert.equal(report.split('94 → 100').length - 1, 1);
    assert.match(report, /not directly comparable/);
    assert.match(report, /Fixed/);
    assert.doesNotMatch(report, /Previously unreviewed/);
    if (format === 'html') assert.match(report, /94 → 100 \(\+6\)/);
  }
});

test('key collisions and absent transfer acknowledgements keep section-local history', () => {
  const inspect = (id, commit, findings, previous = []) => findingsDoc(id, commit, findings, { previous });
  const baseline = inspect('security', earlier, [moved]);
  const destination = inspect('dependencies', later, [moved]);
  for (const [oldExtra, newExtra, notes] of [
    [[], [], []],
    [[], [], [{ ...retained, status: 'fixed' }]],
    [[inspect('hygiene', earlier, [moved])], [], [retained]],
    [[], [inspect('hygiene', later, [moved])], [retained]],
  ]) {
    const before = attempt(earlier, [baseline, inspect('dependencies', earlier, []), ...oldExtra]);
    const after = attempt(later, [inspect('security', later, [], notes), destination, ...newExtra]);
    const { sections } = diffRuns(after, before);
    assert.equal(sections.dependencies.items[0].status, 'new');
    assert.equal(sections.dependencies.items[0].fromSection, undefined);
    assert.equal(sections.security.items[0].status, notes[0]?.status === 'still-present' ? 'not-reproduced' : notes[0]?.status ?? 'unaccounted');
  }
});

test('an unscored prior inspection is distinct from a missing section', () => {
  const before = attempt(earlier, [findingsDoc('frontend', earlier, [])]);
  const after = attempt(later, [findingsDoc('frontend', later, [finding(1)])]);
  const previousDoc = before.docs.frontend.doc;
  previousDoc.criteria = previousDoc.criteria.map(({ id }) => ({ id, status: 'unknown', note: 'No evidence available.' }));
  previousDoc.score = computeScore(previousDoc);
  const { frontend } = diffRuns(after, before).sections;
  assert.equal(frontend.previouslyUnreviewed, false);
  assert.equal(frontend.comparable, true);
  assert.equal(frontend.delta, null);
  assert.equal(frontend.items[0].status, 'new');
  before.docs.frontend.doc.score.scoringVersion = '3';
  before.docs.frontend.doc.score.value = 100;
  const changed = diffRuns(after, before).sections.frontend;
  assert.equal(changed.comparable, false);
  assert.equal(changed.delta, null);
});
