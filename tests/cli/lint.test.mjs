import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, rmSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { main } from '../../skills/smart-audit/cli/smart-audit.mjs';
import { lintRun, checkFile, findSecrets } from '../../skills/smart-audit/cli/lib/lint.mjs';
import { finding, findingsDoc, makeRepo, write, read, commitAll } from './helpers.mjs';

let fx;
const quiet = () => {};

// A valid two-audit run in a throwaway repository; each test mutates a copy.
before(() => {
  fx = makeRepo();
  const lines = [];
  assert.equal(main(['start', '--repo', fx.repo, '--audits', 'security,tests'], (l) => lines.push(l)), 0);
  fx.runDir = JSON.parse(lines.join('\n')).runDir;
  write(join(fx.runDir, 'security.findings.json'), findingsDoc('security', fx.commit));
  write(join(fx.runDir, 'tests.findings.json'), findingsDoc('tests', fx.commit, []));
  assert.equal(main(['score', fx.runDir], quiet), 0);
});
after(() => fx.cleanup());

function variant(mutate) {
  const dir = `${fx.runDir}-v${Math.random().toString(36).slice(2, 8)}`;
  cpSync(fx.runDir, dir, { recursive: true });
  const file = join(dir, 'security.findings.json');
  const doc = read(file);
  const rescore = mutate(doc, dir) !== 'keep-score';
  write(file, doc);
  if (rescore && doc.score) main(['score', dir], quiet);
  const res = lintRun({ runDir: dir, repo: fx.repo });
  rmSync(dir, { recursive: true, force: true });
  return res.errors.map((e) => e.rule);
}

test('a valid run passes with no errors', () => {
  const res = lintRun({ runDir: fx.runDir, repo: fx.repo });
  assert.deepEqual(res.errors, []);
  assert.equal(main(['lint', fx.runDir, '--repo', fx.repo], quiet), 0);
});

test('evidence file absent on the audited commit is rejected', () => {
  assert.deepEqual(variant((d) => { d.findings[0].evidence[0].path = 'src/missing.js'; }), ['EVIDENCE-MISSING']);
});

test('evidence line beyond the end of the file is rejected', () => {
  assert.deepEqual(variant((d) => { d.findings[0].evidence[0].line = 11; }), ['EVIDENCE-LINE']);
  assert.deepEqual(variant((d) => { d.findings[0].evidence[0] = { path: 'src/empty.js', line: 1 }; }), ['EVIDENCE-LINE']);
  assert.deepEqual(variant((d) => { d.findings[0].evidence[0] = { path: 'src/app.js', line: 5, endLine: 2 }; }), ['EVIDENCE-LINE']);
});

test('evidence that only exists in the working tree is rejected', () => {
  write(join(fx.repo, 'src', 'uncommitted.js'), 'x\n');
  try {
    assert.deepEqual(variant((d) => { d.findings[0].evidence[0] = { path: 'src/uncommitted.js', line: 1 }; }), ['EVIDENCE-MISSING']);
  } finally {
    unlinkSync(join(fx.repo, 'src', 'uncommitted.js'));
  }
});

test('evidence path leaving the repository is rejected', () => {
  assert.deepEqual(variant((d) => { d.findings[0].evidence[0].path = '../outside.js'; }), ['EVIDENCE-PATH']);
  assert.deepEqual(variant((d) => { d.findings[0].evidence[0].path = '/etc/passwd'; }), ['EVIDENCE-PATH']);
});

test('a hand-edited score is rejected', () => {
  assert.deepEqual(variant((d) => { d.score.value = 100; return 'keep-score'; }), ['SCORE-MISMATCH']);
  assert.deepEqual(variant((d) => { d.findings.push(finding(2, { severity: 'high' })); return 'keep-score'; }), ['SCORE-MISMATCH']);
});

test('a missing score is rejected', () => {
  assert.deepEqual(variant((d) => { delete d.score; }), ['SCORE-MISSING']);
});

test('findings for a foreign commit are rejected', () => {
  assert.deepEqual(variant((d) => { d.commit = 'b'.repeat(40); }), ['COMMIT-MISMATCH']);
});

test('a run whose commit is not in the repository is rejected', () => {
  assert.deepEqual(variant((d, dir) => { const r = read(join(dir, 'run.json')); r.repo.commit = 'c'.repeat(40); write(join(dir, 'run.json'), r); }), ['RUN-COMMIT']);
});

test('a missing, duplicated, or unknown criterion is rejected', () => {
  assert.deepEqual(variant((d) => { d.criteria.pop(); }), ['CRITERIA-COVERAGE']);
  assert.deepEqual(variant((d) => { d.criteria.push(d.criteria[1]); }), ['CRITERIA-COVERAGE']);
  assert.deepEqual(variant((d) => { d.criteria.push({ id: 'invented', status: 'na', note: 'x' }); }), ['CRITERIA-COVERAGE']);
});

