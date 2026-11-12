import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeScore, bandOf, WEIGHTS, CAPS, MEDIUM_TOTAL_MAX, LOW_TOTAL_MAX } from '../../skills/smart-audit/cli/lib/score.mjs';
import { buildSummary } from '../../skills/smart-audit/cli/lib/report.mjs';
import { main } from '../../skills/smart-audit/cli/smart-audit.mjs';
import { validate } from '../../skills/smart-audit/cli/lib/validate.mjs';
import { finding, findingsDoc, makeRepo, write, SKILL, read } from './helpers.mjs';

const doc = (findings) => ({ audit: 'security', findings });
const f = (severity, over = {}) => finding(1, { severity, ...over });

test('no findings scores 100 with no steps', () => {
  const s = computeScore(doc([]));
  assert.equal(s.value, 100);
  assert.deepEqual(s.steps, []);
  assert.equal(s.cap, null);
  assert.equal(s.band, 'good');
});

test('deductions follow the published weights', () => {
  const s = computeScore(doc([f('medium'), f('medium'), f('low')]));
  assert.equal(s.value, 100 - 2 * WEIGHTS.medium - WEIGHTS.low);
  assert.deepEqual(s.steps.map((x) => [x.severity, x.count, x.subtotal, x.running]), [['medium', 2, 12, 88], ['low', 1, 2, 86]]);
});

test('one high finding caps the score below the good band', () => {
  const s = computeScore(doc([f('high')]));
  assert.equal(s.raw, 85);
  assert.deepEqual(s.cap, { value: CAPS.high, reason: 'high' });
  assert.equal(s.value, 69);
  assert.equal(s.band, 'fair');
});

test('one critical finding caps the score in the poor band', () => {
  const s = computeScore(doc([f('critical')]));
  assert.equal(s.raw, 60);
  assert.equal(s.value, CAPS.critical);
  assert.equal(s.band, 'poor');
});

test('a cap never raises a score and the score never goes below zero', () => {
  assert.equal(computeScore(doc(Array.from({ length: 4 }, () => f('high')))).value, 40);
  assert.equal(computeScore(doc(Array.from({ length: 9 }, () => f('critical')))).value, 0);
});

test('info and low-confidence findings are listed but not deducted', () => {
  const s = computeScore(doc([finding(1, { severity: 'info' }), finding(2, { severity: 'high', confidence: 'low' })]));
  assert.equal(s.value, 100);
  assert.deepEqual(s.notCounted, [{ id: 'F-001', reason: 'info' }, { id: 'F-002', reason: 'low-confidence' }]);
});

test('an accepted risk removes low and medium deductions only', () => {
  const accepted = [{ audit: 'security', key: 'sample-finding-1', reason: 'r' }, { audit: 'security', key: 'sample-finding-2', reason: 'r' }];
  const s = computeScore(doc([finding(1, { severity: 'medium' }), finding(2, { severity: 'high' })]), accepted);
  assert.equal(s.raw, 85);
  assert.deepEqual(s.notCounted, [{ id: 'F-001', reason: 'accepted-risk' }]);
  const other = computeScore({ audit: 'tests', findings: [finding(1)] }, accepted);
  assert.equal(other.value, 94, 'acceptance is scoped to its audit');
});

test('low findings together deduct at most the limit', () => {
  const lows = (n) => Array.from({ length: n }, (_, i) => finding(i + 1, { severity: 'low', key: `low-${i}` }));
  assert.equal(computeScore(doc(lows(7))).value, 86);
  assert.equal(computeScore(doc(lows(7))).steps[0].limited, undefined);
  const many = computeScore(doc(lows(20)));
  assert.equal(many.value, 100 - LOW_TOTAL_MAX);
  assert.deepEqual(many.steps, [{ severity: 'low', count: 20, weight: 2, subtotal: 14, running: 86, limited: 14 }]);
  assert.ok(LOW_TOTAL_MAX < WEIGHTS.high, 'all low findings together weigh less than one high finding');
  assert.equal(computeScore(doc([f('medium'), ...lows(20)])).value, 80);
});

test('bands split at 70 and 40', () => {
  assert.deepEqual([100, 70, 69, 40, 39, 0].map(bandOf), ['good', 'good', 'fair', 'fair', 'poor', 'poor']);
});

