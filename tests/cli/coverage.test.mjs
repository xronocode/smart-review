import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { main } from '../../skills/smart-review/cli/smart-review.mjs';
import { computeScore } from '../../skills/smart-review/cli/lib/score.mjs';
import { buildSummary, renderHtml, renderMarkdown } from '../../skills/smart-review/cli/lib/report.mjs';
import { finding, findingsDoc, makeRepo, read, write } from './helpers.mjs';

const commit = 'a'.repeat(40);
const run = {
  repo: { commit, branch: 'main', name: 'demo' }, lang: 'en', profile: 'custom',
  startedAt: '2026-11-20T00:00:00Z', toolVersion: '1', scoringVersion: '4',
};

function section(id, statuses, findings = []) {
  const criteria = statuses.map((status, i) => ({
    id: `criterion-${i}`, status, note: 'Reviewed.', ...(status === 'scored' ? { score: 0 } : {}),
  }));
  const doc = findingsDoc(id, commit, findings, { criteria });
  doc.score = computeScore(doc);
  return { doc };
}

test('coverage counts unknown as applicable and a criterion rated zero as assessed', () => {
  const { score } = section('tests', ['na', 'unknown', 'scored']).doc;
  assert.deepEqual(score.coverage, { assessed: 1, applicable: 2 });
  assert.equal(score.value, 100);
  assert.equal(score.band, 'good');
});

for (const [statuses, status, applicable] of [
  [['na', 'na'], 'not-applicable', 0],
  [['na', 'unknown'], 'insufficient-data', 1],
  [[], 'insufficient-data', 0],
]) {
  test(`no numeric score or band for ${JSON.stringify(statuses)}`, () => {
    const entry = section('tests', statuses);
    const { score } = entry.doc;
    assert.deepEqual([score.reason, score.value, score.band], [status, null, null]);
    assert.deepEqual(score.coverage, { assessed: 0, applicable });
    const summary = buildSummary(run, { tests: entry });
    assert.deepEqual([summary.overallStatus, summary.overall, summary.overallRaw, summary.band], [status, null, null, null]);
    assert.deepEqual(summary.coverage, score.coverage);
  });
}

test('unscored sections stay out of the mean and their counted severe risks still cap it', () => {
  for (const [severity, limit] of [['high', 69], ['critical', 39]]) {
    const docs = {
      tests: section('tests', ['scored']),
      security: section('security', ['unknown'], [finding(1, { severity })]),
      dependencies: section('dependencies', ['na']),
    };
    const summary = buildSummary(run, docs);
    assert.equal(summary.sections.security.score, null);
    assert.equal(summary.overallRaw, 100);
    assert.equal(summary.overall, limit);
    assert.deepEqual(summary.overallCap, { value: limit, reason: severity });
    assert.deepEqual(summary.coverage, { assessed: 1, applicable: 2 });
    const unscored = buildSummary(run, { security: docs.security });
    assert.equal(unscored.overall, null);
    assert.deepEqual(unscored.overallCap, summary.overallCap);
  }
  const lowConfidence = finding(1, { severity: 'critical', confidence: 'low' });
  assert.equal(buildSummary(run, { security: section('security', ['unknown'], [lowConfidence]) }).overallCap, null);
});

const languages = [
  { lang: 'en', requested: 'Requested topics', reviewed: 'Reviewed this attempt', carried: 'Carried from',
    stale: 'Stale', coverage: 'Criteria assessed / applicable', topics: 'Finding topics',
    unknown: 'Insufficient data', na: 'Not applicable', staleLanguage: 'Different report language', risk: 'a high finding caps the overall score at 69' },
  { lang: 'ru', requested: 'Запрошенные темы', reviewed: 'Проверено в этой попытке', carried: 'Перенесено из',
    stale: 'Устаревшие результаты', coverage: 'Оценено / применимо критериев', topics: 'Темы находки',
    unknown: 'Недостаточно данных', na: 'Неприменимо', staleLanguage: 'Другой язык отчёта', risk: 'высокая находка ограничивает общий балл значением 69' },
];