test('criterion status and score must agree', () => {
  assert.deepEqual(variant((d) => { delete d.criteria[1].score; }), ['CRITERIA-SCORE']);
  assert.deepEqual(variant((d) => { d.criteria[0].score = 3; }), ['CRITERIA-SCORE']);
});

test('empty limits and empty checked sections are rejected', () => {
  assert.deepEqual(variant((d) => { d.limits = []; }), ['LIMITS-EMPTY']);
  assert.deepEqual(variant((d) => { d.checked = []; }), ['CHECKED-EMPTY']);
});

test('a finding without a verification pass or without evidence is rejected', () => {
  assert.deepEqual(variant((d) => { delete d.findings[0].verification; }), ['SCHEMA']);
  assert.deepEqual(variant((d) => { d.findings[0].evidence = []; }), ['SCHEMA']);
  assert.deepEqual(variant((d) => { d.findings[0].verify = []; }), ['SCHEMA']);
});

test('a wrong rubric version is rejected', () => {
  assert.deepEqual(variant((d) => { d.rubricVersion = '9.9.9'; }), ['RUBRIC-VERSION']);
});

test('repeated finding ids and keys are rejected', () => {
  assert.deepEqual(variant((d) => { d.findings.push(finding(1, { severity: 'low' })); }), ['FINDING-DUP', 'FINDING-DUP']);
});

test('a secret-shaped string anywhere in the output is rejected', () => {
  const token = ['ghp', 'A'.repeat(36)].join('_');
  assert.deepEqual(variant((d) => { d.findings[0].what = `token ${token} is committed`; }), ['SECRET']);
  assert.equal(findSecrets(`key ${['AKIA', 'ABCDEFGHIJKLMNOP'].join('')}`).length, 1);
  assert.equal(findSecrets('masked value ghp_****').length, 0);
});

test('an audit listed in the run without a findings file is rejected', () => {
  assert.deepEqual(variant((d, dir) => { unlinkSync(join(dir, 'tests.findings.json')); }), ['AUDIT-MISSING']);
});

test('low-confidence severe findings only warn', () => {
  const dir = `${fx.runDir}-warn`;
  cpSync(fx.runDir, dir, { recursive: true });
  const file = join(dir, 'security.findings.json');
  const doc = read(file);
  doc.findings.push(finding(2, { severity: 'high', confidence: 'low' }));
  write(file, doc);
  main(['score', dir], quiet);
  const res = lintRun({ runDir: dir, repo: fx.repo });
  rmSync(dir, { recursive: true, force: true });
  assert.deepEqual(res.errors, []);
  assert.deepEqual(res.warnings.map((w) => w.rule), ['LOW-CONFIDENCE-SEVERE']);
});

test('lint command exits 1 on errors and 2 on bad input', () => {
  const dir = `${fx.runDir}-exit`;
  cpSync(fx.runDir, dir, { recursive: true });
  const file = join(dir, 'security.findings.json');
  const doc = read(file);
  doc.limits = [];
  write(file, doc);
  assert.equal(main(['lint', dir, '--repo', fx.repo], quiet), 1);
  rmSync(dir, { recursive: true, force: true });
  assert.equal(main(['lint', join(fx.repo, 'nope'), '--repo', fx.repo], quiet), 2);
  assert.equal(main(['lint', fx.runDir], quiet), 2);
});

test('accepted risks are read from the audited commit, not the working tree', () => {
  const r = makeRepo({ '.smart-audit/accepted.json': JSON.stringify({ accepted: [{ audit: 'security', key: 'sample-finding-1', reason: 'tracked in the backlog' }, { audit: 'security', key: 'no-reason', reason: ' ' }] }) });
  try {
    write(join(r.repo, '.smart-audit', 'accepted.json'), JSON.stringify({ accepted: [] }));
    const lines = [];
    main(['start', '--repo', r.repo, '--audits', 'security', '--out', join(r.repo, 'out')], (l) => lines.push(l));
    const run = JSON.parse(lines.join('\n'));
    assert.deepEqual(run.accepted, [{ audit: 'security', key: 'sample-finding-1', reason: 'tracked in the backlog' }]);
    assert.equal(run.repo.dirty, true);
    write(join(run.runDir, 'security.findings.json'), findingsDoc('security', r.commit));
    main(['score', run.runDir], quiet);
    assert.equal(read(join(run.runDir, 'security.findings.json')).score.value, 100);
    const res = lintRun({ runDir: run.runDir, repo: r.repo });
    assert.deepEqual(res.errors, []);
    assert.deepEqual(res.warnings.map((w) => w.rule), ['DIRTY-TREE']);
  } finally {
    r.cleanup();
  }
});

