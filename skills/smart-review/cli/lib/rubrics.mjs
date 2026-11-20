// START_MODULE_CONTRACT
//   PURPOSE: Map selectable topics to their sections and load shipped rubrics and profiles.
//   SCOPE: Read-only access to rubrics/*.json and rubrics/profiles.json.
//   DEPENDS: M-SECTION-RUBRICS
//   LINKS: M-SECTION-CLI, V-M-SECTION-CLI
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   reviewCatalog - list the user-facing choices, their labels and routes
//   TOPICS - selectable criterion id to owning section id
//   loadRubric - rubric criteria list by section id, or null
//   loadProfiles - profile name to section id list
//   listRubrics - ids of all shipped rubrics
// END_MODULE_MAP
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, skillRoot } from './util.mjs';

// A section owns itself; a null owner indicates an external assessment.
const choices = [
  ['security', 'security', 'Security', 'Безопасность'],
  ['web-pentest', null, 'Web penetration test', 'Веб-пентест'],
  ['api-access', 'security', 'Public API security', 'Защищённость публичного API'],
  ['ai-readiness', 'ai-readiness', 'AI readiness', 'Готовность к AI'],
  ['tests', 'tests', 'Tests', 'Тесты'],
  ['delivery', 'delivery', 'CI/CD maturity', 'Зрелость CI/CD'],
  ['hygiene', 'hygiene', 'Codebase hygiene', 'Гигиена кодовой базы'],
  ['configuration', 'hygiene', 'Configuration hygiene', 'Гигиена конфигурации'],
  ['dependencies', 'dependencies', 'Dependency hygiene', 'Гигиена зависимостей'],
  ['cognitive-debt', 'ai-readiness', 'Cognitive debt', 'Когнитивный долг'],
  ['dead-code', 'hygiene', 'Dead code', 'Мёртвый код'],
  ['database', 'database', 'Database query efficiency', 'Эффективность запросов БД'],
  ['open-source', 'open-source', 'Open-source readiness', 'Готовность к open source'],
  ['frontend-server', 'frontend', 'Frontend: server communication', 'Frontend: общение с сервером'],
  ['frontend-components', 'frontend', 'Frontend: components and design system', 'Frontend: компоненты и дизайн-система'],
  ['integrations', 'integrations', 'External integration reliability', 'Надёжность внешних интеграций'],
  ['unification', 'hygiene', 'Implementation consistency', 'Унификация реализаций'],
  ['complexity', 'hygiene', 'Complexity concentration', 'Концентрация сложности'],
  ['secrets', 'security', 'Secret handling', 'Обработка секретов'],
  ['authn', 'security', 'Authentication handling', 'Обработка аутентификации'],
  ['vulnerabilities', 'dependencies', 'Dependency vulnerabilities', 'Уязвимости зависимостей'],
  ['freshness', 'dependencies', 'Dependency freshness', 'Актуальность зависимостей'],
];

export function reviewCatalog() {
  return choices.map(([id, owner, en, ru]) => {
    const kind = owner === null ? 'external' : owner === id ? 'section' : 'topic';
    return { id, kind, owner, title: { en, ru } };
  });
}

export const TOPICS = Object.freeze(Object.fromEntries(
  choices.filter(([id, owner]) => owner && owner !== id).map(([id, owner]) => [id, owner]),
));

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
