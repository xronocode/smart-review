// START_MODULE_CONTRACT
//   PURPOSE: Open a review run: pin the commit, choose sections, snapshot accepted risks, and locate the previous run.
//   SCOPE: Reads the reviewed repository through git and writes run.json plus the run index in the output directory.
//   DEPENDS: M-SECTION-RUBRICS
//   LINKS: M-SECTION-CLI, V-M-SECTION-CLI
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   GUIDANCE_FILES - guidance file names looked up at the repository root
//   OUT_DIR - default output directory inside the reviewed repository
//   WEB_ASSESSMENT_TOPIC - explicit, unscored assessment selection
//   startRun - create the run directory and run.json, return run metadata and paths
//   loadRun - read run.json and every findings document of a run directory
//   validAttemptPath - recognize an output-relative attempt directory for a commit
// END_MODULE_MAP
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { CliError, TOOL_VERSION, git, readJson, writeJson } from './util.mjs';
import { SCORING_VERSION } from './score.mjs';
import { loadProfiles, loadRubric, TOPICS } from './rubrics.mjs';

export const GUIDANCE_FILES = ['SMART_REVIEW.md'];
export const OUT_DIR = '.smart-review';
export const WEB_ASSESSMENT_TOPIC = 'web-pentest';

function readAccepted(repo, commit) {
  // Accepted risks are read from the reviewed commit, never from the working tree,
  // so an uncommitted edit cannot silently change a score.
  const body = git(repo, ['show', `${commit}:${OUT_DIR}/accepted.json`], { raw: true });
  if (body === null) return [];
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new CliError(`${OUT_DIR}/accepted.json at ${commit.slice(0, 12)} is not valid JSON`);
  }
  const list = Array.isArray(data.accepted) ? data.accepted : [];
  return list
    .filter((a) => a && typeof a.section === 'string' && typeof a.key === 'string' && typeof a.reason === 'string' && a.reason.trim())
    .map((a) => ({ section: a.section, key: a.key, reason: a.reason.trim() }));
}

// The repository name shown in reports: the remote's last path segment when there is
// one, otherwise the directory name (a worktree or temp clone often has an unrelated one).
function repoName(root) {
  const remotes = (git(root, ['remote']) || '').split('\n').filter(Boolean);
  const pick = remotes.includes('origin') ? 'origin' : remotes[0];
  const url = pick ? git(root, ['remote', 'get-url', pick]) : null;
  const m = url && url.replace(/\.git$/, '').match(/([^/:]+)$/);
  return m ? m[1] : basename(root);
}

function priorArtifact(dir, name) {
  const path = join(dir, name);
  if (!existsSync(path) || realpathSync(path) !== path) throw new CliError(`missing or redirected prior artifact: ${path}`);
  return path;
}

// A selective publication can omit a stale owner or include a copy from another attempt.
// Resolve each requested owner's original before creating any files for the new attempt.
function findPriorFindings(outRoot, commit, ids, attempts) {
  const originals = new Map();
  if (!attempts.length) return originals;
  const root = realpathSync(outRoot);
  for (const attempt of attempts.toReversed()) {
    if (originals.size === ids.length) break;
    const candidates = ids.filter(id => !originals.has(id) && (attempt.sections === undefined || Object.hasOwn(attempt.sections, id)));
    if (!candidates.length) continue;
    if (!validAttemptPath(attempt.dir, commit)) throw new CliError('invalid published prior attempt directory');
    const dir = join(root, attempt.dir);
    const manifest = readJson(priorArtifact(dir, 'run.json'));
    if (manifest?.repo?.commit !== commit) throw new CliError(`published prior attempt commit mismatch: ${attempt.dir}`);
    const reviewed = manifest.reviewSections === undefined ? manifest.sections : manifest.reviewSections;
    if (!Array.isArray(reviewed) || !Array.isArray(manifest.sections)) throw new CliError(`invalid reviewed sections in ${attempt.dir}`);
    for (const id of candidates) {
      if (!reviewed.includes(id)) continue;
      if (!manifest.sections.includes(id) || Object.hasOwn(manifest.carried || {}, id)) {
        throw new CliError(`conflicting prior review scope for ${id} in ${attempt.dir}`);
      }
      const path = priorArtifact(dir, `${id}.findings.json`);
      const doc = readJson(path);
      if (doc?.section !== id || doc.commit !== commit) throw new CliError(`prior findings identity mismatch: ${path}`);
      originals.set(id, path);
    }
  }
  return originals;
}

