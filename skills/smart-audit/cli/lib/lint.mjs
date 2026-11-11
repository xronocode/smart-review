// START_MODULE_CONTRACT
//   PURPOSE: Machine verification of an audit run: reject results whose structure, evidence, commit, score, or rubric coverage do not check out.
//   SCOPE: Read-only checks over a run directory and the audited repository's git objects. Never edits results.
//   DEPENDS: M-AUDIT-RUBRICS
//   LINKS: M-AUDIT-CLI, V-M-AUDIT-CLI
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   lintRun - return { errors, warnings } for a run directory
//   checkFile - check one recon, draft, or findings document on its own
//   findSecrets - secret-shaped substrings in a text
//   RULES - rule identifiers and their one-line meaning
// END_MODULE_MAP
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { commitExists, git, isSafeRelPath, lineCountAtCommit, readJson, skillRoot } from './util.mjs';
import { validate } from './validate.mjs';
import { computeScore } from './score.mjs';
import { loadRubric } from './rubrics.mjs';
import { loadRun } from './run.mjs';

export const RULES = {
  SCHEMA: 'document does not match its JSON Schema',
  'RUN-COMMIT': 'run commit does not exist in the audited repository',
  'AUDIT-MISSING': 'an audit listed in run.json has no findings document',
  'AUDIT-UNKNOWN': 'findings document for an audit that is not in run.json or has no rubric',
  'COMMIT-MISMATCH': 'findings commit differs from the run commit',
  'RUBRIC-VERSION': 'rubric version differs from the shipped rubric or from run.json',
  'CRITERIA-COVERAGE': 'a rubric criterion is missing, duplicated, or unknown',
  'CRITERIA-SCORE': 'criterion status and score are inconsistent',
  'EVIDENCE-PATH': 'evidence path is absolute or leaves the repository',
  'EVIDENCE-MISSING': 'evidence file does not exist on the audited commit',
  'EVIDENCE-LINE': 'evidence line is outside the file on the audited commit',
  'FINDING-DUP': 'finding id or key is repeated',
  'SCORE-MISSING': 'score was not computed by the CLI',
  'SCORE-MISMATCH': 'stored score differs from the recomputed score',
  'LIMITS-EMPTY': 'limits section is empty',
  'CHECKED-EMPTY': 'checked section is empty',
  SECRET: 'output contains a secret-shaped string that must be masked',
  'PREVIOUS-UNACCOUNTED': 'a finding of the previous run is neither still present nor explained',
  'PREVIOUS-UNKNOWN': 'previous[] names a key the previous run did not have',
  'LOW-CONFIDENCE-SEVERE': 'high or critical finding with low confidence is not scored; confirm it or move it to unconfirmed',
  'DIRTY-TREE': 'the working tree had uncommitted changes when the run was opened',
  'HEAD-MOVED': 'repository HEAD is no longer the audited commit',
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
    const lines = lineCountAtCommit(repo, commit, e.path);
    if (lines === null) {
      add('EVIDENCE-MISSING', `${at}: ${e.path} is not a file at ${commit.slice(0, 12)}`);
      continue;
    }
    const last = e.endLine ?? e.line;
    if (e.line > lines || last > lines || last < e.line) {
      add('EVIDENCE-LINE', `${at}: ${e.path}:${e.line}${e.endLine ? `-${e.endLine}` : ''} but the file has ${lines} line(s)`);
    }
  }
}

