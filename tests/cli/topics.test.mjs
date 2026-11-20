import assert from 'node:assert/strict';
import { appendFileSync, copyFileSync, renameSync, symlinkSync } from 'node:fs';
import { basename, join } from 'node:path';
import { test } from 'node:test';
import { checkFile, lintRun } from '../../skills/smart-review/cli/lib/lint.mjs';
import { TOPICS } from '../../skills/smart-review/cli/lib/rubrics.mjs';
import { startRun } from '../../skills/smart-review/cli/lib/run.mjs';
import { computeScore } from '../../skills/smart-review/cli/lib/score.mjs';
import { main } from '../../skills/smart-review/cli/smart-review.mjs';
import { finding, findingsDoc, makeRepo, read, rubric, SKILL, write } from './helpers.mjs';

function fixture(t) {
  const repo = makeRepo();
  t.after(repo.cleanup);
  return repo;
}

function scoredDoc(section, commit, findings) {
  const doc = findingsDoc(section, commit, findings);
  doc.score = computeScore(doc);
  return doc;
}

test('selectable topic IDs are criteria in their owner rubrics and match the findings schema', () => {
  assert.deepEqual(TOPICS, {
    secrets: 'security', authn: 'security', 'dead-code': 'hygiene',
    vulnerabilities: 'dependencies', freshness: 'dependencies',
  });
  for (const [topic, owner] of Object.entries(TOPICS)) {
    assert.ok(rubric(owner).criteria.some(c => c.id === topic), `${owner}/${topic}`);
  }
  const schema = read(join(SKILL, 'schemas/findings.schema.json'));
  const topics = schema.$defs.finding.properties.topics;
  assert.deepEqual(topics.items.enum.toSorted(), Object.keys(TOPICS).sort());
  assert.equal(topics.uniqueItems, true);
});

test('draft check, findings check, and run lint agree on optional cross-section topic tags', t => {
  const { repo, commit } = fixture(t);
  const { runDir } = startRun({ repo, sections: ['security'] });
  const file = join(runDir, 'security.findings.json');
  const draft = join(runDir, 'drafts/security.draft.json');
  const baseline = scoredDoc('security', commit, [finding(1)]);
  for (const [tags, valid] of [
    [undefined, true], [[], true], [['secrets', 'dead-code'], true],
    [['secrets', 'authn', 'secrets'], false], [['unknown'], false], [['constructor'], false],
    ['secrets', false], [[1], false], [null, false],
  ]) {
    const doc = structuredClone(baseline);
    if (tags !== undefined) doc.findings[0].topics = tags;
    if (valid) assert.deepEqual(computeScore(doc), baseline.score, 'topic tags add no deductions');
    write(file, doc);
    delete doc.findings[0].verification;
    write(draft, doc);
    for (const { errors } of [checkFile({ file: draft, repo }), checkFile({ file, repo }), lintRun({ runDir, repo })]) {
      if (valid) assert.deepEqual(errors, []);
      else {
        assert.deepEqual(errors.map(e => e.rule), ['SCHEMA']);
        assert.match(errors[0].message, /findings\[0\]\.topics/);
      }
    }
  }
});

test('new attempt scope partitions the report and reviews every requested topic owner', t => {
  const { repo, commit } = fixture(t);
  const { runDir, run } = startRun({ repo, topics: ['secrets'], sections: ['tests'] });
  for (const id of run.sections) write(join(runDir, `${id}.findings.json`), scoredDoc(id, commit, []));
  const metadata = join(runDir, 'run.json');
  for (const changes of [
    { reviewSections: ['security'] },
    { reviewSections: ['security', 'tests', 'hygiene'] },
    { reviewSections: ['security', 'tests', 'security'] },
    { sections: ['security', 'tests', 'security'] },
    { topics: ['freshness'] },
    { topics: ['invented'] },
    { stale: { tests: 'version' } },
  ]) {
    write(metadata, { ...run, ...changes });
    assert.deepEqual(lintRun({ runDir, repo }).errors.map(e => e.rule), ['RUN-SCOPE'], JSON.stringify(changes));
  }
  for (const changes of [
    { reviewSections: 'security' }, { topics: [42] },
    { carried: { hygiene: 123 } }, { stale: ['dependencies'] },
  ]) {
    write(metadata, { ...run, ...changes });
    assert.deepEqual(lintRun({ runDir, repo }).errors.map(e => e.rule), ['SCHEMA'], JSON.stringify(changes));
  }
  const legacy = { ...run };
  for (const field of ['reviewSections', 'topics', 'carried', 'stale', 'baseDir']) delete legacy[field];
  write(metadata, legacy);
  assert.deepEqual(lintRun({ runDir, repo }).errors, []);
});

