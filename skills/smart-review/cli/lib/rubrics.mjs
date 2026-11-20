// START_MODULE_CONTRACT
//   PURPOSE: Map selectable topics to their sections and load shipped rubrics and profiles.
//   SCOPE: Read-only access to rubrics/*.json and rubrics/profiles.json.
//   DEPENDS: M-SECTION-RUBRICS
//   LINKS: M-SECTION-CLI, V-M-SECTION-CLI
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   TOPICS - selectable criterion id to owning section id
//   loadRubric - rubric criteria list by section id, or null
//   loadProfiles - profile name to section id list
//   listRubrics - ids of all shipped rubrics
// END_MODULE_MAP
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, skillRoot } from './util.mjs';

export const TOPICS = Object.freeze({
  secrets: 'security',
  authn: 'security',
  'dead-code': 'hygiene',
  vulnerabilities: 'dependencies',
  freshness: 'dependencies',
});

const dirOf = (dir) => dir || join(skillRoot, 'rubrics');

export function loadRubric(id, dir) {
  if (!/^[a-z][a-z0-9-]*$/.test(String(id))) return null;
  const p = join(dirOf(dir), `${id}.json`);
  return existsSync(p) ? readJson(p) : null;
}

export function loadProfiles(dir) {
  return readJson(join(dirOf(dir), 'profiles.json'));
}

export function listRubrics(dir) {
  return readdirSync(dirOf(dir))
    .filter((f) => f.endsWith('.json') && f !== 'profiles.json')
    .map((f) => f.slice(0, -5))
    .sort();
}