for (const L of languages) {
  test(`${L.lang} reports show actual scope, coverage, source attempts, stale reasons and finding topics`, () => {
    const topics = ['secrets', 'authn'];
    const meta = { ...run, topics: ['secrets'], carried: { tests: 'runs/abc/attempt-1' }, stale: { hygiene: 'rubric <changed>', dependencies: 'language' } };
    const docs = {
      security: section('security', ['scored', 'unknown'], [finding(1, { topics })]),
      tests: section('tests', ['na']),
    };
    const summary = buildSummary(meta, docs);
    assert.deepEqual(summary.reviewed, ['security']);
    assert.deepEqual(summary.carried, meta.carried);
    assert.deepEqual(summary.stale, meta.stale);
    assert.deepEqual(summary.topics, meta.topics);
    assert.deepEqual(summary.sections.security.findingTopics, { 'F-001': topics });
    assert.equal(summary.overall, 94);
    const ctx = { run: meta, docs, rubrics: {}, summary, lang: L.lang };
    for (const report of [renderMarkdown(ctx), renderHtml(ctx)]) {
      for (const label of [L.requested, L.reviewed, L.carried, L.stale, L.staleLanguage, L.coverage, L.topics, L.na,
        'secrets', 'authn', 'runs/abc/attempt-1', '1/2', '0/0', 'rubric &lt;changed&gt;']) {
        assert.ok(report.includes(label), label);
      }
      assert.doesNotMatch(report, /null\/100|—\/100|undefined/);
    }
  });

  test(`${L.lang} reports label an empty aggregate, including all-na and unknown with a known risk`, () => {
    for (const [docs, emptyLabel] of [
      [{}, L.unknown],
      [{ tests: section('tests', ['na']) }, L.na],
      [{ tests: section('tests', ['na']), security: section('security', ['unknown'], [finding(1, { severity: 'high' })]) }, L.unknown],
    ]) {
      const summary = buildSummary(run, docs);
      const ctx = { run, docs, rubrics: {}, summary, lang: L.lang };
      for (const report of [renderMarkdown(ctx), renderHtml(ctx)]) {
        assert.ok(report.includes(emptyLabel));
        if (docs.security) assert.ok(report.includes(L.risk));
        assert.doesNotMatch(report, /(?:null|—|\d+)\/100|undefined/);
      }
    }
  });
}

test('legacy documents keep their stored numeric scores without provenance or coverage metadata', () => {
  const entry = section('tests', ['na']);
  entry.doc.score = { scoringVersion: '3', value: 100, band: 'good', base: 100, steps: [], raw: 100, cap: null, notCounted: [] };
  const docs = { tests: entry };
  const legacyRun = { ...run, scoringVersion: '3' };
  const summary = buildSummary(legacyRun, docs);
  assert.equal(summary.overall, 100);
  const ctx = { run: legacyRun, docs, rubrics: {}, summary, lang: 'en' };
  for (const report of [renderMarkdown(ctx), renderHtml(ctx)]) {
    assert.ok(report.includes('100/100'));
    assert.doesNotMatch(report, /undefined|Insufficient data/);
  }
});

test('finish publishes an unassessed section with no numeric score in any report', () => {
  const fixture = makeRepo();
  try {
    const output = [];
    assert.equal(main(['start', '--repo', fixture.repo, '--sections', 'tests'], (line) => output.push(line)), 0);
    const { runDir } = JSON.parse(output.join('\n'));
    const doc = findingsDoc('tests', fixture.commit, []);
    doc.criteria = doc.criteria.map(({ id }) => ({ id, status: 'unknown', note: 'No evidence available.' }));
    write(join(runDir, 'tests.findings.json'), doc);
    assert.equal(main(['finish', runDir, '--repo', fixture.repo], () => {}), 0);
    const summary = read(join(runDir, 'summary.json'));
    assert.deepEqual(summary.coverage, { assessed: 0, applicable: doc.criteria.length });
    assert.equal(summary.overallStatus, 'insufficient-data');
    assert.equal(summary.overall, null);
    assert.equal(summary.sections.tests.band, null);
    for (const file of ['report.md', 'report.html']) {
      const report = readFileSync(join(runDir, file), 'utf8');
      assert.ok(report.includes('Overall score: Insufficient data'));
      assert.doesNotMatch(report, /(?:null|—|\d+)\/100/);
    }
  } finally {
    fixture.cleanup();
  }
});

test('v1 and v2 reports retain their uncapped aggregate and original formula labels', () => {
  for (const scoringVersion of ['1', '2']) {
    const meta = { ...run, scoringVersion };
    const docs = { tests: section('tests', ['scored']), security: section('security', ['scored'], [finding(1, { severity: 'high' })]) };
    for (const { doc } of Object.values(docs)) {
      delete doc.score.coverage;
      doc.score.scoringVersion = scoringVersion;
    }
    const summary = buildSummary(meta, docs);
    assert.equal(summary.overall, 85);
    assert.equal(summary.overallCap, null);
    const ctx = { run: meta, docs, rubrics: {}, summary, lang: 'en' };
    const html = renderHtml(ctx);
    assert.ok(html.includes('85/100'));
    assert.ok(renderMarkdown(ctx).includes('85/100'));
    assert.ok(!html.includes('medium findings together at most'));
    assert.equal(html.includes('low findings together at most'), scoringVersion === '2');
  }
});
