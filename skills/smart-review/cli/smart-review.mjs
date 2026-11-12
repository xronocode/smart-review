#!/usr/bin/env node
// START_MODULE_CONTRACT
//   PURPOSE: Command-line entry of smart-review: open a run, score it, lint it, compare it with the previous run, and render reports.
//   SCOPE: Argument handling, command dispatch, exit codes, and writing run artifacts. All rules live in lib modules.
//   DEPENDS: M-SECTION-RUBRICS
//   LINKS: M-SECTION-CLI, V-M-SECTION-CLI
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   main - dispatch one CLI command and return its exit code
// END_MODULE_MAP
import { existsSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CliError, TOOL_VERSION, parseArgs, readJson, writeJson, skillRoot } from './lib/util.mjs';
import { computeScore, SCORING_VERSION, WEIGHTS, CAPS, MEDIUM_TOTAL_MAX, LOW_TOTAL_MAX } from './lib/score.mjs';
import { lintRun, checkFile, RULES } from './lib/lint.mjs';
import { diffRuns } from './lib/diff.mjs';
import { startRun, loadRun } from './lib/run.mjs';
import { loadRubric, loadProfiles, listRubrics } from './lib/rubrics.mjs';
import { buildSummary, renderMarkdown, renderHtml } from './lib/report.mjs';

const HELP = `smart-review ${TOOL_VERSION} — deterministic scoring and verification for repository reviews

Usage:
  smart-review start  --repo <path> [--profile quick|full | --sections a,b] [--out <dir>] [--lang en|ru] [--name <repo-name>]
  smart-review score  <run-dir | findings.json>
  smart-review check  <recon.json | draft.json | findings.json> --repo <path>   check one document while working
  smart-review lint   <run-dir> --repo <path> [--json]
  smart-review diff   <run-dir> [--prev <run-dir>]
  smart-review report <run-dir> [--lang en|ru]
  smart-review finish <run-dir> --repo <path> [--lang en|ru]   score + lint, then diff + report when lint passes
  smart-review rubrics [--json]                                list sections, profiles, and scoring constants
  smart-review rules                                           list lint rules

Exit codes: 0 ok, 1 lint errors, 2 usage or input error.`;

function need(flags, name) {
  if (!flags[name] || flags[name] === true) throw new CliError(`--${name} is required`);
  return flags[name];
}

function scoreTarget(target, out) {
  const abs = resolve(target);
  if (!existsSync(abs)) throw new CliError(`${abs} does not exist`);
  const files = [];
  let accepted = [];
  if (statSync(abs).isDirectory()) {
    const { run, docs } = loadRun(abs);
    accepted = run.accepted || [];
    for (const d of Object.values(docs)) files.push(d.path);
  } else {
    files.push(abs);
    const runPath = join(dirname(abs), 'run.json');
    if (existsSync(runPath)) accepted = readJson(runPath).accepted || [];
  }
  const results = {};
  for (const f of files) {
    const doc = readJson(f);
    if (!Array.isArray(doc.findings) || typeof doc.section !== 'string') throw new CliError(`${f} is not a findings document`);
    delete doc.score;
    doc.score = computeScore(doc, accepted);
    writeJson(f, doc);
    results[doc.section] = doc.score.value;
    out(`${doc.section}: ${doc.score.value}/100 (${doc.score.band})`);
  }
  return results;
}

function previousOf(runDir, run, flags) {
  if (flags.prev && flags.prev !== true) return resolve(flags.prev);
  if (!run.previous) return null;
  const p = resolve(runDir, '..', '..', run.previous.dir);
  return existsSync(join(p, 'run.json')) ? p : null;
}

function doDiff(runDir, flags) {
  const current = loadRun(runDir);
  const prevDir = previousOf(current.dir, current.run, flags);
  if (!prevDir) return null;
  const d = diffRuns(current, loadRun(prevDir));
  writeJson(join(current.dir, 'diff.json'), d);
  return d;
}

function doReport(runDir, flags, out) {
  const { dir, run, docs } = loadRun(runDir);
  if (!Object.keys(docs).length) throw new CliError(`${dir} has no findings documents`);
  const lang = flags.lang && flags.lang !== true ? flags.lang : run.lang || 'en';
  const rubrics = Object.fromEntries(Object.keys(docs).map((id) => [id, loadRubric(id)]));
  const diff = existsSync(join(dir, 'diff.json')) ? readJson(join(dir, 'diff.json')) : null;
  const summary = buildSummary(run, docs);
  const ctx = { run, docs, rubrics, summary, diff, lang };
  writeJson(join(dir, 'summary.json'), summary);
  writeFileSync(join(dir, 'report.md'), renderMarkdown(ctx));
  writeFileSync(join(dir, 'report.html'), renderHtml(ctx));
  // START_BLOCK_UPDATE_RUN_INDEX
  const outRoot = resolve(dir, '..', '..');
  const indexPath = join(outRoot, 'index.json');
  const index = existsSync(indexPath) ? readJson(indexPath) : { schemaVersion: 1, runs: [] };
  const entry = {
    commit: run.repo.commit,
    dir: relative(outRoot, dir).split('\\').join('/'),
    date: run.startedAt,
    overall: summary.overall,
    sections: Object.fromEntries(Object.entries(summary.sections).map(([id, a]) => [id, a.score])),
  };
  index.runs = index.runs.filter((r) => r.commit !== entry.commit).concat(entry);
  writeJson(indexPath, index);
  // END_BLOCK_UPDATE_RUN_INDEX
  out(`overall: ${summary.overall}/100`);
  out(join(dir, 'report.md'));
  out(join(dir, 'report.html'));
  return summary;
}

