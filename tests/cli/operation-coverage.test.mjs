import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { main } from '../../skills/smart-review/cli/smart-review.mjs';
import { findingsDoc, fullReviewCoverage, makeRepo, read, write } from './helpers.mjs';

function start(t, ...scope) {
  const { repo, commit, cleanup } = makeRepo();
  t.after(cleanup);
  const cli = (args, expected = 0) => {
    const lines = [];
    const status = main([...args, '--repo', repo], line => lines.push(line));
    assert.equal(status, expected, args.join(' ') + '\n' + lines.join('\n'));
    return lines.join('\n');
  };
  const run = JSON.parse(cli(['start', ...scope]));
  const path = name => join(run.runDir, name);
  const check = (filename, expected = 0) => JSON.parse(cli(['check', path(filename), '--json'], expected)).errors;
  return { repo, commit, cli, run, path, check };
}

test('full review publishes complete dispositions, including an explicit gap, at the original score', t => {
  const { repo, commit, cli, run, path, check } = start(t, '--profile', 'full');
  const { recon, coverage } = fullReviewCoverage(commit);
  assert.equal(new Set(recon.operationInventory.map(row => row.topic)).size, 21);
  const extra = { topic: 'authn', key: 'session-refresh', operation: 'Refresh an existing session' };
  recon.operationInventory.push(extra);
  coverage.security.push({ ...extra, status: 'skipped', note: 'The refresh adapter was outside the time budget. Its failure path remains unchecked.' });
  const db = coverage.database[0];
  Object.assign(db, { status: 'inapplicable', note: 'The example exports only a constant and has no database calls.' });
  for (const id of run.reviewSections) {
    write(path(id + '.findings.json'), findingsDoc(id, commit, [], { operationCoverage: coverage[id] }));
  }
  cli(['score', run.runDir]);
  // A missing recon must block both lint and publication even when every section is present.
  assert.ok(JSON.parse(cli(['lint', run.runDir, '--json'], 1)).errors.some(issue => issue.rule === 'OPERATION-INVENTORY'));
  cli(['finish', run.runDir], 1);
  assert.equal(existsSync(join(repo, '.smart-review', 'index.json')), false);

  write(path('recon.json'), recon);
  assert.deepEqual(check('recon.json'), []);
  const security = read(path('security.findings.json'));
  write(path('security.findings.json'), { ...security, operationCoverage: coverage.security.filter(row => row.key !== extra.key) });
  assert.ok(check('security.findings.json', 1).some(issue => issue.message.includes(extra.key)));
  assert.ok(JSON.parse(cli(['lint', run.runDir, '--json'], 1)).errors.some(issue => issue.rule === 'OPERATION-COVERAGE'));
  cli(['finish', run.runDir], 1);
  assert.equal(existsSync(join(repo, '.smart-review', 'index.json')), false);

  write(path('security.findings.json'), security);
  assert.deepEqual(check('security.findings.json'), []);
  cli(['lint', run.runDir]);
  cli(['finish', run.runDir]);
  assert.equal(read(join(repo, '.smart-review', 'index.json')).runs.length, 1);
  assert.equal(read(path('summary.json')).overall, 100);
});

test('full recon check requires an inventory and rejects absent topics, duplicate identities and unrouted topics', t => {
  const { commit, path, check } = start(t);
  const { recon } = fullReviewCoverage(commit);
  const { operationInventory: rows, ...withoutInventory } = recon;
  for (const invalid of [
    withoutInventory,
    { ...recon, operationInventory: rows.filter(row => row.topic !== 'frontend-server') },
    { ...recon, operationInventory: [...rows, { ...rows[0], operation: 'Same identity under another label' }] },
    ...['frontend', 'web-pentest', 'unknown'].map(topic => ({ ...recon, operationInventory: [...rows, { ...rows[0], topic }] })),
  ]) {
    write(path('recon.json'), invalid);
    assert.ok(check('recon.json', 1).some(issue => issue.rule === 'OPERATION-INVENTORY'));
  }
  const invalidKey = { ...rows[0], key: 'Open Result!' };
  write(path('recon.json'), { ...recon, operationInventory: [...rows, invalidKey] });
  assert.ok(check('recon.json', 1).some(issue => issue.rule === 'SCHEMA'));
  write(path('recon.json'), recon);
  assert.deepEqual(check('recon.json'), []);
});