// START_CONTRACT: lintRun
//   PURPOSE: Decide whether an audit run may be reported.
//   INPUTS: { runDir: string, repo: string - audited repository, rubricsDir?: string }
//   OUTPUTS: { errors: Issue[], warnings: Issue[] } where Issue = { rule, audit, message }
//   SIDE_EFFECTS: none
// END_CONTRACT: lintRun
export function lintRun({ runDir, repo, rubricsDir }) {
  const errors = [];
  const warnings = [];
  const { dir, run, docs } = loadRun(runDir);
  const root = resolve(repo);
  const schemaDir = join(skillRoot, 'schemas');
  const mk = (audit, sink = errors) => (rule, message) => sink.push({ rule, audit, message });

  // START_BLOCK_LINT_RUN
  const runAdd = mk('run');
  for (const v of validate(run, readJson(join(schemaDir, 'run.schema.json')))) runAdd('SCHEMA', `run.json ${v.path}: ${v.message}`);
  const commit = run.repo && run.repo.commit;
  if (!commit || !commitExists(root, commit)) {
    runAdd('RUN-COMMIT', `${commit} not found in ${root}`);
    return { errors, warnings };
  }
  if (run.repo.dirty) mk('run', warnings)('DIRTY-TREE', 'evidence is checked against the commit, not the working tree');
  const head = git(root, ['rev-parse', 'HEAD']);
  if (head && head !== commit) mk('run', warnings)('HEAD-MOVED', `HEAD is ${head.slice(0, 12)}, the run audited ${commit.slice(0, 12)}`);
  for (const id of run.audits || []) if (!docs[id]) runAdd('AUDIT-MISSING', `${id}.findings.json is absent`);
  const reconPath = join(dir, 'recon.json');
  if (existsSync(reconPath)) {
    const recon = readJson(reconPath);
    for (const v of validate(recon, readJson(join(schemaDir, 'recon.schema.json')))) runAdd('SCHEMA', `recon.json ${v.path}: ${v.message}`);
    if (recon.commit && recon.commit !== commit) runAdd('COMMIT-MISMATCH', `recon.json is for ${recon.commit.slice(0, 12)}`);
  }
  // END_BLOCK_LINT_RUN

  const findingsSchema = readJson(join(schemaDir, 'findings.schema.json'));
  const prevDocs = run.previous && existsSync(join(dir, '..', '..', run.previous.dir)) ? loadRun(join(dir, '..', '..', run.previous.dir)).docs : {};

  for (const [id, { doc, text }] of Object.entries(docs)) {
    const add = mk(id);
    const warn = mk(id, warnings);
    const violations = validate(doc, findingsSchema);
    for (const v of violations) add('SCHEMA', `${v.path}: ${v.message}`);
    for (const s of findSecrets(text)) add('SECRET', `${s.kind} (${s.sample})`);
    if (violations.length) continue;
    // START_BLOCK_LINT_IDENTITY
    if (doc.audit !== id) add('AUDIT-UNKNOWN', `file is ${id}.findings.json but audit is "${doc.audit}"`);
    const rubric = loadRubric(id, rubricsDir);
    if (!rubric || !(run.audits || []).includes(id)) {
      add('AUDIT-UNKNOWN', rubric ? 'not listed in run.json' : 'no shipped rubric');
      continue;
    }
    if (doc.commit !== commit) add('COMMIT-MISMATCH', `${doc.commit.slice(0, 12)} vs run ${commit.slice(0, 12)}`);
    if (doc.rubricVersion !== rubric.version || run.rubrics[id] !== rubric.version) {
      add('RUBRIC-VERSION', `document ${doc.rubricVersion}, run ${run.rubrics[id]}, shipped ${rubric.version}`);
    }
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
    if (!doc.score) add('SCORE-MISSING', 'run "smart-audit score <run-dir>"');
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
  const base = file.split(/[\\/]/).pop();
  const add = (rule, message) => errors.push({ rule, audit: base, message });
  if (base === 'recon.json') {
    for (const v of validate(doc, readJson(join(schemaDir, 'recon.schema.json')))) add('SCHEMA', `${v.path}: ${v.message}`);
    if (typeof doc.commit === 'string' && !commitExists(root, doc.commit)) add('RUN-COMMIT', `${doc.commit} not found in ${root}`);
    return { kind: 'recon', errors };
  }
  const draft = base.endsWith('.draft.json');
  const schema = readJson(join(schemaDir, 'findings.schema.json'));
  if (draft) schema.$defs.finding.required = schema.$defs.finding.required.filter((k) => k !== 'verification');
  const violations = validate(doc, schema);
  for (const v of violations) add('SCHEMA', `${v.path}: ${v.message}`);
  for (const s of findSecrets(JSON.stringify(doc))) add('SECRET', `${s.kind} (${s.sample})`);
  if (violations.length) return { kind: draft ? 'draft' : 'findings', errors };
  if (!commitExists(root, doc.commit)) {
    add('RUN-COMMIT', `${doc.commit} not found in ${root}`);
    return { kind: draft ? 'draft' : 'findings', errors };
  }
  const rubric = loadRubric(doc.audit, rubricsDir);
  if (!rubric) add('AUDIT-UNKNOWN', `no shipped rubric "${doc.audit}"`);
  else {
    if (doc.rubricVersion !== rubric.version) add('RUBRIC-VERSION', `document ${doc.rubricVersion}, shipped ${rubric.version}`);
    const have = doc.criteria.map((c) => c.id);
    for (const c of rubric.criteria) {
      const n = have.filter((x) => x === c.id).length;
      if (n !== 1) add('CRITERIA-COVERAGE', `criterion "${c.id}" appears ${n} time(s)`);
    }
    for (const id of have) if (!rubric.criteria.some((c) => c.id === id)) add('CRITERIA-COVERAGE', `criterion "${id}" is not in rubric ${doc.audit}@${rubric.version}`);
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
