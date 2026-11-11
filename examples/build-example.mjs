#!/usr/bin/env node
// Builds the example report shipped in examples/demo/ from a synthetic repository.
// Nothing here comes from a real project: the code and the findings are made up to
// show what a finished run looks like. Usage: node examples/build-example.mjs
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../skills/smart-audit/cli/smart-audit.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const skill = join(here, '..', 'skills', 'smart-audit');
const repo = mkdtempSync(join(tmpdir(), 'smart-audit-demo-'));
const env = { ...process.env, GIT_AUTHOR_DATE: '2026-01-15T10:00:00Z', GIT_COMMITTER_DATE: '2026-01-15T10:00:00Z' };
const git = (...a) => execFileSync('git', ['-C', repo, '-c', 'user.name=demo', '-c', 'user.email=demo@example.invalid', '-c', 'commit.gpgsign=false', ...a], { encoding: 'utf8', env }).trim();

const files = {
  'README.md': '# notes-api\n\nA tiny notes service used as an audit example.\n\n```\nnpm ci\nnpm test\n```\n',
  'package.json': JSON.stringify({ name: 'notes-api', version: '0.3.0', type: 'module', scripts: { test: 'node --test', start: 'node src/server.js', export: 'npx json2csv-cli -i data/notes.json' }, dependencies: { express: '^4.19.2' } }, null, 2) + '\n',
  'src/server.js': [
    "import express from 'express';",
    "import { readNote, saveNote, listNotes } from './store.js';",
    '',
    'const app = express();',
    'app.use(express.json());',
    '',
    "app.get('/notes', (req, res) => res.json(listNotes(req.get('x-user'))));",
    '',
    "app.get('/notes/:id', (req, res) => {",
    '  const note = readNote(req.params.id);',
    "  if (!note) return res.status(404).json({ error: 'not found' });",
    '  res.json(note);',
    '});',
    '',
    "app.post('/notes', (req, res) => {",
    "  res.status(201).json(saveNote(req.get('x-user'), req.body));",
    '});',
    '',
    "app.get('/export/:file', (req, res) => {",
    "  res.sendFile(process.cwd() + '/exports/' + req.params.file);",
    '});',
    '',
    'app.listen(process.env.PORT || 3000);',
  ].join('\n') + '\n',
  'src/store.js': [
    'const notes = new Map();',
    'let nextId = 1;',
    '',
    'export function listNotes(owner) {',
    '  return [...notes.values()].filter((n) => n.owner === owner);',
    '}',
    '',
    'export function readNote(id) {',
    '  return notes.get(Number(id));',
    '}',
    '',
    'export function saveNote(owner, body) {',
    '  const note = { id: nextId++, owner, text: body.text };',
    '  notes.set(note.id, note);',
    '  return note;',
    '}',
    '',
    'export function legacyImport(rows) {',
    '  try {',
    '    for (const r of rows) notes.set(r.id, r);',
    '  } catch (e) {}',
    '}',
  ].join('\n') + '\n',
  'test/store.test.js': [
    "import { test } from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import { saveNote, listNotes } from '../src/store.js';",
    '',
    "test('saves a note', () => {",
    "  const note = saveNote('ann', { text: 'hi' });",
    "  assert.equal(note.text, 'hi');",
    '});',
    '',
    "test('lists notes', () => {",
    "  assert.ok(listNotes('ann'));",
    '});',
  ].join('\n') + '\n',
  '.gitignore': 'node_modules/\n',
};
git('init', '-q', '-b', 'main');
for (const [p, body] of Object.entries(files)) {
  mkdirSync(dirname(join(repo, p)), { recursive: true });
  writeFileSync(join(repo, p), body);
}
git('add', '-A');
git('commit', '-q', '-m', 'notes-api example');
const commit = git('rev-parse', 'HEAD');

