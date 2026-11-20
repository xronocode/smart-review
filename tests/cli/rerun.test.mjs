import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { main } from '../../skills/smart-review/cli/smart-review.mjs';
import { commitAll, finding, findingsDoc, makeRepo, read, write } from './helpers.mjs';

function session(fixture) {
  const root = join(fixture.repo, '.smart-review');
  const start = (...args) => {
    const lines = [];
    assert.equal(main(['start', '--repo', fixture.repo, ...args], line => lines.push(line)), 0, lines.join('\n'));
    return JSON.parse(lines.join('\n'));
  };
  const finish = run => main(['finish', run.runDir, '--repo', fixture.repo], () => {});
  const inspect = run => {
    for (const id of run.reviewSections) {
      const findings = id === 'security' ? [finding(1, { topics: ['secrets', 'authn'] })] : [];
      write(join(run.runDir, `${id}.findings.json`), findingsDoc(id, run.repo.commit, findings));
    }
  };
  const index = () => read(join(root, 'index.json')).runs;
  return { root, start, inspect, finish, index };
}

test('full then secrets and tests publishes a complete report only after successful verification', () => {
  const fixture = makeRepo();
  try {
    const { root, start, inspect, finish, index } = session(fixture);
    const full = start('--profile', 'full');
    inspect(full);
    assert.equal(finish(full), 0);
    const baseline = index().at(-1);
    const fullReport = readFileSync(join(full.runDir, 'report.html'), 'utf8');
    const retry = start('--topics', 'secrets,secrets', '--sections', 'tests,security');
    assert.deepEqual(retry.reviewSections, ['tests', 'security']);
    assert.deepEqual(retry.topics, ['secrets']);
    assert.deepEqual(retry.sections, full.sections);
    assert.deepEqual(Object.keys(retry.carried).sort(), ['ai-readiness', 'dependencies', 'hygiene']);
    assert.equal(retry.carried.hygiene, baseline.dir);
    assert.equal(finish(retry), 1);
    assert.equal(index().at(-1).dir, baseline.dir);
    assert.equal(readFileSync(join(full.runDir, 'report.html'), 'utf8'), fullReport);
    inspect(retry);
    assert.equal(main(['score', retry.runDir], () => {}), 0);
    assert.equal(main(['report', retry.runDir], () => {}), 0);
    assert.equal(index().at(-1).dir, baseline.dir);
    assert.equal(finish(retry), 0);
    const newDir = join(root, index().at(-1).dir);
    assert.equal(newDir, retry.runDir);
    const summary = read(join(newDir, 'summary.json'));
    assert.deepEqual(Object.keys(summary.sections), full.sections);
    assert.equal(summary.sections.security.score, 94);
    const third = start('--topics', 'authn');
    assert.equal(third.carried.hygiene, baseline.dir);
    assert.equal(third.carried.tests, index().at(-1).dir);
    const copied = join(third.runDir, 'hygiene.findings.json');
    write(copied, { ...read(copied), verdict: 'Altered' });
    inspect(third);
    assert.equal(finish(third), 1);
    assert.equal(index().length, 2);
  } finally {
    fixture.cleanup();
  }
});

test('overlapping attempts cannot replace a newer result and another commit never inherits scores', () => {
  const fixture = makeRepo();
  try {
    const { start, inspect, finish, index } = session(fixture);
    const first = start('--profile', 'quick');
    const concurrent = start('--sections', 'hygiene');
    inspect(first);
    inspect(concurrent);
    assert.equal(finish(first), 0);
    assert.equal(finish(concurrent), 2);
    assert.equal(index().length, 1);
    write(join(fixture.repo, '.gitignore'), '.smart-review/\n');
    commitAll(fixture.repo, 'next revision');
    const next = start('--topics', 'dead-code');
    assert.deepEqual(next.reviewSections, ['hygiene']);
    assert.deepEqual(next.carried, {});
    assert.deepEqual(next.sections, ['hygiene']);
    assert.equal(next.stale.security, 'commit');
    assert.equal(next.previous.commit, first.repo.commit);
    assert.equal(existsSync(join(next.runDir, 'security.findings.json')), false);
  } finally {
    fixture.cleanup();
  }
});

