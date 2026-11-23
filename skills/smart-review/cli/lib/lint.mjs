// START_MODULE_CONTRACT
//   PURPOSE: Machine verification of a review run: reject results whose structure, evidence, commit, score, or rubric coverage do not check out.
//   SCOPE: Read-only checks over a run directory and the reviewed repository's git objects. Never edits results.
//   DEPENDS: M-SECTION-RUBRICS
//   LINKS: M-SECTION-CLI, V-M-SECTION-CLI
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   lintRun - return { errors, warnings } for a run directory
//   checkReportOperations - reconcile source operation dispositions against the scoped recon inventory
//   checkFile - check one recon, draft, or findings document on its own
//   readExternalAssessment - import a bounded, local metadata document
//   checkRunMetadata - verify the manifest, selection and external record provenance
//   findSecrets - secret-shaped substrings in a text
//   RULES - rule identifiers and their one-line meaning
// END_MODULE_MAP
import { closeSync, constants, existsSync, fstatSync, openSync, readFileSync, readSync, realpathSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { CliError, commitExists, git, isSafeRelPath, lineCountAtCommit, readJson, skillRoot } from './util.mjs';
import { validate } from './validate.mjs';
import { computeScore } from './score.mjs';
import { loadRubric, reviewCatalog, TOPICS } from './rubrics.mjs';
import { loadRun, validAttemptPath, WEB_ASSESSMENT_TOPIC } from './run.mjs';

export const RULES = {
  SCHEMA: 'document does not match its JSON Schema',
  'RUN-COMMIT': 'run commit does not exist in the reviewed repository',
  'RUN-SCOPE': 'reviewed, carried, stale, or requested topics disagree with the run scope',
  'CARRIED-SOURCE': 'carried findings differ from their original reviewed attempt or its metadata',
  'EXTERNAL-SOURCE': 'external metadata must identify its original attempt at this commit',
  'OPERATION-INVENTORY': 'recon must map distinct operations under the internal catalogue topics in scope',
  'OPERATION-COVERAGE': 'each mapped operation needs exactly one disposition from the owning section',
  'SECTION-MISSING': 'a section listed in run.json has no findings document',
  'SECTION-UNKNOWN': 'findings document for a section that is not in run.json or has no rubric',
  'COMMIT-MISMATCH': 'findings commit differs from the run commit',
  'RUBRIC-VERSION': 'rubric version differs from the shipped rubric or from run.json',
  'CRITERIA-COVERAGE': 'a rubric criterion is missing, duplicated, or unknown',
  'CRITERIA-SCORE': 'criterion status and score are inconsistent',
  'EVIDENCE-PATH': 'evidence path is absolute or leaves the repository',
  'EVIDENCE-MISSING': 'evidence file does not exist on the reviewed commit',
  'EVIDENCE-LINE': 'evidence line is outside the file on the reviewed commit',
  'FINDING-DUP': 'finding id or key is repeated',
  'SCORE-MISSING': 'score was not computed by the CLI',
  'SCORE-MISMATCH': 'stored score differs from the recomputed score',
  'LIMITS-EMPTY': 'limits list is empty',
  'CHECKED-EMPTY': 'checked list is empty',
  SECRET: 'output contains a secret-shaped string that must be masked',
  'PREVIOUS-UNACCOUNTED': 'a finding of the previous run is neither still present nor explained',
  'PREVIOUS-UNKNOWN': 'previous[] names a key the previous run did not have',
  'LOW-CONFIDENCE-SEVERE': 'high or critical finding with low confidence is not scored; confirm it or move it to unconfirmed',
  'CROSS-SECTION-DUP': 'two sections report a finding at the same evidence line; keep it in the section that owns the topic',
  'DIRTY-TREE': 'the working tree had uncommitted changes when the run was opened',
  'HEAD-MOVED': 'repository HEAD is no longer the reviewed commit',
};

const SECRET_PATTERNS = [
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g],
  ['github-pat', /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g],
  ['api-key', /\bsk-[A-Za-z0-9_-]{24,}\b/g],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['private-key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ['jwt', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g],
];

export function findSecrets(text) {
  const hits = [];
  for (const [kind, re] of SECRET_PATTERNS) {
    for (const m of text.matchAll(re)) hits.push({ kind, sample: `${m[0].slice(0, 6)}…` });
  }
  return hits;
}

function checkEvidence(list, where, repo, commit, add) {
  for (const [i, e] of (list || []).entries()) {
    const at = `${where}.evidence[${i}]`;
    if (!isSafeRelPath(e.path)) {
      add('EVIDENCE-PATH', `${at}: "${e.path}"`);
      continue;
    }
    const last = e.endLine ?? e.line;
    if (last < e.line) {
      add('EVIDENCE-LINE', `${at}: endLine precedes line`);
      continue;
    }
    // Standalone report rendering can check the range shape without a repository.
    if (!repo) continue;
    const lines = lineCountAtCommit(repo, commit, e.path);
    if (lines === null) {
      add('EVIDENCE-MISSING', `${at}: ${e.path} is not a file at ${commit.slice(0, 12)}`);
      continue;
    }
    if (last > lines) {
      add('EVIDENCE-LINE', `${at}: ${e.path}:${e.line}${e.endLine ? `-${e.endLine}` : ''} but the file has ${lines} line(s)`);
    }
  }
}

const operationOwners = new Map(reviewCatalog().filter(choice => choice.owner)
  .map(choice => [choice.id, choice.owner]));

function requiresOperationInventory(run) {
  if (run?.profile !== 'full') return false;
  const version = /^(\d+)\.(\d+)\.(\d+)$/.exec(run.toolVersion);
  // Only an identifiable historic release qualifies for the legacy exception.
  return !version || Number(version[1]) > 2 || (Number(version[1]) === 2 && Number(version[2]) >= 3);
}

function readRecon(dir) {
  const path = join(dir, 'recon.json');
  return existsSync(path) ? readJson(path) : undefined;
}

function operationId(row) {
  return JSON.stringify([row.topic, row.key]);
}

function checkInventory(recon, run, add) {
  const expected = new Map();
  const full = requiresOperationInventory(run);
  if (recon !== undefined) {
    const schema = readJson(join(skillRoot, 'schemas/recon.schema.json'));
    const problems = validate(recon, schema);
    for (const p of problems) add('SCHEMA', `recon.json ${p.path}: ${p.message}`);
    if (problems.length) return expected;
  }
  if (!recon?.operationInventory) {
    if (full) add('OPERATION-INVENTORY', 'full reviews require recon.json with operationInventory');
    return expected;
  }
  const topics = new Set();
  const reviewed = run?.reviewSections ?? run?.sections;
  for (const row of recon.operationInventory) {
    const owner = operationOwners.get(row.topic);
    if (!owner || (run && !(reviewed?.includes(owner) && run.sections?.includes(owner)))) {
      add('OPERATION-INVENTORY', `${row.topic}: expected an internal topic owned by a reviewed section`);
      continue;
    }
    const id = operationId(row);
    if (expected.has(id)) add('OPERATION-INVENTORY', `${row.topic}/${row.key}: duplicate inventory item`);
    expected.set(id, row);
    topics.add(row.topic);
  }
  if (full) {
    for (const topic of operationOwners.keys()) {
      if (!topics.has(topic)) add('OPERATION-INVENTORY', `${topic}: no operation, absence or gap mapped in recon.json`);
    }
  }
  return expected;
}

// Selective attempts copy carried dispositions byte-for-byte from their original
// review; only freshly reviewed sections use the current attempt's inventory.
function expectedForSection(inventory, run, section) {
  if (!requiresOperationInventory(run) && Object.hasOwn(run?.carried || {}, section)) return null;
  return inventory;
}

function checkDispositions(doc, section, expected, evidenceRepo, commit, add) {
  const covered = new Set();
  for (const [i, row] of (doc.operationCoverage || []).entries()) {
    const id = operationId(row);
    const name = `${row.topic}/${row.key}`;
    if (covered.has(id)) add('OPERATION-COVERAGE', `${name}: duplicate disposition`);
    covered.add(id);
    if (operationOwners.get(row.topic) !== section) add('OPERATION-COVERAGE', `${name}: topic does not belong to ${section}`);
    if (expected && expected.get(id)?.operation !== row.operation) {
      add('OPERATION-COVERAGE', `${name}: topic, key and operation must match recon.json`);
    }
    if (row.status !== 'skipped' && !row.evidence?.length) {
      add('OPERATION-COVERAGE', `${name}: ${row.status} requires pinned evidence`);
    }
    checkEvidence(row.evidence, `operationCoverage[${i}] ${name}`, evidenceRepo, commit, add);
  }
  for (const [id, row] of expected || []) {
    if (operationOwners.get(row.topic) === section && !covered.has(id)) {
      add('OPERATION-COVERAGE', `${row.topic}/${row.key}: missing disposition`);
    }
  }
}

function loadRunInventory(dir, run, add) {
  const recon = readRecon(dir);
  const expected = checkInventory(recon, run, add);
  if (typeof recon?.commit === 'string' && recon.commit !== run.repo?.commit) {
    add('COMMIT-MISMATCH', `recon.json is for ${recon.commit.slice(0, 12)}`);
  }
  return expected;
}

// START_CONTRACT: checkReportOperations
//   PURPOSE: Reconcile the operation inventory and dispositions before rendering a saved run.
//   INPUTS: { dir, run, docs }, add(rule, message, section?) - run directory, manifest, loaded documents and issue sink.
//   OUTPUTS: Emits structural issues through add. Publication verifies evidence against Git in lintRun.
//   SIDE_EFFECTS: reads recon, the shipped disposition schema and the original carried findings.
// END_CONTRACT: checkReportOperations
export function checkReportOperations({ dir, run, docs }, add) {
  checkCarriedSources({ dir, run, docs }, add);
  const expected = loadRunInventory(dir, run, add);
  const schema = readJson(join(skillRoot, 'schemas/findings.schema.json'));
  for (const [id, { doc }] of Object.entries(docs)) {
    if (doc.operationCoverage !== undefined) {
      const problems = validate(doc.operationCoverage, schema.properties.operationCoverage, schema, '$.operationCoverage');
      for (const p of problems) add('SCHEMA', `${p.path}: ${p.message}`, id);
      if (problems.length) continue;
      if (doc.commit !== run.repo?.commit) add('COMMIT-MISMATCH', 'operation coverage is for another commit', id);
    }
    checkDispositions(doc, id, expectedForSection(expected, run, id), null, run.repo?.commit,
      (rule, message) => add(rule, message, id));
  }
}

function isCalendarDate(value) {
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateFindings(doc, schema) {
  const violations = validate(doc, schema);
  if (violations.length) return violations;
  // The bundled schema validator supports enum but does not implement uniqueItems.
  for (const [i, finding] of doc.findings.entries()) {
    const topics = finding.topics;
    if (topics && new Set(topics).size !== topics.length) {
      violations.push({ path: `$.findings[${i}].topics`, message: 'topic IDs must be unique' });
    }
  }
  for (const [i, item] of doc.checked.entries()) {
    if (item.asOf !== undefined && item.asOf !== 'unknown' && !isCalendarDate(item.asOf)) {
      violations.push({ path: `$.checked[${i}].asOf`, message: 'must be a calendar date or unknown' });
    }
  }
  return violations;
}

function checkAttemptScope(run, add) {
  const included = new Set(run.sections);
  const inspected = new Set(run.reviewSections);
  const assigned = [...run.reviewSections, ...Object.keys(run.carried || {})];
  if (included.size !== run.sections.length || new Set(assigned).size !== assigned.length ||
      assigned.length !== included.size || assigned.some(id => !included.has(id))) {
    add('RUN-SCOPE', 'each included section must appear exactly once in reviewSections or carried');
  }
  for (const topic of run.topics || []) {
    if (topic === WEB_ASSESSMENT_TOPIC) continue;
    if (!Object.hasOwn(TOPICS, topic) || !inspected.has(TOPICS[topic])) {
      add('RUN-SCOPE', `topic "${topic}" must belong to a reviewed section`);
    }
  }
  for (const id of Object.keys(run.stale || {})) {
    if (included.has(id)) add('RUN-SCOPE', `stale section "${id}" is included in sections`);
  }
}

function checkMetadata(metadata, schema, add) {
  const definition = schema.$defs.assessmentMetadata;
  if (validate(metadata, definition, schema).length ||
      Object.keys(metadata).some(key => !Object.hasOwn(definition.properties, key))) {
    add('SCHEMA', 'expected assessmentDate (YYYY-MM-DD), scope, and optional deploymentId, reference and documents');
    return;
  }
  if (!isCalendarDate(metadata.assessmentDate)) {
    add('SCHEMA', 'assessmentDate must be a calendar date');
  }
  if (metadata.documents?.length > 32) add('SCHEMA', 'at most 32 document names are allowed');
  if (findSecrets(JSON.stringify(metadata)).length) add('SECRET', 'external metadata contains a secret-shaped value');
}

function readLocalMetadata(path) {
  if (/^(?:[a-z][a-z0-9+.-]*:\/\/|[/\\]{2})/i.test(path)) throw new CliError('--external-assessment needs a local file');
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > 65536) throw new Error();
    const bytes = Buffer.alloc(stat.size);
    if (readSync(fd, bytes) !== bytes.length) throw new Error();
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new CliError('--external-assessment needs a readable local JSON file of at most 64 KiB');
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export function readExternalAssessment(path) {
  const metadata = readLocalMetadata(path);
  checkMetadata(metadata, readJson(join(skillRoot, 'schemas/run.schema.json')), (_, message) => { throw new CliError(message); });
  return metadata;
}

// Paths below a canonical output root must identify the recorded artifact itself.
function directPath(...parts) {
  const path = join(...parts);
  if (realpathSync(path) !== path) throw new Error(`artifact path redirects: ${path}`);
  return path;
}

export function checkRunMetadata({ dir, run }, add) {
  const schema = readJson(join(skillRoot, 'schemas/run.schema.json'));
  const violations = validate(run, schema);
  for (const v of violations) {
    add('SCHEMA', v.path.startsWith('$.externalAssessments') ? 'invalid external assessment fields in run.json' : 'run.json ' + v.path + ': ' + v.message);
  }
  if (violations.length) return;
  const topic = WEB_ASSESSMENT_TOPIC;
  const selected = run.topics?.includes(topic);
  const external = run.externalAssessments?.[topic];
  if (run.reviewSections) checkAttemptScope(run, add);
  else if (run.topics || run.carried || run.stale || run.baseDir !== undefined) add('RUN-SCOPE', 'attempt scope requires reviewSections');
  if (!selected && (!run.sections.length || run.reviewSections?.length === 0)) add('RUN-SCOPE', 'empty selection');
  if (selected && (!external || run.profile !== 'custom')) add('RUN-SCOPE', 'web-pentest requires a custom selection and external status');
  if (!external) {
    if (existsSync(join(dir, 'external-assessment.json'))) add('EXTERNAL-SOURCE', 'unclaimed external metadata snapshot');
    return;
  }
  if (!run.reviewSections || !run.topics || run.sections.includes(topic) ||
      Object.keys(run.rubrics).some(id => !run.sections.includes(id)) || Object.hasOwn(run.stale || {}, topic) ||
      (run.reviewSections?.length === 0 && run.sections.length)) {
    add('RUN-SCOPE', 'external assessments must be separate from section results');
  }
  if (Object.keys(run.externalAssessments).length !== 1 ||
      Object.keys(external).some(key => !Object.hasOwn(schema.properties.externalAssessments.properties[topic].properties, key)) ||
      (external.status === 'metadata-supplied') !== Object.hasOwn(external, 'metadata')) {
    add('SCHEMA', 'external assessment fields disagree with the recorded status');
  }
  if (external.metadata) checkMetadata(external.metadata, schema, add);
  checkExternalSource(dir, run.repo.commit, selected, external, add);
}

function checkExternalSource(dir, commit, selected, external, add) {
  const origin = external.sourceAttempt;
  const outRoot = resolve(dir, '..', '..');
  if (external.recordedAtCommit !== commit || !validAttemptPath(origin, commit) ||
      Boolean(selected) !== (resolve(outRoot, origin) === dir)) {
    add('EXTERNAL-SOURCE', 'the selection, recording commit and source attempt disagree');
    return;
  }
  try {
    const root = realpathSync(outRoot);
    const sourceDir = directPath(root, origin);
    if (!selected) {
      const topic = WEB_ASSESSMENT_TOPIC;
      if (existsSync(join(dir, 'external-assessment.json'))) throw new Error();
      const index = readJson(directPath(root, 'index.json'));
      if (!index.runs.some(entry => entry.commit === commit && entry.dir === origin && entry.externalAssessments?.[topic] === external.status)) throw new Error();
      const source = readJson(directPath(sourceDir, 'run.json'));
      if (source.repo.commit !== commit || !source.topics?.includes(topic) ||
          !isDeepStrictEqual(source.externalAssessments?.[topic], external)) throw new Error();
    }
    const snapshot = join(sourceDir, 'external-assessment.json');
    if (external.status === 'metadata-supplied') {
      if (!isDeepStrictEqual(readLocalMetadata(directPath(snapshot)), external.metadata)) throw new Error();
    } else if (existsSync(snapshot)) throw new Error();
  } catch {
    add('EXTERNAL-SOURCE', 'cannot verify external record against its source attempt');
  }
}

function checkCarriedSources({ run, dir, docs }, add) {
  const carried = Object.entries(run.carried || {});
  if (!carried.length) return;
  const commit = run.repo.commit;
  const outRoot = resolve(dir, '..', '..');
  let root, attemptDir, published;
  try {
    root = realpathSync(outRoot);
    attemptDir = directPath(root, relative(outRoot, dir));
    const index = readJson(directPath(root, 'index.json'));
    published = new Set(index.runs.filter(entry => entry.commit === commit).map(entry => entry.dir));
  } catch (e) {
    add('CARRIED-SOURCE', `cannot verify published attempts: ${e.message}`);
    return;
  }
  const inventories = new Map();
  for (const [id, origin] of carried) {
    if (!validAttemptPath(origin, commit) || !published.has(origin) || !/^[a-z][a-z0-9-]*$/.test(id)) {
      add('CARRIED-SOURCE', `${id}: expected a published source attempt for this commit, got "${origin}"`);
      continue;
    }
    if (!Object.hasOwn(docs, id)) continue; // SECTION-MISSING reports the absent copy.
    const sourceDir = join(root, origin);
    try {
      const source = readJson(directPath(sourceDir, 'run.json'));
      const reviewed = source.reviewSections ?? source.sections;
      const current = docs[id];
      if (Array.isArray(current.doc.checked) && current.doc.checked.some(item => item && Object.hasOwn(item, 'asOf'))) {
        add('CARRIED-SOURCE', `${id}: external evidence requires fresh inspection`);
        continue;
      }
      if (sourceDir === attemptDir || source.repo?.commit !== commit ||
          source.scoringVersion !== run.scoringVersion || current.doc.score?.scoringVersion !== run.scoringVersion ||
          !Array.isArray(reviewed) || !reviewed.includes(id)) {
        add('CARRIED-SOURCE', `${id}: ${origin} must have reviewed this section at the same commit and scoring version`);
        continue;
      }
      const filename = `${id}.findings.json`;
      const original = readFileSync(directPath(sourceDir, filename));
      if (!original.equals(readFileSync(directPath(attemptDir, filename)))) {
        add('CARRIED-SOURCE', `${id}: findings differ from ${origin}/${id}.findings.json`);
        continue;
      }
      // A matching copy can still be incomplete if its original was edited after publication.
      const invalidOrigin = (rule, message) => { throw new Error(`${rule}: ${message}`); };
      if (!inventories.has(origin)) {
        if (existsSync(join(sourceDir, 'recon.json'))) directPath(sourceDir, 'recon.json');
        inventories.set(origin, loadRunInventory(sourceDir, source, invalidOrigin));
      }
      checkDispositions(current.doc, id, inventories.get(origin), null, commit, invalidOrigin);
    } catch (e) {
      add('CARRIED-SOURCE', `${id}: cannot verify ${origin}: ${e.message}`);
    }
  }
}

// START_CONTRACT: lintRun
//   PURPOSE: Decide whether a review run may be reported.
//   INPUTS: { runDir: string, repo: string - reviewed repository, rubricsDir?: string }
//   OUTPUTS: { errors: Issue[], warnings: Issue[] } where Issue = { rule, section, message }
//   SIDE_EFFECTS: none
// END_CONTRACT: lintRun
export function lintRun({ runDir, repo, rubricsDir }) {
  const errors = [];
  const warnings = [];
  const { dir, run, docs } = loadRun(runDir);
  const root = resolve(repo);
  const schemaDir = join(skillRoot, 'schemas');
  const mk = (section, sink = errors) => (rule, message) => sink.push({ rule, section, message });

  // START_BLOCK_LINT_RUN
  const runAdd = mk('run');
  checkRunMetadata({ dir, run }, runAdd);
  if (errors.some(e => e.rule === 'SCHEMA')) return { errors, warnings };
  const commit = run.repo && run.repo.commit;
  if (!commit || !commitExists(root, commit)) {
    runAdd('RUN-COMMIT', `${commit} not found in ${root}`);
    return { errors, warnings };
  }
  if (run.repo.dirty) mk('run', warnings)('DIRTY-TREE', 'evidence is checked against the commit, not the working tree');
  const head = git(root, ['rev-parse', 'HEAD']);
  if (head && head !== commit) mk('run', warnings)('HEAD-MOVED', `HEAD is ${head.slice(0, 12)}, the run reviewed ${commit.slice(0, 12)}`);
  for (const id of run.sections || []) if (!docs[id]) runAdd('SECTION-MISSING', `${id}.findings.json is absent`);
  if (run.reviewSections !== undefined) {
    checkCarriedSources({ run, dir, docs }, runAdd);
  }
  const expectedOperations = loadRunInventory(dir, run, runAdd);
  // END_BLOCK_LINT_RUN

  const findingsSchema = readJson(join(schemaDir, 'findings.schema.json'));
  const prevDocs = run.previous && existsSync(join(dir, '..', '..', run.previous.dir)) ? loadRun(join(dir, '..', '..', run.previous.dir)).docs : {};

  for (const [id, { doc, text }] of Object.entries(docs)) {
    const add = mk(id);
    const warn = mk(id, warnings);
    const violations = validateFindings(doc, findingsSchema);
    for (const v of violations) add('SCHEMA', `${v.path}: ${v.message}`);
    for (const s of findSecrets(text)) add('SECRET', `${s.kind} (${s.sample})`);
    if (violations.length) continue;
    // START_BLOCK_LINT_IDENTITY
    if (doc.section !== id) add('SECTION-UNKNOWN', `file is ${id}.findings.json but section is "${doc.section}"`);
    const rubric = loadRubric(id, rubricsDir);
    if (!rubric || !(run.sections || []).includes(id)) {
      add('SECTION-UNKNOWN', rubric ? 'not listed in run.json' : 'no shipped rubric');
      continue;
    }
    if (doc.commit !== commit) add('COMMIT-MISMATCH', `${doc.commit.slice(0, 12)} vs run ${commit.slice(0, 12)}`);
    if (doc.rubricVersion !== rubric.version || run.rubrics[id] !== rubric.version) {
      add('RUBRIC-VERSION', `document ${doc.rubricVersion}, run ${run.rubrics[id]}, shipped ${rubric.version}`);
    }
    checkDispositions(doc, id, expectedForSection(expectedOperations, run, id), root, commit, add);
    // END_BLOCK_LINT_IDENTITY
    // START_BLOCK_LINT_CRITERIA
    const seen = new Map();
    for (const c of doc.criteria) seen.set(c.id, (seen.get(c.id) || 0) + 1);
    const known = new Set(rubric.criteria.map((c) => c.id));
    for (const c of rubric.criteria) {
      if (!seen.has(c.id)) add('CRITERIA-COVERAGE', `criterion "${c.id}" has no status`);
      else if (seen.get(c.id) > 1) add('CRITERIA-COVERAGE', `criterion "${c.id}" appears ${seen.get(c.id)} times`);
    }
    for (const cid of seen.keys()) if (!known.has(cid)) add('CRITERIA-COVERAGE', `criterion "${cid}" is not in rubric ${id}@${rubric.version}`);
    for (const c of doc.criteria) {
      if (c.status === 'scored' && c.score === undefined) add('CRITERIA-SCORE', `"${c.id}" is scored but has no score`);
      if (c.status !== 'scored' && c.score !== undefined) add('CRITERIA-SCORE', `"${c.id}" is ${c.status} but has a score`);
    }
    // END_BLOCK_LINT_CRITERIA
    // START_BLOCK_LINT_FINDINGS
    const ids = new Set();
    const keys = new Set();
    for (const [i, f] of doc.findings.entries()) {
      if (ids.has(f.id)) add('FINDING-DUP', `id ${f.id}`);
      if (keys.has(f.key)) add('FINDING-DUP', `key ${f.key}`);
      ids.add(f.id);
      keys.add(f.key);
      checkEvidence(f.evidence, `findings[${i}] ${f.id}`, root, commit, add);
      if (f.confidence === 'low' && (f.severity === 'high' || f.severity === 'critical')) warn('LOW-CONFIDENCE-SEVERE', f.id);
    }
    for (const [i, u] of doc.unconfirmed.entries()) checkEvidence(u.evidence, `unconfirmed[${i}]`, root, commit, add);
    if (!doc.limits.length) add('LIMITS-EMPTY', 'state what was not run or not read and how it bounds the conclusion');
    if (!doc.checked.length) add('CHECKED-EMPTY', 'state what was actually traced');
    // END_BLOCK_LINT_FINDINGS
    // START_BLOCK_LINT_SCORE
    if (!doc.score) add('SCORE-MISSING', 'run "smart-review score <run-dir>"');
    else if (JSON.stringify(doc.score) !== JSON.stringify(computeScore(doc, run.accepted))) {
      add('SCORE-MISMATCH', `stored ${doc.score.value}, recomputed ${computeScore(doc, run.accepted).value}`);
    }
    // END_BLOCK_LINT_SCORE
    // START_BLOCK_LINT_PREVIOUS
    const prev = prevDocs[id] && prevDocs[id].doc;
    if (prev && Array.isArray(prev.findings)) {
      const prevKeys = new Set(prev.findings.map((f) => f.key));
      const explained = new Set((doc.previous || []).map((p) => p.key));
      for (const k of prevKeys) if (!keys.has(k) && !explained.has(k)) add('PREVIOUS-UNACCOUNTED', `"${k}" from ${run.previous.commit.slice(0, 12)}`);
      for (const k of explained) if (!prevKeys.has(k)) warn('PREVIOUS-UNKNOWN', `"${k}"`);
    }
    // END_BLOCK_LINT_PREVIOUS
  }
  // START_BLOCK_LINT_CROSS_SECTION
  const seenAt = new Map();
  for (const [id, { doc }] of Object.entries(docs)) {
    for (const f of Array.isArray(doc.findings) ? doc.findings : []) {
      const e = Array.isArray(f.evidence) && f.evidence[0];
      if (!e || typeof e.path !== 'string') continue;
      const at = `${e.path}:${e.line}`;
      const first = seenAt.get(at);
      if (first && first.section !== id) warnings.push({ rule: 'CROSS-SECTION-DUP', section: id, message: `${f.id} and ${first.section} ${first.id} both start at ${at}` });
      else if (!first) seenAt.set(at, { section: id, id: f.id });
    }
  }
  // END_BLOCK_LINT_CROSS_SECTION
  return { errors, warnings };
}

// START_CONTRACT: checkFile
//   PURPOSE: Let an agent check one document before the run is finished: recon.json, a draft, or a findings file.
//   INPUTS: { file: string, repo: string, rubricsDir?: string }
//   OUTPUTS: { kind: 'recon' | 'draft' | 'findings', errors: Issue[] } - schema, commit, evidence, and criteria coverage problems
//   SIDE_EFFECTS: none
// END_CONTRACT: checkFile
export function checkFile({ file, repo, rubricsDir }) {
  const errors = [];
  const root = resolve(repo);
  const doc = readJson(file);
  const schemaDir = join(skillRoot, 'schemas');
  const base = basename(file);
  const draft = base.endsWith('.draft.json');
  const parent = dirname(resolve(file));
  const dir = draft && basename(parent) === 'drafts' ? dirname(parent) : parent;
  const manifest = join(dir, 'run.json');
  const run = existsSync(manifest) ? readJson(manifest) : null;
  const add = (rule, message) => errors.push({ rule, section: base, message });
  if (base === 'recon.json') {
    checkInventory(doc, run, add);
    if (typeof doc?.commit === 'string') {
      if (!commitExists(root, doc.commit)) add('RUN-COMMIT', `${doc.commit} not found in ${root}`);
      else if (run && doc.commit !== run.repo?.commit) add('COMMIT-MISMATCH', `recon.json is for ${doc.commit.slice(0, 12)}`);
    }
    return { kind: 'recon', errors };
  }
  const schema = readJson(join(schemaDir, 'findings.schema.json'));
  if (draft) schema.$defs.finding.required = schema.$defs.finding.required.filter((k) => k !== 'verification');
  const violations = validateFindings(doc, schema);
  for (const v of violations) add('SCHEMA', `${v.path}: ${v.message}`);
  for (const s of findSecrets(JSON.stringify(doc))) add('SECRET', `${s.kind} (${s.sample})`);
  if (violations.length) return { kind: draft ? 'draft' : 'findings', errors };
  if (!commitExists(root, doc.commit)) {
    add('RUN-COMMIT', `${doc.commit} not found in ${root}`);
    return { kind: draft ? 'draft' : 'findings', errors };
  }
  if (run && doc.commit !== run.repo?.commit) add('COMMIT-MISMATCH', `${base} is for ${doc.commit.slice(0, 12)}`);
  const suffix = draft ? '.draft.json' : '.findings.json';
  if (run && base.endsWith(suffix) && base !== doc.section + suffix) {
    add('SECTION-UNKNOWN', `${base} declares section "${doc.section}"`);
  }
  const expected = run ? loadRunInventory(dir, run, add) : null;
  if (!draft && Object.hasOwn(run?.carried || {}, doc.section)) {
    checkCarriedSources({ dir, run, docs: { [doc.section]: { doc } } }, add);
  }
  checkDispositions(doc, doc.section, expectedForSection(expected, run, doc.section), root, run?.repo?.commit ?? doc.commit, add);
  const rubric = loadRubric(doc.section, rubricsDir);
  if (!rubric) add('SECTION-UNKNOWN', `no shipped rubric "${doc.section}"`);
  else {
    if (doc.rubricVersion !== rubric.version) add('RUBRIC-VERSION', `document ${doc.rubricVersion}, shipped ${rubric.version}`);
    const have = doc.criteria.map((c) => c.id);
    for (const c of rubric.criteria) {
      const n = have.filter((x) => x === c.id).length;
      if (n !== 1) add('CRITERIA-COVERAGE', `criterion "${c.id}" appears ${n} time(s)`);
    }
    for (const id of have) if (!rubric.criteria.some((c) => c.id === id)) add('CRITERIA-COVERAGE', `criterion "${id}" is not in rubric ${doc.section}@${rubric.version}`);
  }
  for (const c of doc.criteria) {
    if ((c.status === 'scored') !== (c.score !== undefined)) add('CRITERIA-SCORE', `"${c.id}" is ${c.status} ${c.score === undefined ? 'without' : 'with'} a score`);
  }
  const ids = new Set();
  const keys = new Set();
  for (const [i, f] of doc.findings.entries()) {
    if (ids.has(f.id)) add('FINDING-DUP', `id ${f.id}`);
    if (keys.has(f.key)) add('FINDING-DUP', `key ${f.key}`);
    ids.add(f.id);
    keys.add(f.key);
    checkEvidence(f.evidence, `findings[${i}] ${f.id}`, root, doc.commit, add);
  }
  for (const [i, u] of doc.unconfirmed.entries()) checkEvidence(u.evidence, `unconfirmed[${i}]`, root, doc.commit, add);
  if (!doc.limits.length) add('LIMITS-EMPTY', 'state what was not run or not read');
  if (!doc.checked.length) add('CHECKED-EMPTY', 'state what was actually traced');
  return { kind: draft ? 'draft' : 'findings', errors };
}