function mixedRerun(t) {
  const { repo, commit } = fixture(t);
  const first = startRun({ repo, profile: 'full' });
  for (const id of first.run.sections) write(join(first.runDir, `${id}.findings.json`), findingsDoc(id, commit, []));
  const output = [];
  const print = line => output.push(line);
  assert.equal(main(['finish', first.runDir, '--repo', repo], print), 0, output.join('\n'));
  output.length = 0;
  assert.equal(main(['start', '--repo', repo, '--topics', 'secrets,authn,secrets', '--sections', 'tests'], print), 0);
  const attempt = JSON.parse(output.join('\n'));
  const { runDir } = attempt;
  for (const id of attempt.reviewSections) write(join(runDir, `${id}.findings.json`), scoredDoc(id, commit, []));
  return { repo, commit, first, attempt, runDir };
}

test('a mixed rerun carries byte-identical findings from the original commit and scoring version', t => {
  const { repo, commit, first, attempt, runDir } = mixedRerun(t);
  assert.deepEqual(attempt.topics, ['secrets', 'authn']);
  assert.deepEqual(attempt.reviewSections.toSorted(), ['security', 'tests']);
  assert.deepEqual(attempt.sections.toSorted(), first.run.sections.toSorted());
  assert.deepEqual(Object.keys(attempt.carried).sort(), ['ai-readiness', 'dependencies', 'hygiene']);
  const lint = () => lintRun({ runDir, repo }).errors;
  assert.deepEqual(lint(), []);

  const metadata = join(runDir, 'run.json');
  const run = read(metadata);
  write(metadata, { ...run, topics: ['freshness'] }); // Its owner was carried.
  assert.deepEqual(lint().map(e => e.rule), ['RUN-SCOPE']);
  write(metadata, { ...run, reviewSections: [...run.reviewSections, 'hygiene'] });
  assert.deepEqual(lint().map(e => e.rule), ['RUN-SCOPE']);
  for (const origin of ['../outside', 'runs/000000000000-source', `runs/${basename(runDir)}`, `runs/${commit.slice(0, 12)}-missing`]) {
    write(metadata, { ...run, carried: { ...run.carried, hygiene: origin } });
    assert.deepEqual(lint().map(e => e.rule), ['CARRIED-SOURCE'], origin);
  }
  write(metadata, run);

  const sourceMetadata = join(first.runDir, 'run.json');
  for (const changes of [{ repo: { ...first.run.repo, commit: 'a'.repeat(40) } }, { scoringVersion: 'old' }]) {
    write(sourceMetadata, { ...first.run, ...changes });
    assert.deepEqual(lint().map(e => e.rule), Object.keys(run.carried).map(() => 'CARRIED-SOURCE'));
  }
  write(sourceMetadata, first.run);
  appendFileSync(join(runDir, 'hygiene.findings.json'), '\n');
  assert.deepEqual(lint().map(e => e.rule), ['CARRIED-SOURCE']);
});

test('carried sources must be published for the commit and read directly from the recorded path', t => {
  const { repo, commit, first, runDir } = mixedRerun(t);
  const metadata = join(runDir, 'run.json');
  const run = read(metadata);
  const lint = () => lintRun({ runDir, repo }).errors.map(e => e.rule);
  const original = join(first.runDir, 'hygiene.findings.json');
  const pending = startRun({ repo, sections: ['hygiene'] });
  copyFileSync(original, join(pending.runDir, 'hygiene.findings.json'));
  write(metadata, { ...run, carried: { ...run.carried, hygiene: `runs/${basename(pending.runDir)}` } });
  assert.deepEqual(lint(), ['CARRIED-SOURCE']);
  write(metadata, run);

  const indexPath = join(first.outRoot, 'index.json');
  const index = read(indexPath);
  write(indexPath, { ...index, runs: index.runs.map(entry => ({ ...entry, commit: 'f'.repeat(40) })) });
  assert.deepEqual(lint(), Object.keys(run.carried).map(() => 'CARRIED-SOURCE'));
  write(indexPath, index);
  assert.deepEqual(lint(), []);

  const redirected = join(repo, 'outside-output.json');
  renameSync(original, redirected);
  symlinkSync(redirected, original);
  assert.equal(read(original).commit, commit);
  assert.deepEqual(lint(), ['CARRIED-SOURCE']);
});
