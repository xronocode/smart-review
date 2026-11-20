import assert from 'node:assert/strict';
import { existsSync, readFileSync, renameSync, symlinkSync } from 'node:fs';
import { basename, join } from 'node:path';
import { test } from 'node:test';
import { main } from '../../skills/smart-review/cli/smart-review.mjs';
import { commitAll, findingsDoc, makeRepo, read, write } from './helpers.mjs';

const topic = 'web-pentest';
const metadata = {
  assessmentDate: '2024-02-29', scope: 'Portal settings', deploymentId: 'portal-17',
  reference: 'https://example.invalid/A17', documents: ['A17.pdf'],
};

function cli(args, expected = 0) {
  const lines = [];
  const code = main(args, line => lines.push(line));
  assert.equal(code, expected, lines.join('\n'));
  return lines.join('\n');
}

function session(t) {
  const { repo, cleanup } = makeRepo({ '.gitignore': '.smart-review/\n' });
  t.after(cleanup);
  const root = join(repo, '.smart-review');
  const start = (...args) => JSON.parse(cli(['start', '--repo', repo, ...args]));
  const finish = (run, expected) => cli(['finish', run.runDir, '--repo', repo], expected);
  const lint = (run, expected) => JSON.parse(cli(['lint', run.runDir, '--repo', repo, '--json'], expected)).errors;
  const input = join(repo, 'metadata.json');
  write(input, metadata);
  return { repo, root, input, start, lint, finish };
}

const report = (run, format) => readFileSync(join(run.runDir, 'report.' + format), 'utf8');
const summary = run => read(join(run.runDir, 'summary.json'));

test('external-only selection publishes a localized status with no source work, score or coverage', t => {
  const { start, lint, finish, root } = session(t);
  const catalog = JSON.parse(cli(['rubrics', '--json']));
  assert.deepEqual(catalog.externalTopics, [topic]);
  assert.equal(Object.hasOwn(catalog.topics, topic), false);
  assert.match(cli(['catalog', '--lang', 'ru']), /web-pentest[^\n]+требуется внешняя проверка, без балла/);
  for (const [lang, label] of [['en', 'External assessment required'], ['ru', 'Требуется внешняя проверка']]) {
    const run = start('--topics', topic + ',' + topic, '--lang', lang);
    assert.deepEqual(run.topics, [topic]);
    assert.deepEqual(run.sections, []);
    assert.deepEqual(run.reviewSections, []);
    assert.equal(run.profile, 'custom');
    assert.deepEqual(run.rubrics, {});
    assert.deepEqual(lint(run), []);
    assert.ok(finish(run).includes(label));
    assert.equal(summary(run).overallStatus, 'external-only');
    for (const field of ['overall', 'overallRaw', 'overallCap', 'band', 'coverage']) assert.equal(summary(run)[field], null);
    const entry = summary(run).externalAssessments[topic];
    assert.equal(entry.status, 'external-assessment-required');
    assert.equal(entry.statusLabel, label);
    for (const format of ['md', 'html']) {
      assert.ok(report(run, format).includes(label));
      assert.ok(report(run, format).includes(entry.sourceAttempt));
      assert.doesNotMatch(report(run, format), /\/100|0\/0|undefined/);
    }
    const published = read(join(root, 'index.json')).runs.at(-1);
    assert.equal(published.overall, null);
    assert.equal(published.externalAssessments[topic], entry.status);
    assert.equal(existsSync(join(run.runDir, topic + '.findings.json')), false);
  }
});