test('a previous finding must be still present or explained', () => {
  const r = makeRepo();
  try {
    const out = join(r.repo, 'out');
    const start = () => { const l = []; main(['start', '--repo', r.repo, '--audits', 'security', '--out', out], (x) => l.push(x)); return JSON.parse(l.join('\n')); };
    const first = start();
    write(join(first.runDir, 'security.findings.json'), findingsDoc('security', r.commit, [finding(1), finding(2)]));
    assert.equal(main(['finish', first.runDir, '--repo', r.repo], quiet), 0);
    write(join(r.repo, 'src', 'app.js'), 'export const fixed = true;\n');
    const second = commitAll(r.repo, 'fix');
    const run2 = start();
    assert.equal(run2.previous.commit, r.commit);
    const file = join(run2.runDir, 'security.findings.json');
    write(file, findingsDoc('security', second, [finding(1, { evidence: [{ path: 'src/app.js', line: 1 }] })]));
    main(['score', run2.runDir], quiet);
    assert.deepEqual(lintRun({ runDir: run2.runDir, repo: r.repo }).errors.map((e) => e.rule), ['PREVIOUS-UNACCOUNTED']);
    const doc = read(file);
    doc.previous = [{ key: 'sample-finding-2', status: 'fixed', note: 'The unchecked value was removed.' }];
    write(file, doc);
    assert.equal(main(['finish', run2.runDir, '--repo', r.repo], quiet), 0);
    const diff = read(join(run2.runDir, 'diff.json'));
    assert.deepEqual(diff.audits.security.items.map((i) => [i.key, i.status]), [['sample-finding-1', 'still-present'], ['sample-finding-2', 'fixed']]);
    assert.equal(diff.audits.security.delta, 6);
    assert.equal(read(join(out, 'index.json')).runs.length, 2);
  } finally {
    r.cleanup();
  }
});

test('check validates a single draft, findings file, or recon map', () => {
  const draftPath = join(fx.runDir, 'drafts', 'security.draft.json');
  const draft = findingsDoc('security', fx.commit);
  delete draft.findings[0].verification;
  write(draftPath, draft);
  assert.deepEqual(checkFile({ file: draftPath, repo: fx.repo }), { kind: 'draft', errors: [] });
  assert.equal(main(['check', draftPath, '--repo', fx.repo], quiet), 0);
  draft.findings[0].evidence[0].line = 99;
  draft.criteria.pop();
  write(draftPath, draft);
  assert.deepEqual(checkFile({ file: draftPath, repo: fx.repo }).errors.map((e) => e.rule), ['CRITERIA-COVERAGE', 'EVIDENCE-LINE']);
  assert.equal(main(['check', draftPath, '--repo', fx.repo], quiet), 1);
  const finalPath = join(fx.runDir, 'security.findings.json');
  assert.equal(checkFile({ file: finalPath, repo: fx.repo }).kind, 'findings');
  const unverified = `${fx.runDir}-unverified.findings.json`;
  write(unverified, findingsDoc('security', fx.commit, [(() => { const f = finding(1); delete f.verification; return f; })()]));
  assert.deepEqual(checkFile({ file: unverified, repo: fx.repo }).errors.map((e) => e.rule), ['SCHEMA']);
  rmSync(unverified);
  const reconPath = join(fx.runDir, 'recon.json');
  const recon = { schemaVersion: 1, commit: fx.commit, summary: 'Demo.', languages: [{ name: 'JavaScript', files: 2 }], manifests: [], entryPoints: [], surfaces: [], tests: { roots: [], commands: [] }, ci: [], docs: [{ path: 'README.md' }], agentFiles: [], excluded: [], tools: [], limits: [] };
  write(reconPath, recon);
  assert.deepEqual(checkFile({ file: reconPath, repo: fx.repo }), { kind: 'recon', errors: [] });
  assert.deepEqual(lintRun({ runDir: fx.runDir, repo: fx.repo }).errors, []);
  write(reconPath, { ...recon, surprise: true, commit: 'd'.repeat(40) });
  assert.deepEqual(checkFile({ file: reconPath, repo: fx.repo }).errors.map((e) => e.rule), ['SCHEMA', 'RUN-COMMIT']);
  assert.deepEqual(lintRun({ runDir: fx.runDir, repo: fx.repo }).errors.map((e) => e.rule), ['SCHEMA', 'COMMIT-MISMATCH']);
  rmSync(reconPath);
  rmSync(join(fx.runDir, 'drafts'), { recursive: true });
});

test('the same evidence line reported by two audits only warns', () => {
  const dir = `${fx.runDir}-cross`;
  cpSync(fx.runDir, dir, { recursive: true });
  const file = join(dir, 'tests.findings.json');
  const doc = read(file);
  doc.findings = [finding(1, { key: 'same-line-other-audit', verification: { result: 'upgraded', note: 'Raised after reading the caller.' } })];
  write(file, doc);
  main(['score', dir], quiet);
  const res = lintRun({ runDir: dir, repo: fx.repo });
  rmSync(dir, { recursive: true, force: true });
  assert.deepEqual(res.errors, []);
  assert.deepEqual(res.warnings.map((w) => [w.rule, w.audit]), [['CROSS-AUDIT-DUP', 'tests']]);
});