const lines = [];
main(['start', '--repo', repo, '--profile', 'quick', '--name', 'notes-api', '--out', join(repo, 'out')], (l) => lines.push(l));
const { runDir } = JSON.parse(lines.join('\n'));
const rubric = (id) => JSON.parse(readFileSync(join(skill, 'rubrics', `${id}.json`), 'utf8'));
const crit = (id, map) => rubric(id).criteria.map((c) => {
  const v = map[c.id];
  if (v === undefined) return { id: c.id, status: 'scored', score: 4, note: 'Reviewed; no gap worth a finding.' };
  if (typeof v === 'string') return { id: c.id, status: v.startsWith('na:') ? 'na' : 'unknown', note: v.replace(/^(na|unknown): /, '') };
  return { id: c.id, status: 'scored', score: v[0], note: v[1] };
});
const base = (audit) => ({ schemaVersion: 1, audit, rubricVersion: rubric(audit).version, commit, lang: 'en' });
const ok = (note) => ({ result: 'confirmed', note });

const docs = {
  security: {
    ...base('security'),
    verdict: 'Any caller can read any note and any file under the service directory; fix both before exposing the service.',
    summary: 'Two problems are reachable without credentials: the note-by-id route returns notes of other users, and the export route builds a file path from the URL. The service trusts an x-user header as identity, which makes both worse. Request bodies are parsed as JSON with the framework default limit, and no secrets are tracked. Nothing was executed, so runtime behavior behind a proxy is not confirmed.',
    findings: [
      { id: 'F-001', key: 'export-route-path-traversal', title: 'Export route reads files outside the exports directory', severity: 'high', confidence: 'high',
        what: 'GET /export/:file concatenates the URL segment into a filesystem path and passes it to sendFile without normalizing or confining it.',
        impact: 'An unauthenticated caller can request encoded parent segments and read any file the process can read, including source and environment files. It does not allow writing files.',
        fix: 'Resolve the requested name against the exports directory and refuse anything that leaves it; prefer the root option of sendFile. Keep the route read-only.',
        affected: ['File export'], evidence: [{ path: 'src/server.js', line: 20 }, { path: 'src/server.js', line: 19 }],
        verify: ['A request for an encoded parent path returns 400 or 404.', 'A test requests a file outside exports/ and asserts it is refused.'],
        verification: ok('Re-read src/server.js:19-21; no normalization, no root option, no allow-list on this path.') },
      { id: 'F-002', key: 'note-read-skips-ownership', title: 'A note can be read by id without checking its owner', severity: 'high', confidence: 'high',
        what: 'GET /notes/:id returns readNote(id) directly; the list route filters by owner but the single-note route does not.',
        impact: 'Any caller can enumerate ids and read every user\'s notes. Ids are sequential, so enumeration is trivial.',
        fix: 'Check the note owner against the caller in the route or in readNote, and return 404 for notes of other users.',
        affected: ['Reading notes'], evidence: [{ path: 'src/server.js', line: 10 }, { path: 'src/store.js', line: 8 }, { path: 'src/store.js', line: 13 }],
        verify: ['A request for another user\'s note id returns 404.', 'A test creates notes for two users and asserts the cross-read fails.'],
        verification: ok('Re-read src/server.js:9-13 and src/store.js:8-10; no owner comparison anywhere on the path.') },
      { id: 'F-003', key: 'identity-from-client-header', title: 'Caller identity is taken from a client-supplied header', severity: 'medium', confidence: 'medium',
        what: 'Routes use the x-user request header as the user identity; nothing in this repository authenticates it.',
        impact: 'A caller can act as any user by setting the header, unless a gateway outside this repository strips and sets it. That gateway is not visible here.',
        fix: 'Authenticate in the service, or document and enforce that only a trusted proxy can reach it and that it overwrites the header.',
        affected: ['All note routes'], evidence: [{ path: 'src/server.js', line: 7 }, { path: 'src/server.js', line: 16 }],
        verify: ['Requests without a valid credential are rejected with 401.'],
        verification: { result: 'downgraded', note: 'Lowered from high: a deployment behind an authenticating proxy is plausible and cannot be ruled out from the repository. Re-read src/server.js:1-23.' } },
    ],
    unconfirmed: [{ title: 'No request rate limit', note: 'No limiter is configured, but no concrete abuse path beyond the findings above was traced.' }],
    criteria: crit('security', {
      secrets: [5, 'No key formats or environment files among 6 tracked files.'], authn: [1, 'Identity is an unauthenticated header (F-003).'], authz: [1, 'List filters by owner; read by id does not (F-002).'],
      input: [3, 'JSON body parsing with default limits; note text is not validated.'], injection: 'na: No shell, query language, or template engine is used.', rendering: 'na: The service returns JSON only.',
      network: 'na: No outbound requests.', files: [1, 'Export path is built from the URL (F-001).'], crypto: 'na: No cryptography or update channel.',
      supply: [3, 'The export script fetches a tool with npx outside the lockfile; reported in the dependency audit.'], logging: [4, 'No logging of request bodies.'],
      hardening: [2, 'No security headers or limits configured in the repository.'], sectests: [0, 'No test pins ownership or path confinement.'],
    }),
    strengths: ['No secrets are tracked.', 'The notes list is filtered by owner.'],
    checked: [{ area: 'Entry points', note: 'Traced all 4 HTTP routes in src/server.js to the store and filesystem calls.' }, { area: 'Secrets', note: 'Searched all 6 tracked files for key formats.' }],
    limits: [{ text: 'The service was not started and no requests were sent.', effect: 'Framework-level path handling was judged from the code, not observed.' }, { text: 'Deployment configuration is not in the repository.', effect: 'Whether a proxy authenticates callers is unknown; F-003 is rated with that in mind.' }],
    tools: [{ name: 'gitleaks', status: 'absent' }],
  },
  tests: {
    ...base('tests'),
    verdict: 'The suite would not catch a broken route or a broken ownership rule: only the in-memory store has tests, and one of the two is decorative.',
    summary: 'Two tests exist, both for the store. Nothing exercises the HTTP routes, so the two security problems found in the security audit could be introduced or fixed without any test changing. The suite runs from a documented command and is deterministic. Coverage is not measured.',
    findings: [
      { id: 'F-001', key: 'http-routes-untested', title: 'No test exercises the HTTP routes', severity: 'high', confidence: 'high',
        what: 'The only test file imports the store module. The four routes in src/server.js, including ownership and file export, have no test.',
        impact: 'The primary user-facing surface can break or leak data with a green suite.',
        fix: 'Add route-level tests that start the app on an ephemeral port and cover list, read, create, and export, including cross-user access.',
        affected: ['All routes'], evidence: [{ path: 'test/store.test.js', line: 3 }, { path: 'src/server.js', line: 7 }],
        verify: ['A test fails when the owner filter is removed from the list route.'],
        verification: ok('Listed tracked test files: one. Re-read test/store.test.js:1-12; no import of server.js.') },
      { id: 'F-002', key: 'list-test-asserts-truthiness-only', title: 'The list test passes for any result', severity: 'medium', confidence: 'high',
        what: 'The test asserts only that listNotes returns a truthy value; an empty array is truthy.',
        impact: 'Removing or inverting the owner filter would not fail the test.',
        fix: 'Assert the exact notes returned for two different owners.',
        affected: ['Listing notes'], evidence: [{ path: 'test/store.test.js', line: 11 }],
        verify: ['The test fails when the filter in listNotes is removed.'],
        verification: ok('Re-read test/store.test.js:10-12 against src/store.js:4-6.') },
    ],
    unconfirmed: [],
    criteria: crit('tests', {
      purpose: [2, 'Tests cover the simplest module, not the routes.'], regression: [1, 'Of three plausible bugs (owner filter, id lookup, export path) none would be caught.'], assertions: [2, 'One decorative assertion out of two tests.'],
      unit: [3, 'Store logic is tested in isolation, thinly.'], integration: [0, 'No route or boundary test.'], journeys: [0, 'No end-to-end flow.'], failure: [0, 'No negative case.'], edges: [0, 'No boundary case.'],
      state: [1, 'Shared module state between tests is not reset.'], determinism: [4, 'No time, random, or network dependence.'], runnable: [5, 'README documents npm test.'], coverage: 'unknown: No coverage configuration or report in the repository.',
      data: [2, 'Tests rely on shared in-memory state.'], doubles: 'na: No test doubles are used.', speed: 'unknown: No timing evidence in the repository.', maintainability: [4, 'Small and readable.'],
    }),
    strengths: ['One documented command runs the suite.', 'Tests are deterministic.'],
    checked: [{ area: 'Test files', note: 'Read the only test file (1 of 1) and both modules under test.' }],
    limits: [{ text: 'The test command was not run.', effect: 'The suite is known to be discoverable, not known to pass.' }],
    tools: [],
  },
  dependencies: {
    ...base('dependencies'),
    verdict: 'Installs are not reproducible: there is no lockfile, and one script downloads a tool at run time.',
    summary: 'The project declares one runtime dependency with a caret range and tracks no lockfile, so two installs can differ. The export script runs a tool through npx that is not a declared dependency. No scanner was available, so the state of known vulnerabilities is not established.',
    findings: [
      { id: 'F-001', key: 'no-lockfile', title: 'No lockfile is tracked', severity: 'high', confidence: 'high',
        what: 'package.json declares express with a caret range and the repository has no package-lock.json; the README tells users to run npm ci, which requires one.',
        impact: 'Installs are not reproducible and the documented install command fails on a clean clone.',
        fix: 'Generate and commit package-lock.json and keep npm ci as the documented command.',
        affected: ['Installation'], evidence: [{ path: 'package.json', line: 11 }, { path: 'README.md', line: 6 }],
        verify: ['npm ci succeeds on a clean clone.'],
        verification: ok('git ls-files shows no lockfile; re-read package.json and README.md.') },
      { id: 'F-002', key: 'export-script-fetches-unpinned-tool', title: 'Export script downloads an undeclared tool with npx', severity: 'medium', confidence: 'high',
        what: 'The export script runs npx json2csv-cli; the package is not in dependencies or devDependencies, so npx resolves and downloads it at run time.',
        impact: 'Whatever version the registry serves runs with the developer\'s permissions. Reach is limited to machines that run the export script.',
        fix: 'Declare the tool as a devDependency so it is pinned by the lockfile, and call it through an npm script.',
        affected: ['Data export script'], evidence: [{ path: 'package.json', line: 8 }],
        verify: ['The tool appears in the lockfile and npx resolves it locally.'],
        verification: ok('Re-read package.json:5-12; the package is not declared.') },
    ],
    unconfirmed: [],
    criteria: crit('dependencies', {
      inventory: [4, 'One ecosystem, one manifest, plus one undeclared tool.'], reproducible: [0, 'No lockfile (F-001).'], vulnerabilities: 'unknown: No scanner installed and no committed audit report.',
      separation: [4, 'One runtime dependency; no development dependencies declared.'], acquisition: [2, 'npx fetch outside the manifest (F-002).'], scripts: [3, 'No lifecycle scripts in the project itself; third-party scripts are not restricted.'],
      freshness: 'unknown: Without a lockfile the installed versions are not determined.', footprint: [5, 'One dependency, used.'], licenses: 'unknown: The project declares no license.', updates: [0, 'No update automation.'],
    }),
    strengths: ['A single small runtime dependency.'],
    checked: [{ area: 'Manifests', note: 'Read package.json and the tracked file list for lockfiles and vendored code.' }, { area: 'Scripts', note: 'Read all 3 npm scripts for run-time fetches.' }],
    limits: [{ text: 'No vulnerability scanner was available.', effect: 'Known advisories for express are not assessed.' }],
    tools: [{ name: 'osv-scanner', status: 'absent' }, { name: 'npm audit', status: 'skipped', note: 'No lockfile to audit.' }],
  },
};
for (const [id, doc] of Object.entries(docs)) writeFileSync(join(runDir, `${id}.findings.json`), JSON.stringify(doc, null, 2) + '\n');
const code = main(['finish', runDir, '--repo', repo], (l) => console.log(l));
if (code !== 0) process.exit(code);
const dest = join(here, 'demo');
mkdirSync(dest, { recursive: true });
for (const f of ['report.md', 'report.html', 'summary.json', 'security.findings.json']) copyFileSync(join(runDir, f), join(dest, f));
rmSync(repo, { recursive: true, force: true });
console.log(`example written to ${dest}`);