function printLint(res, flags, out) {
  if (flags.json) {
    out(JSON.stringify(res, null, 2));
    return;
  }
  for (const e of res.errors) out(`error   ${e.section.padEnd(14)} ${e.rule.padEnd(22)} ${e.message}`);
  for (const w of res.warnings) out(`warning ${w.section.padEnd(14)} ${w.rule.padEnd(22)} ${w.message}`);
  out(res.errors.length ? `lint failed: ${res.errors.length} error(s), ${res.warnings.length} warning(s)` : `lint passed: 0 errors, ${res.warnings.length} warning(s)`);
}

// START_CONTRACT: main
//   PURPOSE: Run one smart-review command.
//   INPUTS: { argv: string[] - arguments after the program name, out?: (line: string) => void }
//   OUTPUTS: { number - process exit code }
//   SIDE_EFFECTS: writes run artifacts for start, score, diff, report, and finish
// END_CONTRACT: main
export function main(argv, out = console.log) {
  const { pos, flags } = parseArgs(argv);
  const cmd = pos[0];
  try {
    if (!cmd || cmd === 'help' || flags.help) {
      out(HELP);
      return cmd || flags.help ? 0 : 2;
    }
    if (cmd === 'version' || flags.version) {
      out(TOOL_VERSION);
      return 0;
    }
    if (cmd === 'rules') {
      for (const [k, v] of Object.entries(RULES)) out(`${k.padEnd(22)} ${v}`);
      return 0;
    }
    if (cmd === 'rubrics') {
      const data = {
        skillRoot,
        scoringVersion: SCORING_VERSION,
        weights: WEIGHTS,
        caps: CAPS,
        mediumTotalMax: MEDIUM_TOTAL_MAX,
        lowTotalMax: LOW_TOTAL_MAX,
        profiles: loadProfiles(),
        sections: listRubrics().map((id) => {
          const r = loadRubric(id);
          return { id, version: r.version, question: r.question.en, criteria: r.criteria.length };
        }),
      };
      if (flags.json) out(JSON.stringify(data, null, 2));
      else {
        for (const a of data.sections) out(`${a.id.padEnd(14)} v${a.version}  ${a.criteria} criteria  ${a.question}`);
        for (const [p, ids] of Object.entries(data.profiles)) out(`profile ${p}: ${ids.join(', ')}`);
      }
      return 0;
    }
    if (cmd === 'start') {
      const sections = flags.sections && flags.sections !== true ? flags.sections.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
      const res = startRun({ repo: need(flags, 'repo'), out: flags.out === true ? undefined : flags.out, profile: flags.profile === true ? undefined : flags.profile, sections, lang: flags.lang === 'ru' ? 'ru' : 'en', name: flags.name === true ? undefined : flags.name });
      out(JSON.stringify({ runDir: res.runDir, priorPass: res.prior, ...res.run }, null, 2));
      return 0;
    }
    const target = pos[1];
    if (!target) throw new CliError(`${cmd}: a run directory or file is required`);
    if (cmd === 'score') {
      scoreTarget(target, out);
      return 0;
    }
    if (cmd === 'check') {
      const res = checkFile({ file: resolve(target), repo: need(flags, 'repo') });
      if (flags.json) out(JSON.stringify(res, null, 2));
      else {
        for (const e of res.errors) out(`error   ${e.rule.padEnd(22)} ${e.message}`);
        out(res.errors.length ? `${res.kind} check failed: ${res.errors.length} error(s)` : `${res.kind} check passed`);
      }
      return res.errors.length ? 1 : 0;
    }
    if (cmd === 'lint') {
      const res = lintRun({ runDir: target, repo: need(flags, 'repo') });
      printLint(res, flags, out);
      return res.errors.length ? 1 : 0;
    }
    if (cmd === 'diff') {
      const d = doDiff(target, flags);
      if (!d) out('no previous run to compare with');
      else for (const [id, a] of Object.entries(d.sections)) out(`${id}: ${a.scoreBefore ?? '—'} → ${a.scoreAfter ?? '—'}; ${a.items.map((i) => i.status).join(', ') || 'no findings'}`);
      return 0;
    }
    if (cmd === 'report') {
      doReport(target, flags, out);
      return 0;
    }
    if (cmd === 'finish') {
      scoreTarget(target, out);
      const res = lintRun({ runDir: target, repo: need(flags, 'repo') });
      printLint(res, flags, out);
      if (res.errors.length) return 1;
      doDiff(target, flags);
      doReport(target, flags, out);
      return 0;
    }
    throw new CliError(`unknown command "${cmd}"`);
  } catch (e) {
    if (e instanceof CliError) {
      out(`smart-review: ${e.message}`);
      return 2;
    }
    throw e;
  }
}

// Run only when executed directly; npx and npm link invoke this file through a symlink.
function isEntry() {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}
if (isEntry()) process.exitCode = main(process.argv.slice(2));