// START_CONTRACT: startRun
//   PURPOSE: Pin a review run to the repository HEAD commit and record what will be reviewed.
//   INPUTS: { repo: string, out?: string, profile?: string, sections?: string[], topics?: string[], externalAssessment?: object - validated metadata, lang?: string, name?: string, rubricsDir?: string }
//   OUTPUTS: { runDir: string, run: object, prior: string[] - sections whose earlier findings on this commit were kept }
//   SIDE_EFFECTS: creates an isolated attempt, copies compatible results and recovers prior leads from published inspections
// END_CONTRACT: startRun
export function startRun({ repo, out, profile = 'full', sections, topics = [], externalAssessment, lang = 'en', name, rubricsDir }) {
  const root = resolve(repo);
  const commit = git(root, ['rev-parse', 'HEAD']);
  if (!commit) throw new CliError(`${root} is not a git repository with at least one commit`);
  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']) || 'HEAD';
  const dirty = (git(root, ['status', '--porcelain', '--untracked-files=no']) || '') !== '';
  let ids = sections;
  if (!ids && !topics.length) {
    const profiles = loadProfiles(rubricsDir);
    ids = profiles[profile];
    if (!Object.hasOwn(profiles, profile)) throw new CliError(`unknown profile "${profile}"; available: ${Object.keys(profiles).join(', ')}`);
  }
  const wantsExternal = topics.includes(WEB_ASSESSMENT_TOPIC);
  if (externalAssessment !== undefined && !wantsExternal) throw new CliError('--external-assessment requires --topics web-pentest');
  const scoredTopics = topics.filter(topic => topic !== WEB_ASSESSMENT_TOPIC);
  for (const topic of scoredTopics) {
    if (!Object.hasOwn(TOPICS, topic)) throw new CliError(`unknown topic "${topic}"; available: ${[...Object.keys(TOPICS), WEB_ASSESSMENT_TOPIC].join(', ')}`);
  }
  ids = [...new Set([...(ids || []), ...scoredTopics.map(topic => TOPICS[topic])])];
  if (!ids.length && !wantsExternal) throw new CliError('select at least one section or topic');
  const rubrics = {};
  for (const id of ids) {
    const r = loadRubric(id, rubricsDir);
    if (!r) throw new CliError(`no rubric for section "${id}"`);
    rubrics[id] = r.version;
  }
  const outRoot = resolve(out || join(root, OUT_DIR));
  // START_BLOCK_FIND_PREVIOUS_RUN
  let previous = null;
  let base = null;
  let sourceAttempts = [];
  let lastOther = null;
  const indexPath = join(outRoot, 'index.json');
  if (existsSync(indexPath)) {
    const idx = readJson(indexPath);
    base = idx.runs.findLast(entry => entry.commit === commit) || null;
    // A status-only publication advances the index but has no source findings to compare or carry.
    const hasSections = entry => entry.sections === undefined || Object.keys(entry.sections).length > 0;
    if (ids.length) {
      sourceAttempts = idx.runs.filter(entry => entry.commit === commit && hasSections(entry));
      lastOther = idx.runs.findLast(entry => entry.commit !== commit && hasSections(entry) &&
        validAttemptPath(entry.dir, entry.commit) && existsSync(join(outRoot, entry.dir)));
    }
    if (lastOther) {
      previous = { commit: lastOther.commit, dir: lastOther.dir };
    }
  }
  const sourceBase = sourceAttempts.at(-1);
  const originals = findPriorFindings(outRoot, commit, ids, sourceAttempts);
  // END_BLOCK_FIND_PREVIOUS_RUN
  const guidanceFile = ids.length ? GUIDANCE_FILES.find((f) => git(root, ['cat-file', '-t', `${commit}:${f}`]) === 'blob') || null : null;
  const runsDir = join(outRoot, 'runs');
  mkdirSync(runsDir, { recursive: true });
  const runDir = mkdtempSync(join(runsDir, `${commit.slice(0, 12)}-`));
  const carried = {};
  const stale = {};
  let external = wantsExternal ? {
    status: externalAssessment === undefined ? 'external-assessment-required' : 'metadata-supplied',
    recordedAtCommit: commit,
    sourceAttempt: `runs/${basename(runDir)}`,
    ...(externalAssessment === undefined ? {} : { metadata: externalAssessment }),
  } : undefined;
  let reportSections = [...ids];
  if (base) {
    if (!validAttemptPath(base.dir, commit)) throw new CliError('invalid published attempt directory');
    const latest = readJson(join(outRoot, base.dir, 'run.json'));
    if (latest.repo.commit !== commit) throw new CliError('published attempt commit mismatch');
    if (!wantsExternal) external = latest.externalAssessments?.[WEB_ASSESSMENT_TOPIC];
  }
  if (sourceBase) {
    if (!validAttemptPath(sourceBase.dir, commit)) throw new CliError('invalid published source attempt directory');
    const source = loadRun(join(outRoot, sourceBase.dir));
    if (source.run.repo.commit !== commit) throw new CliError('published source attempt commit mismatch');
    previous = source.run.previous;
    Object.assign(stale, source.run.stale);
    for (const [id, entry] of Object.entries(source.docs)) {
      if (ids.includes(id)) continue;
      const rubric = loadRubric(id, rubricsDir);
      if (!rubric) continue;
      if (entry.doc.checked?.some(item => item && Object.hasOwn(item, 'asOf'))) {
        stale[id] = 'external-data';
      } else if (entry.doc.commit !== commit || source.run.rubrics[id] !== rubric.version || entry.doc.rubricVersion !== rubric.version ||
          entry.doc.score?.scoringVersion !== SCORING_VERSION || source.run.scoringVersion !== SCORING_VERSION) {
        stale[id] = 'version';
      } else if (entry.doc.lang !== lang) {
        stale[id] = 'language';
      } else if (id === 'dependencies' && entry.doc.tools.some(tool => tool.status === 'used' && /osv|audit/i.test(tool.name))) {
        stale[id] = 'advisory-data';
      } else {
        rubrics[id] = rubric.version;
        carried[id] = source.run.carried?.[id] || sourceBase.dir;
        copyFileSync(entry.path, join(runDir, `${id}.findings.json`));
      }
    }
    reportSections = [...new Set([...source.run.sections.filter(id => ids.includes(id) || Object.hasOwn(carried, id)), ...ids])];
  } else if (lastOther && ids.length) {
    for (const id of Object.keys(lastOther.sections || {})) stale[id] = 'commit';
  }
  if (originals.size) {
    const priorDir = join(runDir, 'prior');
    mkdirSync(priorDir);
    for (const [id, path] of originals) copyFileSync(path, join(priorDir, `${id}.findings.json`));
  }
  for (const id of reportSections) delete stale[id];
  const run = {
    schemaVersion: 1,
    toolVersion: TOOL_VERSION,
    scoringVersion: SCORING_VERSION,
    repo: { commit, branch, dirty, name: name || repoName(root) },
    profile: sections || topics.length ? 'custom' : profile,
    lang,
    sections: reportSections,
    reviewSections: ids,
    topics: [...new Set(topics)],
    ...(external && { externalAssessments: { [WEB_ASSESSMENT_TOPIC]: external } }),
    carried,
    stale,
    baseDir: base?.dir || null,
    rubrics,
    startedAt: new Date().toISOString(),
    previous,
    accepted: reportSections.length ? readAccepted(root, commit) : [],
    guidanceFile,
  };
  if (externalAssessment !== undefined) writeJson(join(runDir, 'external-assessment.json'), externalAssessment);
  writeJson(join(runDir, 'run.json'), run);
  return { runDir, outRoot, run, prior: ids.filter(id => originals.has(id)) };
}

export function validAttemptPath(path, commit) {
  return typeof commit === 'string' && typeof path === 'string' && /^runs\/[0-9a-f]{12}(?:-[a-zA-Z0-9]+)?$/.test(path) && path.slice(5, 17) === commit.slice(0, 12);
}

export function loadRun(runDir) {
  const dir = resolve(runDir);
  const runPath = join(dir, 'run.json');
  if (!existsSync(runPath)) throw new CliError(`${dir} has no run.json; open a run with "smart-review start"`);
  const run = readJson(runPath);
  // Sections appear in the order the run declared them; unexpected files follow alphabetically.
  const order = Array.isArray(run.sections) ? run.sections : [];
  const rank = (id) => (order.includes(id) ? order.indexOf(id) : order.length);
  const ids = readdirSync(dir)
    .filter((n) => n.endsWith('.findings.json'))
    .map((n) => n.slice(0, -'.findings.json'.length))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const docs = Object.fromEntries(ids.map(id => {
    const path = join(dir, `${id}.findings.json`);
    return [id, { path, doc: readJson(path), text: readFileSync(path, 'utf8') }];
  }));
  return { dir, run, docs };
}
