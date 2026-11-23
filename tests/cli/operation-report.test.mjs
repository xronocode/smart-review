import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSummary, renderHtml, renderMarkdown } from '../../skills/smart-review/cli/lib/report.mjs';
import { computeScore } from '../../skills/smart-review/cli/lib/score.mjs';
import { findingsDoc } from './helpers.mjs';

const commit = 'a'.repeat(40);
const run = {
  repo: { commit, name: 'demo', branch: 'main' }, startedAt: '2026-11-23T00:00:00Z',
  profile: 'full', lang: 'en', toolVersion: '1', scoringVersion: '4',
};
const securityRows = [
  { topic: 'authn', key: 'sign-in', operation: 'Sign in <admin>', status: 'traced',
    note: 'Checked *both* [paths](relative).', evidence: [{ path: 'src/login.js', line: 2, endLine: 4 }] },
  { topic: 'authn', key: 'sign-out', operation: 'Sign out', status: 'skipped',
    note: 'Adapter missing. Its outcome is unknown.' },
];
const deliveryRows = [
  { topic: 'delivery', key: 'mobile', operation: 'Mobile signing', status: 'inapplicable',
    note: 'Only the desktop build is supported.', evidence: [{ path: 'build/desktop.js', line: 3 }] },
];
const counts = { traced: 1, skipped: 1, inapplicable: 1 };

function section(id, rows) {
  const doc = findingsDoc(id, commit, [], rows ? { operationCoverage: rows } : {});
  doc.score = computeScore(doc);
  return { doc };
}

test('summary JSON retains operation records, counts and source attempts in mixed results', () => {
  const meta = { ...run, carried: { delivery: 'runs/a-01', tests: 'runs/a-02' } };
  const docs = { security: section('security', securityRows), delivery: section('delivery', deliveryRows), tests: section('tests') };
  const summary = JSON.parse(JSON.stringify(buildSummary(meta, docs)));
  assert.deepEqual(summary.operationCoverage, { counts, reportedSections: ['security', 'delivery'], unreportedSections: ['tests'] });
  assert.deepEqual(summary.sections.security.operationCoverage, { counts: { traced: 1, skipped: 1, inapplicable: 0 }, rows: securityRows });
  assert.deepEqual(summary.sections.delivery.operationCoverage.rows, deliveryRows);
  assert.equal('operationCoverage' in summary.sections.tests, false);
  assert.deepEqual(summary.reviewed, ['security']);
  assert.deepEqual(summary.carried, meta.carried);
  const previous = buildSummary(meta, Object.fromEntries(Object.keys(docs).map(id => [id, section(id)])));
  assert.deepEqual([summary.overall, summary.coverage, summary.band], [previous.overall, previous.coverage, previous.band]);
});

for (const [lang, labels] of Object.entries({
  en: ['Recorded operation checks', 'Traced: 1 · Skipped: 1 · Inapplicable: 1', 'Included sections without operation records: Tests', 'Carried from'],
  ru: ['Учтённые проверки операций', 'Прослежено: 1 · Пропущено: 1 · Неприменимо: 1', 'Разделы отчёта без сведений о проверке операций: Тесты', 'Перенесено из'],
})) {
  test(`${lang} renders dispositions, evidence, gaps and carried origin in both formats`, () => {
    const docs = { security: section('security', securityRows), delivery: section('delivery', deliveryRows), tests: section('tests') };
    const meta = { ...run, lang, carried: { delivery: 'runs/a-01' } };
    const ctx = { run: meta, docs, summary: buildSummary(meta, docs), rubrics: {}, lang };
    const md = renderMarkdown(ctx), html = renderHtml(ctx);
    for (const output of [md, html]) {
      for (const expected of [...labels, 'sign-in', 'authn', 'Sign in &lt;admin&gt;', 'src/login.js:2-4',
        'Adapter missing. Its outcome is unknown.', 'Mobile signing', 'Only the desktop build is supported.',
        'build/desktop.js:3', 'runs/a-01']) assert.ok(output.includes(expected), expected);
    }
    assert.ok(md.includes('Checked \\*both\\* \\[paths\\](relative).'));
    assert.ok(html.includes('Checked *both* [paths](relative).'));
    assert.ok(!html.includes('<admin>'));
    assert.ok(md.includes(`${labels[3]}: \`runs/a-01\``));
    assert.ok(html.includes(`${labels[3]}: <code>runs/a-01</code>`));
  });
}

test('legacy, quick and external-only reports with no operation records retain their original shape', () => {
  for (const [profile, docs, extra] of [
    ['full', { security: section('security') }, {}],
    ['quick', { tests: section('tests') }, {}],
    ['custom', {}, { reviewSections: [], externalAssessments: {
      'web-assessment': { status: 'external-assessment-required', recordedAtCommit: commit, sourceAttempt: 'runs/a-01' },
    } }],
  ]) {
    const meta = { ...run, profile, ...extra };
    const summary = buildSummary(meta, docs);
    const ctx = { run: meta, docs, summary, rubrics: {}, lang: 'en' };
    assert.equal('operationCoverage' in summary, false);
    for (const output of [renderMarkdown(ctx), renderHtml(ctx)]) assert.doesNotMatch(output, /operation records|Recorded operation checks/);
  }
});
