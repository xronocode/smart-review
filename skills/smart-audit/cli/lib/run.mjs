// START_MODULE_CONTRACT
//   PURPOSE: Open an audit run: pin the commit, choose audits, snapshot accepted risks, and locate the previous run.
//   SCOPE: Reads the audited repository through git and writes run.json plus the run index in the output directory.
//   DEPENDS: M-AUDIT-RUBRICS
//   LINKS: M-AUDIT-CLI, V-M-AUDIT-CLI
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   startRun - create the run directory and run.json, return run metadata and paths
//   loadRun - read run.json and every findings document of a run directory
//   GUIDANCE_FILES - guidance file names looked up at the repository root
// END_MODULE_MAP
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { CliError, TOOL_VERSION, git, readJson, writeJson } from './util.mjs';
import { SCORING_VERSION } from './score.mjs';
import { loadProfiles, loadRubric } from './rubrics.mjs';

export const GUIDANCE_FILES = ['SMART_AUDIT.md'];
export const OUT_DIR = '.smart-audit';

function readAccepted(repo, commit) {
  // Accepted risks are read from the audited commit, never from the working tree,
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
    .filter((a) => a && typeof a.audit === 'string' && typeof a.key === 'string' && typeof a.reason === 'string' && a.reason.trim())
    .map((a) => ({ audit: a.audit, key: a.key, reason: a.reason.trim() }));
}

// START_CONTRACT: startRun
//   PURPOSE: Pin an audit run to the repository HEAD commit and record what will be audited.
//   INPUTS: { repo: string, out?: string, profile?: string, audits?: string[], lang?: string, rubricsDir?: string }
//   OUTPUTS: { runDir: string, run: object }
//   SIDE_EFFECTS: writes run.json into the run directory
// END_CONTRACT: startRun
export function startRun({ repo, out, profile = 'quick', audits, lang = 'en', rubricsDir }) {
  const root = resolve(repo);
  const commit = git(root, ['rev-parse', 'HEAD']);
  if (!commit) throw new CliError(`${root} is not a git repository with at least one commit`);
  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']) || 'HEAD';
  const dirty = (git(root, ['status', '--porcelain', '--untracked-files=no']) || '') !== '';
  let ids = audits;
  if (!ids) {
    const profiles = loadProfiles(rubricsDir);
    ids = profiles[profile];
    if (!ids) throw new CliError(`unknown profile "${profile}"; available: ${Object.keys(profiles).join(', ')}`);
  }
  const rubrics = {};
  for (const id of ids) {
    const r = loadRubric(id, rubricsDir);
    if (!r) throw new CliError(`no rubric for audit "${id}"`);
    rubrics[id] = r.version;
  }
  const outRoot = resolve(out || join(root, OUT_DIR));
  const runDir = join(outRoot, 'runs', commit.slice(0, 12));
  // START_BLOCK_FIND_PREVIOUS_RUN
  let previous = null;
  const indexPath = join(outRoot, 'index.json');
  if (existsSync(indexPath)) {
    const idx = readJson(indexPath);
    const prior = (idx.runs || []).filter((r) => r.commit !== commit && existsSync(join(outRoot, r.dir)));
    if (prior.length) {
      const last = prior[prior.length - 1];
      previous = { commit: last.commit, dir: last.dir };
    }
  }
  // END_BLOCK_FIND_PREVIOUS_RUN
  const guidanceFile = GUIDANCE_FILES.find((f) => git(root, ['cat-file', '-t', `${commit}:${f}`]) === 'blob') || null;
  const run = {
    schemaVersion: 1,
    toolVersion: TOOL_VERSION,
    scoringVersion: SCORING_VERSION,
    repo: { commit, branch, dirty, name: basename(root) },
    profile: audits ? 'custom' : profile,
    lang,
    audits: ids,
    rubrics,
    startedAt: new Date().toISOString(),
    previous,
    accepted: readAccepted(root, commit),
    guidanceFile,
  };
  writeJson(join(runDir, 'run.json'), run);
  return { runDir, outRoot, run };
}

export function loadRun(runDir) {
  const dir = resolve(runDir);
  const runPath = join(dir, 'run.json');
  if (!existsSync(runPath)) throw new CliError(`${dir} has no run.json; open a run with "smart-audit start"`);
  const run = readJson(runPath);
  const docs = {};
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.findings.json')).sort()) {
    docs[f.slice(0, -'.findings.json'.length)] = { path: join(dir, f), doc: readJson(join(dir, f)), text: readFileSync(join(dir, f), 'utf8') };
  }
  return { dir, run, docs };
}