test('medium findings together deduct at most the limit', () => {
  const meds = (n) => Array.from({ length: n }, (_, i) => finding(i + 1, { severity: 'medium', key: `med-${i}` }));
  const ten = computeScore(doc(meds(10)));
  assert.equal(ten.scoringVersion, '3');
  assert.equal(ten.value, 100 - MEDIUM_TOTAL_MAX);
  assert.equal(ten.band, 'good');
  assert.deepEqual(ten.steps, [{ severity: 'medium', count: 10, weight: 6, subtotal: 30, running: 70, limited: 30 }]);
  const eleven = computeScore(doc(meds(11)));
  assert.equal(eleven.value, ten.value, 'the eleventh medium changes nothing');
  assert.deepEqual(eleven.steps.map((s) => [s.subtotal, s.limited]), [[30, 30]]);
  assert.deepEqual(computeScore(doc(meds(10))), ten, 'the same findings score identically');
});

test('one high finding still outweighs any number of medium findings', () => {
  const meds = (n) => Array.from({ length: n }, (_, i) => finding(i + 1, { severity: 'medium', key: `med-${i}` }));
  const lows = (n) => Array.from({ length: n }, (_, i) => finding(50 + i, { severity: 'low', key: `low-${i}` }));
  const mediumOnly = computeScore(doc(meds(50)));
  assert.equal(mediumOnly.value, 100 - MEDIUM_TOTAL_MAX, 'medium findings alone never leave the good band');
  assert.ok(mediumOnly.value > computeScore(doc([f('high')])).value, 'one counted high scores below any medium-only run');
  assert.ok(WEIGHTS.high > LOW_TOTAL_MAX, 'one high finding weighs more than all low findings together');
  const mixed = computeScore(doc([...meds(10), ...lows(20)]));
  assert.equal(mixed.value, 100 - MEDIUM_TOTAL_MAX - LOW_TOTAL_MAX);
  assert.equal(mixed.band, 'fair');
});

test('the overall score inherits the per-audit caps', () => {
  const runMeta = { repo: { commit: 'a'.repeat(40), branch: 'main', dirty: false, name: 'demo' }, profile: 'quick', scoringVersion: '3', startedAt: '2026-11-12T00:00:00.000Z', audits: ['security', 'tests', 'dependencies', 'ai-readiness', 'hygiene'] };
  const scored = (audit, findings) => {
    const entry = { doc: { audit, rubricVersion: '1.0.0', verdict: 'v', summary: 's', findings } };
    entry.doc.score = computeScore(entry.doc);
    return entry;
  };
  const run = (severity) => Object.fromEntries(runMeta.audits.map((id, i) => [id, i === 0 ? scored(id, [finding(1, { severity, key: `top-${severity}` })]) : scored(id, [])]));
  let s = buildSummary(runMeta, run('critical'));
  assert.equal(s.overallRaw, 88);
  assert.equal(s.overall, CAPS.critical, 'four clean audits plus a counted critical land in the poor band');
  assert.deepEqual(s.overallCap, { value: CAPS.critical, reason: 'critical' });
  assert.equal(s.band, 'poor');
  s = buildSummary(runMeta, run('high'));
  assert.equal(s.overallRaw, 94);
  assert.equal(s.overall, CAPS.high, 'four clean audits plus a counted high never read good');
  assert.deepEqual(s.overallCap, { value: CAPS.high, reason: 'high' });
  assert.equal(s.band, 'fair');
  s = buildSummary(runMeta, Object.fromEntries(runMeta.audits.map((id) => [id, scored(id, [])])));
  assert.equal(s.overall, 100);
  assert.equal(s.overallCap, null);
});

test('score command is idempotent on disk', () => {
  const { repo, commit, cleanup } = makeRepo();
  try {
    const file = join(repo, 'out', 'security.findings.json');
    write(file, findingsDoc('security', commit));
    assert.equal(main(['score', file], () => {}), 0);
    const first = readFileSync(file, 'utf8');
    assert.equal(main(['score', file], () => {}), 0);
    assert.equal(readFileSync(file, 'utf8'), first);
    assert.equal(read(file).score.value, 94);
  } finally {
    cleanup();
  }
});

test('shipped findings schema accepts a valid document and reports violations', () => {
  const schema = read(join(SKILL, 'schemas', 'findings.schema.json'));
  const good = findingsDoc('security', 'a'.repeat(40));
  assert.deepEqual(validate(good, schema), []);
  const bad = structuredClone(good);
  bad.findings[0].severity = 'severe';
  delete bad.findings[0].verification;
  bad.extra = 1;
  const msgs = validate(bad, schema).map((v) => `${v.path} ${v.message}`);
  assert.equal(msgs.length, 3);
  assert.ok(msgs.some((m) => m.includes('verification')));
  assert.ok(msgs.some((m) => m.includes('unknown property "extra"')));
});
