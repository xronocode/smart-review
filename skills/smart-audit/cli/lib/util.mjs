// START_MODULE_CONTRACT
//   PURPOSE: Shared helpers for the smart-audit CLI: argument parsing, JSON IO, git reads, path safety.
//   SCOPE: Pure helpers plus read-only git queries; no network, no writes outside paths given by the caller.
//   DEPENDS: none
//   LINKS: M-AUDIT-CLI, V-M-AUDIT-CLI
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   parseArgs - split argv into positionals and --flags
//   readJson / writeJson - JSON file IO with stable formatting
//   git - run a read-only git command in a repository
//   commitExists / fileAtCommit / lineCountAtCommit - evidence lookups on a commit
//   isSafeRelPath - reject absolute paths and parent traversal
//   skillRoot - directory of the installed skill
// END_MODULE_MAP
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOOL_VERSION = '0.1.0';
export const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export class CliError extends Error {}

export function parseArgs(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) flags[a.slice(2)] = argv[++i];
      else flags[a.slice(2)] = true;
    } else pos.push(a);
  }
  return { pos, flags };
}

export function readJson(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    throw new CliError(`cannot read ${path}: ${e.code || e.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new CliError(`invalid JSON in ${path}: ${e.message}`);
  }
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

// START_CONTRACT: git
//   PURPOSE: Run one read-only git command and return trimmed stdout, or null on failure.
//   INPUTS: { repo: string - repository path, args: string[] - git arguments }
//   OUTPUTS: { string | null }
//   SIDE_EFFECTS: none
// END_CONTRACT: git
export function git(repo, args, { raw = false } = {}) {
  try {
    const out = execFileSync('git', ['-C', repo, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 256 * 1024 * 1024,
    });
    return raw ? out : out.trim();
  } catch {
    return null;
  }
}

export function commitExists(repo, sha) {
  return /^[0-9a-f]{7,40}$/.test(sha) && git(repo, ['cat-file', '-e', `${sha}^{commit}`]) !== null;
}

export function isSafeRelPath(p) {
  if (typeof p !== 'string' || !p || isAbsolute(p) || p.includes('\\') || p.includes('\0')) return false;
  return !p.split('/').some((s) => s === '..' || s === '');
}

const lineCache = new Map();
// Returns the number of lines of path at commit, or null when the path is not a file there.
export function lineCountAtCommit(repo, sha, path) {
  const k = `${repo}\0${sha}\0${path}`;
  if (lineCache.has(k)) return lineCache.get(k);
  let n = null;
  if (git(repo, ['cat-file', '-t', `${sha}:${path}`]) === 'blob') {
    const body = git(repo, ['show', `${sha}:${path}`], { raw: true });
    if (body !== null) {
      n = body.length === 0 ? 0 : body.split('\n').length - (body.endsWith('\n') ? 1 : 0);
    }
  }
  lineCache.set(k, n);
  return n;
}

export function mean(nums) {
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
}