test('mixed reports keep the source score and render all user-supplied fields as inert text', t => {
  const { start, finish, lint, input } = session(t);
  const supplied = { ...metadata, scope: '</dd><img src=x>', documents: ['[open](https://example.invalid/x)', '~~~ title.pdf'] };
  write(input, supplied);
  const run = start('--topics', topic + ',secrets', '--external-assessment', input);
  assert.deepEqual(run.reviewSections, ['security']);
  assert.deepEqual(run.sections, ['security']);
  write(input, 'replaced after import');
  assert.ok(lint(run, 1).some(e => e.rule === 'SECTION-MISSING'));
  finish(run, 1);
  write(join(run.runDir, 'security.findings.json'), findingsDoc('security', run.repo.commit));
  finish(run);
  const entry = summary(run).externalAssessments[topic];
  assert.deepEqual(entry.metadata, supplied);
  assert.equal(entry.status, 'metadata-supplied');
  assert.equal(summary(run).overall, 94);
  assert.equal(Object.hasOwn(entry, 'score'), false);
  for (const [lang, label] of [['en', 'User-supplied assessment metadata'], ['ru', 'Предоставлены сведения о внешней проверке']]) {
    cli(['report', run.runDir, '--lang', lang]);
    assert.equal(summary(run).externalAssessments[topic].statusLabel, label);
    const md = report(run, 'md');
    const html = report(run, 'html');
    assert.ok(md.includes(label) && html.includes(label));
    for (const literal of [supplied.scope, supplied.assessmentDate, supplied.deploymentId, supplied.reference, ...supplied.documents]) {
      assert.ok(md.split('\n').some(line => line.startsWith('    ') && line.endsWith(literal)), literal);
    }
    assert.ok(html.includes('&lt;/dd&gt;&lt;img src=x&gt;'));
    assert.doesNotMatch(html, /<img\b|href="https?:|<script\b/);
  }
});

test('status-only publication preserves source history and carries external records only from their original commit', t => {
  const { start, finish, root, input, repo } = session(t);
  const source = start('--sections', 'security,tests');
  for (const id of source.sections) write(join(source.runDir, id + '.findings.json'), findingsDoc(id, source.repo.commit));
  finish(source);
  const originalReport = report(source, 'html');
  const external = start('--topics', topic, '--external-assessment', input);
  finish(external);
  assert.deepEqual(summary(external).sections, {});
  assert.equal(summary(external).overall, null);
  const original = external.externalAssessments[topic];
  const next = start('--sections', 'tests');
  assert.equal(next.carried.security, 'runs/' + basename(source.runDir));
  assert.deepEqual(next.externalAssessments[topic], original);
  write(join(next.runDir, 'tests.findings.json'), findingsDoc('tests', next.repo.commit));
  finish(next);
  assert.ok(report(next, 'md').includes('Carried from: ' + original.sourceAttempt));
  const again = start('--topics', topic);
  finish(again);
  assert.equal(summary(again).externalAssessments[topic].status, 'external-assessment-required');
  assert.equal(again.externalAssessments[topic].metadata, undefined);
  assert.equal(report(source, 'html'), originalReport);
  assert.equal(read(join(root, 'index.json')).runs.length, 4);
  commitAll(repo, 'next revision');
  const other = start('--sections', 'tests');
  assert.equal(other.externalAssessments, undefined);
  assert.equal(other.previous.dir, 'runs/' + basename(next.runDir));
  const requested = start('--topics', topic);
  assert.equal(requested.externalAssessments[topic].recordedAtCommit, other.repo.commit);
  assert.equal(requested.externalAssessments[topic].metadata, undefined);
});

test('import rejects invalid metadata, nonlocal paths and secret-shaped text before opening an attempt', t => {
  const { input, root, repo } = session(t);
  const args = ['start', '--repo', repo, '--topics', topic, '--external-assessment'];
  for (const value of [null, [], {}, { ...metadata, status: 'passed' }, { ...metadata, score: 100 },
    { ...metadata, assessmentDate: '2025-02-29' }, { ...metadata, scope: ' \t ' }, { ...metadata, scope: 'x\nInjected heading' },
    { ...metadata, reference: 'x\u202eabc' }, { ...metadata, deploymentId: 'x'.repeat(513) },
    { ...metadata, documents: [{}] }, { ...metadata, documents: Array(33).fill('file') },
    { ...metadata, documents: ['ghp_' + 'A'.repeat(40)] }, { ...metadata, ['__proto__']: {} }, { ...metadata, constructor: 1 },
    'invalid JSON', ' '.repeat(65537)]) {
    write(input, value);
    const out = cli([...args, input], 2);
    assert.ok(!out.includes('A'.repeat(40)));
    assert.equal(existsSync(join(root, 'runs')), false);
  }
  for (const path of ['https://example.invalid/report', '//example.invalid/share', repo]) cli([...args, path], 2);
  cli(args, 2);
  cli(['start', '--repo', repo, '--sections', 'tests', '--external-assessment', input], 2);
});

test('advisory checks with a known or unknown asOf date require fresh external evidence', t => {
  const { start, finish } = session(t);
  for (const asOf of ['2026-11-15', 'unknown']) {
    const run = start('--sections', 'dependencies');
    const doc = findingsDoc('dependencies', run.repo.commit, []);
    doc.checked.push({ area: 'Advisories', note: 'Supplied snapshot.', asOf });
    doc.tools = [{ name: 'osv-scanner', status: 'used' }];
    write(join(run.runDir, 'dependencies.findings.json'), doc);
    finish(run);
    for (const [lang, unknown] of [['en', 'date unknown'], ['ru', 'дата неизвестна']]) {
      cli(['report', run.runDir, '--lang', lang]);
      const expected = asOf === 'unknown' ? unknown : asOf;
      for (const format of ['md', 'html']) assert.ok(report(run, format).includes(expected));
    }
    const next = start('--sections', 'tests');
    assert.deepEqual(next.stale, { dependencies: 'external-data' });
    assert.deepEqual(next.carried, {});
  }
});

test('scope and provenance checks reject empty, relabelled, changed and redirected records before publication', t => {
  const { input, start, lint, finish, root } = session(t);
  const first = start('--topics', topic, '--external-assessment', input);
  const manifest = join(first.runDir, 'run.json');
  const run = read(manifest);
  const entry = run.externalAssessments[topic];
  for (const change of [
    { profile: 'full' }, { topics: [] }, { reviewSections: undefined }, { externalAssessments: undefined }, { rubrics: { security: '1' } },
    { topics: [], externalAssessments: undefined, reviewSections: undefined },
    ...[{ recordedAtCommit: '0'.repeat(40) }, { status: 'external-assessment-required' },
      { metadata: { ...metadata, scope: 'Different deployment' } }, { sourceAttempt: '../old' }, { score: 100 }].map(fields =>
      ({ externalAssessments: { [topic]: { ...entry, ...fields } } })),
  ]) {
    write(manifest, { ...run, ...change });
    assert.ok(lint(first, 1).length);
    finish(first, 1);
    assert.equal(existsSync(join(root, 'index.json')), false);
  }
  write(manifest, run);
  finish(first);
  const next = start('--sections', 'tests');
  write(join(next.runDir, 'tests.findings.json'), findingsDoc('tests', run.repo.commit));
  const copy = join(next.runDir, 'run.json');
  const unedited = read(copy);
  for (const change of [{ topics: [topic] }, { externalAssessments: { [topic]: { ...entry, metadata: { ...metadata, deploymentId: 'another' } } } }]) {
    write(copy, { ...unedited, ...change });
    finish(next, 1);
    assert.ok(lint(next, 1).some(issue => issue.rule === 'EXTERNAL-SOURCE'));
    cli(['report', next.runDir], 2);
  }
  write(copy, unedited);
  const snapshot = join(first.runDir, 'external-assessment.json');
  renameSync(snapshot, snapshot + '.moved');
  symlinkSync(snapshot + '.moved', snapshot);
  finish(next, 1);
  assert.equal(read(join(root, 'index.json')).runs.length, 1);
});

test('a findings file placed in a status-only run cannot add a score to its report', t => {
  const { start, finish, lint, root } = session(t);
  const run = start('--topics', topic);
  const file = join(run.runDir, 'security.findings.json');
  write(file, findingsDoc('security', run.repo.commit));
  cli(['score', run.runDir]);
  cli(['score', file], 2);
  assert.equal(read(file).score, undefined);
  assert.ok(lint(run, 1).some(issue => issue.rule === 'SECTION-UNKNOWN'));
  cli(['report', run.runDir], 2);
  finish(run, 1);
  assert.equal(existsSync(join(root, 'index.json')), false);
});

test('standalone report requires the exact declared findings set before writing any output', t => {
  const { start, finish } = session(t);
  const base = start('--sections', 'security,tests');
  for (const id of base.sections) write(join(base.runDir, id + '.findings.json'), findingsDoc(id, base.repo.commit));
  finish(base);
  const retry = start('--sections', 'tests');
  assert.deepEqual(Object.keys(retry.carried), ['security']);
  const render = expected => cli(['report', retry.runDir], expected);
  const outputs = ['summary.json', 'report.md', 'report.html'].map(name => join(retry.runDir, name));
  render(2);
  assert.ok(outputs.every(path => !existsSync(path)));
  const findings = join(retry.runDir, 'tests.findings.json');
  write(findings, findingsDoc('tests', retry.repo.commit));
  cli(['score', retry.runDir]);
  render(0);
  const before = outputs.map(path => readFileSync(path, 'utf8'));
  const wrongName = join(retry.runDir, 'extra.findings.json');
  renameSync(findings, wrongName);
  render(2);
  assert.deepEqual(outputs.map(path => readFileSync(path, 'utf8')), before);
  renameSync(wrongName, findings);
  const manifest = join(retry.runDir, 'run.json');
  const legacy = read(manifest);
  for (const key of ['reviewSections', 'topics', 'carried', 'stale', 'baseDir']) delete legacy[key];
  write(manifest, legacy);
  render(0);
  assert.deepEqual(Object.keys(summary(retry).sections), base.sections);
});

test('standalone check and run lint require a real calendar date or unknown for checked evidence', t => {
  const { repo, start, lint } = session(t);
  const run = start('--sections', 'tests');
  const file = join(run.runDir, 'tests.findings.json');
  write(file, findingsDoc('tests', run.repo.commit));
  cli(['score', run.runDir]);
  const doc = read(file);
  for (const [asOf, valid] of [['2025-02-29', false], ['2026-04-31', false], ['1900-02-29', false],
    ['2000-02-29', true], ['2026-04-30', true], ['unknown', true]]) {
    doc.checked[0].asOf = asOf;
    write(file, doc);
    const code = valid ? 0 : 1;
    const standalone = JSON.parse(cli(['check', file, '--repo', repo, '--json'], code)).errors;
    for (const errors of [standalone, lint(run, code)]) {
      assert.deepEqual(errors.map(issue => issue.rule), valid ? [] : ['SCHEMA'], asOf);
      if (!valid) assert.match(errors[0].message, /checked\[0\]\.asOf/);
    }
  }
});
