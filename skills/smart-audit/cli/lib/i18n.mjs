// START_MODULE_CONTRACT
//   PURPOSE: Report labels in English and Russian.
//   SCOPE: Static strings only; paths, identifiers, and commit IDs are never translated.
//   DEPENDS: none
//   LINKS: M-AUDIT-CLI, V-M-AUDIT-CLI
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   labels - label table for a language code, falling back to English
// END_MODULE_MAP
const en = {
  title: 'Repository audit', overall: 'Overall score', commit: 'Commit', branch: 'Branch', profile: 'Profile', date: 'Date',
  band: { good: 'Good', fair: 'Needs work', poor: 'At risk' },
  severity: { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info' },
  confidence: { high: 'high confidence', medium: 'medium confidence', low: 'low confidence' },
  findings: 'Findings', noFindings: 'No confirmed findings.', what: 'What was found', impact: 'Why it matters', fix: 'What to do',
  affected: 'Affected', evidence: 'Evidence', verify: 'How to verify the fix', verification: 'Verification pass',
  vresult: { confirmed: 'confirmed', downgraded: 'severity lowered', upgraded: 'severity raised' },
  summary: 'Summary', criteria: 'State by criterion', criteriaNote: 'Criteria describe the state; they do not change the score.',
  na: 'n/a', unknown: 'not established', strengths: 'Strengths', unconfirmed: 'Open questions (not scored)',
  scoreCalc: 'Score calculation', overallCalc: 'Overall score calculation', meanOf: 'Mean of the audits that ran',
  base: 'Starting score', capped: 'Cap applied', capReason: { critical: 'a critical finding caps the score at', high: 'a high finding caps the score at' },
  overallCapReason: { critical: 'a critical finding caps the overall score at', high: 'a high finding caps the overall score at' },
  result: 'Result', notCounted: 'Not counted', reason: { info: 'informational', 'low-confidence': 'low confidence', 'accepted-risk': 'accepted risk' },
  changes: 'Changes since the previous run', prevCommit: 'previous commit', notComparable: 'Rubric or scoring version changed; scores are not directly comparable.',
  status: { fixed: 'Fixed', 'still-present': 'Still present', 'not-reproduced': 'Not reproduced', new: 'New', 'missed-earlier': 'Existed before, missed by the previous run', unaccounted: 'Unaccounted' },
  checked: 'What was checked', limits: 'Limits', effect: 'Effect on the conclusion', tools: 'Tools',
  toolStatus: { used: 'used', absent: 'not installed', skipped: 'skipped' }, rubric: 'rubric', audits: 'Audits',
  dirty: 'The working tree had uncommitted changes; the audit covers the commit only.',
  footer: 'Scores are computed by the smart-audit CLI from confirmed findings only.', points: 'points', atMost: 'at most', mediumTotal: 'medium findings together at most', lowTotal: 'low findings together at most',
  auditNames: { security: 'Security', tests: 'Tests', dependencies: 'Dependencies', 'ai-readiness': 'AI readiness', hygiene: 'Codebase hygiene' },
};
const ru = {
  title: 'Аудит репозитория', overall: 'Общий балл', commit: 'Коммит', branch: 'Ветка', profile: 'Профиль', date: 'Дата',
  band: { good: 'Хорошо', fair: 'Требует работы', poor: 'Под риском' },
  severity: { critical: 'Критическая', high: 'Высокая', medium: 'Средняя', low: 'Низкая', info: 'К сведению' },
  confidence: { high: 'высокая уверенность', medium: 'средняя уверенность', low: 'низкая уверенность' },
  findings: 'Находки', noFindings: 'Подтверждённых находок нет.', what: 'Что обнаружено', impact: 'Чем это мешает', fix: 'Что сделать',
  affected: 'Затронуто', evidence: 'Доказательства', verify: 'Как проверить исправление', verification: 'Перепроверка',
  vresult: { confirmed: 'подтверждено', downgraded: 'серьёзность понижена', upgraded: 'серьёзность повышена' },
  summary: 'Краткий вывод', criteria: 'Состояние по критериям', criteriaNote: 'Критерии описывают состояние и не меняют оценку.',
  na: 'неприменимо', unknown: 'не установлено', strengths: 'Сильные стороны', unconfirmed: 'Открытые вопросы (в оценку не входят)',
  scoreCalc: 'Расчёт оценки', overallCalc: 'Общий расчёт оценки', meanOf: 'Среднее по запущенным аудитам',
  base: 'Исходная оценка', capped: 'Применён потолок', capReason: { critical: 'критическая находка ограничивает оценку значением', high: 'высокая находка ограничивает оценку значением' },
  overallCapReason: { critical: 'критическая находка ограничивает общий балл значением', high: 'высокая находка ограничивает общий балл значением' },
  result: 'Итог', notCounted: 'Не учтено', reason: { info: 'к сведению', 'low-confidence': 'низкая уверенность', 'accepted-risk': 'принятый риск' },
  changes: 'Изменения с прошлого запуска', prevCommit: 'прошлый коммит', notComparable: 'Версия рубрики или формулы изменилась; оценки напрямую не сравнимы.',
  status: { fixed: 'Исправлено', 'still-present': 'Осталось', 'not-reproduced': 'Не воспроизведено', new: 'Новая', 'missed-earlier': 'Существовала раньше, прошлый запуск пропустил', unaccounted: 'Не объяснено' },
  checked: 'Что проверено', limits: 'Ограничения', effect: 'Влияние на вывод', tools: 'Инструменты',
  toolStatus: { used: 'использован', absent: 'не установлен', skipped: 'пропущен' }, rubric: 'рубрика', audits: 'Аудиты',
  dirty: 'В рабочей копии были незакоммиченные изменения; аудит относится только к коммиту.',
  footer: 'Оценки считает CLI smart-audit только по подтверждённым находкам.', points: 'баллов', atMost: 'не более', mediumTotal: 'средние находки вместе не более', lowTotal: 'низкие находки вместе не более',
  auditNames: { security: 'Безопасность', tests: 'Тесты', dependencies: 'Зависимости', 'ai-readiness': 'Готовность к AI', hygiene: 'Гигиена кодовой базы' },
};
export function labels(lang) {
  return lang === 'ru' ? ru : en;
}
