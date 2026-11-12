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
//   startRun - create the run directory and run.json, return run metadata and paths
//   loadRun - read run.json and every findings document of a run directory
// END_MODULE_MAP
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { CliError, TOOL_VERSION, git, readJson, writeJson } from './util.mjs';
import { SCORING_VERSION } from './score.mjs';
import { loadProfiles, loadRubric } from './rubrics.mjs';

export const GUIDANCE_FILES = ['SMART_REVIEW.md'];
export const OUT_DIR = '.smart-review';

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

// START_CONTRACT: startRun
//   PURPOSE: Pin a review run to the repository HEAD commit and record what will be reviewed.
//   INPUTS: { repo: string, out?: string, profile?: string, sections?: string[], lang?: string, name?: string, rubricsDir?: string }
//   OUTPUTS: { runDir: string, run: object, prior: string[] - sections whose earlier findings on this commit were kept }
//   SIDE_EFFECTS: writes run.json; moves earlier findings of the same commit into prior/ and removes stale drafts and reports
// END_CONTRACT: startRun
export function startRun({ repo, out, profile = 'full', sections, lang = 'en', name, rubricsDir }) {
  const root = resolve(repo);
  const commit = git(root, ['rev-parse', 'HEAD']);
  if (!commit) throw new CliError(`${root} is not a git repository with at least one commit`);
  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']) || 'HEAD';
  const dirty = (git(root, ['status', '--porcelain', '--untracked-files=no']) || '') !== '';
  let ids = sections;
  if (!ids) {
    const profiles = loadProfiles(rubricsDir);
    ids = profiles[profile];
    if (!ids) throw new CliError(`unknown profile "${profile}"; available: ${Object.keys(profiles).join(', ')}`);
  }
  const rubrics = {};
  for (const id of ids) {
    const r = loadRubric(id, rubricsDir);
    if (!r) throw new CliError(`no rubric for section "${id}"`);
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
    repo: { commit, branch, dirty, name: name || repoName(root) },
    profile: sections ? 'custom' : profile,
    lang,
    sections: ids,
    rubrics,
    startedAt: new Date().toISOString(),
    previous,
    accepted: readAccepted(root, commit),
    guidanceFile,
  };
  // START_BLOCK_KEEP_PRIOR_PASS
  // Re-opening a run on the same commit keeps the earlier findings as the prior pass,
  // so a second pass builds on the first instead of silently replacing it.
  const prior = [];
  if (existsSync(runDir)) {
    const old = readdirSync(runDir).filter((n) => n.endsWith('.findings.json'));
    if (old.length) {
      rmSync(join(runDir, 'prior'), { recursive: true, force: true });
      mkdirSync(join(runDir, 'prior'), { recursive: true });
      for (const n of old) {
        renameSync(join(runDir, n), join(runDir, 'prior', n));
        prior.push(n.slice(0, -'.findings.json'.length));
      }
    }
    for (const n of ['report.md', 'report.html', 'summary.json', 'diff.json']) rmSync(join(runDir, n), { force: true });
    rmSync(join(runDir, 'drafts'), { recursive: true, force: true });
  }
  // END_BLOCK_KEEP_PRIOR_PASS
  writeJson(join(runDir, 'run.json'), run);
  return { runDir, outRoot, run, prior };
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
  const docs = {};
  for (const id of ids) {
    const path = join(dir, `${id}.findings.json`);
    docs[id] = { path, doc: readJson(path), text: readFileSync(path, 'utf8') };
  }
  return { dir, run, docs };
}