test('changed rubric version and external advisory data require fresh inspection', () => {
  const fixture = makeRepo();
  try {
    const { start, inspect, finish } = session(fixture);
    const baseline = start();
    inspect(baseline);
    const depFile = join(baseline.runDir, 'dependencies.findings.json');
    write(depFile, { ...read(depFile), tools: [{ name: 'osv-scanner', status: 'used' }] });
    assert.equal(finish(baseline), 0);
    const hygiene = join(baseline.runDir, 'hygiene.findings.json');
    write(hygiene, { ...read(hygiene), rubricVersion: '0.9.0' });
    const retry = start('--sections', 'tests');
    assert.equal(retry.stale.dependencies, 'advisory-data');
    assert.equal(retry.stale.hygiene, 'version');
    assert.ok(!retry.sections.includes('dependencies') && !retry.sections.includes('hygiene'));
  } finally {
    fixture.cleanup();
  }
});

test('legacy commit-only results remain readable and version changes require a fresh inspection', () => {
  const fixture = makeRepo();
  try {
    const { root, start, inspect, finish, index } = session(fixture);
    const baseline = start();
    inspect(baseline);
    assert.equal(finish(baseline), 0);
    const [entry] = index();
    entry.dir = `runs/${fixture.commit.slice(0, 12)}`;
    const legacy = join(root, entry.dir);
    renameSync(baseline.runDir, legacy);
    const meta = read(join(legacy, 'run.json'));
    for (const field of ['reviewSections', 'topics', 'carried', 'stale', 'baseDir']) delete meta[field];
    write(join(legacy, 'run.json'), { ...meta, scoringVersion: '3' });
    write(join(root, 'index.json'), { schemaVersion: 1, runs: [entry] });
    const before = readFileSync(join(legacy, 'report.html'));
    const next = start('--topics', 'secrets');
    assert.deepEqual(next.sections, ['security']);
    assert.equal(next.stale.tests, 'version');
    assert.ok(existsSync(join(next.runDir, 'prior', 'security.findings.json')));
    inspect(next);
    assert.equal(finish(next), 0);
    assert.deepEqual(readFileSync(join(legacy, 'report.html')), before);
  } finally {
    fixture.cleanup();
  }
});

test('a retry completes an interrupted index publication without losing the previous report', () => {
  const fixture = makeRepo();
  try {
    const { root, start, inspect, finish, index } = session(fixture);
    const first = start('--profile', 'quick');
    inspect(first);
    assert.equal(finish(first), 0);
    const published = read(join(root, 'index.json'));
    const next = start('--topics', 'secrets');
    inspect(next);
    assert.equal(finish(next), 0);
    renameSync(join(root, 'index.json'), join(root, '.publications', '2', 'index.json'));
    write(join(root, 'index.json'), published);
    assert.equal(index().at(-1).dir, published.runs.at(-1).dir);
    assert.ok(existsSync(join(first.runDir, 'report.html')));
    assert.equal(finish(next), 0);
    assert.equal(index().length, 2);
    assert.equal(join(root, index().at(-1).dir), next.runDir);
  } finally {
    fixture.cleanup();
  }
});

test('finish explains thirteen unknown security criteria in the CLI and published report', () => {
  const fixture = makeRepo();
  try {
    const { start } = session(fixture);
    const run = start('--topics', 'authn', '--lang', 'ru');
    const doc = findingsDoc('security', fixture.commit, [], { lang: 'ru' });
    doc.criteria = doc.criteria.map(({ id }) => ({ id, status: 'unknown', note: 'Недостаточно свидетельств.' }));
    write(join(run.runDir, 'security.findings.json'), doc);
    const lines = [];
    assert.equal(main(['finish', run.runDir, '--repo', fixture.repo], line => lines.push(line)), 0);
    assert.ok(lines.includes('security: Недостаточно данных'));
    assert.ok(lines.includes('overall: Недостаточно данных'));
    assert.equal(read(join(run.runDir, 'summary.json')).overall, null);
    assert.deepEqual(read(join(run.runDir, 'summary.json')).coverage, { assessed: 0, applicable: 13 });
    for (const filename of ['report.md', 'report.html']) {
      const report = readFileSync(join(run.runDir, filename), 'utf8');
      assert.ok(report.includes('Недостаточно данных') && report.includes('0/13'));
      assert.ok(!report.includes('100/100'));
    }
  } finally {
    fixture.cleanup();
  }
});