test('draft and final checks enforce identities, owners and source references at the pinned commit', t => {
  const { repo, commit, path, check } = start(t);
  const { recon, coverage } = fullReviewCoverage(commit);
  write(path('recon.json'), recon);
  const baseline = findingsDoc('frontend', commit, [], { operationCoverage: coverage.frontend });
  const [first, ...rest] = coverage.frontend;
  const changeFirst = changes => [{ ...first, ...changes }, ...rest];
  const untracked = 'src/worktree-only.js';
  write(join(repo, untracked), 'export default true;\n');
  const cases = [
    ['all dispositions missing', undefined, /OPERATION-COVERAGE/],
    ['one topic missing', rest, /OPERATION-COVERAGE/],
    ['duplicate', [...coverage.frontend, first], /OPERATION-COVERAGE/],
    ['foreign owner', [...coverage.frontend, coverage.database[0]], /OPERATION-COVERAGE/],
    ['unplanned key', changeFirst({ key: 'other-key' }), /OPERATION-COVERAGE/],
    ['invalid operation key', changeFirst({ key: 'Open Result!' }), /SCHEMA/],
    ['renamed operation', changeFirst({ operation: 'Another adapter' }), /OPERATION-COVERAGE/],
    ['undocumented status', changeFirst({ status: 'assumed' }), /SCHEMA/],
    ['traced without evidence', changeFirst({ evidence: undefined }), /OPERATION-COVERAGE|SCHEMA/],
    ['inapplicable without evidence', changeFirst({ status: 'inapplicable', evidence: [] }), /OPERATION-COVERAGE|SCHEMA/],
    ['skipped without reason', changeFirst({ status: 'skipped', note: ' ', evidence: undefined }), /SCHEMA/],
    ['untracked file', changeFirst({ evidence: [{ path: untracked, line: 1 }] }), /EVIDENCE-MISSING/],
    ['line out of range', changeFirst({ evidence: [{ path: 'src/app.js', line: 10, endLine: 11 }] }), /EVIDENCE-LINE/],
    ['reversed range', changeFirst({ evidence: [{ path: 'src/app.js', line: 2, endLine: 1 }] }), /EVIDENCE-LINE/],
    ['invalid optional evidence on a gap', changeFirst({ status: 'skipped', evidence: [{ path: '../untracked', line: 1 }] }), /EVIDENCE-PATH/],
  ];
  for (const file of ['drafts/frontend.draft.json', 'frontend.findings.json']) {
    write(path(file), baseline);
    assert.deepEqual(check(file), []);
    for (const [description, rows, expectedRule] of cases) {
      write(path(file), { ...baseline, operationCoverage: rows });
      assert.ok(check(file, 1).some(issue => expectedRule.test(issue.rule)), description);
    }
    write(path(file), findingsDoc('database', commit, [], { operationCoverage: coverage.database }));
    assert.ok(check(file, 1).some(issue => issue.message.includes('frontend')));
  }
});

for (const [label, scope] of [
  ['historical full', ['--profile', 'full']],
  ['quick', ['--profile', 'quick']],
  ['selective', ['--topics', 'frontend-server']],
  ['external-only', ['--topics', 'web-pentest']],
]) {
  test(label + ' review publishes without the new inventory and dispositions', t => {
    const { commit, cli, run, path } = start(t, ...scope);
    if (label === 'historical full') {
      const metadata = read(path('run.json'));
      write(path('run.json'), { ...metadata, toolVersion: '2.2.0' });
    }
    for (const id of run.reviewSections) write(path(id + '.findings.json'), findingsDoc(id, commit, []));
    cli(['finish', run.runDir]);
    assert.equal(read(path('summary.json')).overall, label === 'external-only' ? null : 100);
  });
}
