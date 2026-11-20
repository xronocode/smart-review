// START_MODULE_CONTRACT
//   PURPOSE: Report labels in English and Russian.
//   SCOPE: Static strings only; paths, identifiers, and commit IDs are never translated.
//   DEPENDS: none
//   LINKS: M-SECTION-CLI, V-M-SECTION-CLI
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   labels - label table for a language code, falling back to English
//   diffScoreLabel - describe the comparison allowed by the historical baseline
//   diffStatusLabel - include both owners when a finding changes sections
// END_MODULE_MAP
const en = {
  title: 'Repository review', overall: 'Overall score', commit: 'Commit', branch: 'Branch', profile: 'Profile', date: 'Date',
  band: { good: 'Good', fair: 'Needs work', poor: 'At risk' },
  scoreStatus: { 'insufficient-data': 'Insufficient data', 'not-applicable': 'Not applicable', 'external-only': 'Unscored external assessment' },
  route: { section: 'section', topic: 'topic', external: 'external assessment required, unscored' },
  externalTitle: 'External web assessment (unscored)', externalStatus: { 'external-assessment-required': 'External assessment required', 'metadata-supplied': 'User-supplied assessment metadata' },
  externalFields: { assessmentDate: 'Assessment date', scope: 'Assessment scope', deploymentId: 'Deployment ID',
    reference: 'Reference', documents: 'Document name', recordedAtCommit: 'Repository commit when recorded', sourceAttempt: 'Recorded in attempt' },
  coverage: 'Criteria assessed / applicable', scoredMean: 'Mean of scored sections', riskCap: 'Known risk',
  requestedTopics: 'Requested topics', findingTopics: 'Finding topics', reviewed: 'Reviewed this attempt',
  carried: 'Carried from', stale: 'Stale results',
  staleReasons: { version: 'Incompatible review version', language: 'Different report language',
    commit: 'Different commit', 'advisory-data': 'Advisory data requires a fresh check', 'external-data': 'External evidence requires a fresh check' },
  asOf: 'As of', unknownDate: 'date unknown',
  severity: { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info' },
  confidence: { high: 'high confidence', medium: 'medium confidence', low: 'low confidence' },
  findings: 'Findings', noFindings: 'No confirmed findings.', what: 'What was found', impact: 'Why it matters', fix: 'What to do',
  affected: 'Affected', evidence: 'Evidence', verify: 'How to verify the fix', verification: 'Verification pass',
  vresult: { confirmed: 'confirmed', downgraded: 'severity lowered', upgraded: 'severity raised' },
  summary: 'Summary', criteria: 'State by criterion', criteriaNote: 'Criteria show what was assessed. Findings determine the deductions.',
  na: 'n/a', unknown: 'not established', strengths: 'Strengths', unconfirmed: 'Open questions (not scored)',
  scoreCalc: 'Score calculation', overallCalc: 'Overall score calculation', meanOf: 'Mean of the sections that ran',
  base: 'Starting score', capped: 'Cap applied', capReason: { critical: 'a critical finding caps the score at', high: 'a high finding caps the score at' },
  overallCapReason: { critical: 'a critical finding caps the overall score at', high: 'a high finding caps the overall score at' },
  result: 'Result', notCounted: 'Not counted', reason: { info: 'informational', 'low-confidence': 'low confidence', 'accepted-risk': 'accepted risk' },
  changes: 'Changes since the previous run', prevCommit: 'previous commit', notComparable: 'Rubric or scoring version changed; scores are not directly comparable.',
  previouslyUnreviewed: 'Previously unreviewed', currentFindings: 'Current findings',
  status: { observed: 'Observed in this review', fixed: 'Fixed', 'still-present': 'Still present', 'not-reproduced': 'Not reproduced', new: 'New', 'missed-earlier': 'Existed before, missed by the previous run', unaccounted: 'Unaccounted' },
  checked: 'What was checked', limits: 'Limits', effect: 'Effect on the conclusion', tools: 'Tools',
  toolStatus: { used: 'used', absent: 'not installed', skipped: 'skipped' }, rubric: 'rubric', sections: 'Sections',
  dirty: 'The working tree had uncommitted changes; the review covers the commit only.',
  footer: 'Scores are computed by the smart-review CLI from confirmed findings only.', points: 'points', atMost: 'at most', mediumTotal: 'medium findings together at most', lowTotal: 'low findings together at most',
  sectionNames: { security: 'Security', tests: 'Tests', dependencies: 'Dependencies', 'ai-readiness': 'AI readiness', hygiene: 'Codebase hygiene',
    delivery: 'Delivery', integrations: 'External integrations', frontend: 'Frontend', database: 'Database', 'open-source': 'Open-source readiness' },
};
const ru = {
  title: 'Ревью репозитория', overall: 'Общий балл', commit: 'Коммит', branch: 'Ветка', profile: 'Профиль', date: 'Дата',
  band: { good: 'Хорошо', fair: 'Требует работы', poor: 'Под риском' },
  scoreStatus: { 'insufficient-data': 'Недостаточно данных', 'not-applicable': 'Неприменимо', 'external-only': 'Внешняя проверка без балла' },
  route: { section: 'секция', topic: 'тема', external: 'требуется внешняя проверка, без балла' },
  externalTitle: 'Внешняя проверка веб-приложения (без балла)', externalStatus: { 'external-assessment-required': 'Требуется внешняя проверка', 'metadata-supplied': 'Предоставлены сведения о внешней проверке' },
  externalFields: { assessmentDate: 'Дата проверки', scope: 'Область проверки', deploymentId: 'Идентификатор развёртывания',
    reference: 'Ссылка или номер отчёта', documents: 'Название документа', recordedAtCommit: 'Коммит репозитория при записи', sourceAttempt: 'Попытка, в которой сделана запись' },
  coverage: 'Оценено / применимо критериев', scoredMean: 'Среднее по секциям с оценкой', riskCap: 'Известный риск',
  requestedTopics: 'Запрошенные темы', findingTopics: 'Темы находки', reviewed: 'Проверено в этой попытке',
  carried: 'Перенесено из', stale: 'Устаревшие результаты',
  staleReasons: { version: 'Несовместимая версия проверки', language: 'Другой язык отчёта',
    commit: 'Другой коммит', 'advisory-data': 'Сведения об уязвимостях требуют повторной проверки', 'external-data': 'Внешние сведения требуют повторной проверки' },
  asOf: 'По состоянию на', unknownDate: 'дата неизвестна',
  severity: { critical: 'Критическая', high: 'Высокая', medium: 'Средняя', low: 'Низкая', info: 'К сведению' },
  confidence: { high: 'высокая уверенность', medium: 'средняя уверенность', low: 'низкая уверенность' },
  findings: 'Находки', noFindings: 'Подтверждённых находок нет.', what: 'Что обнаружено', impact: 'Чем это мешает', fix: 'Что сделать',
  affected: 'Затронуто', evidence: 'Доказательства', verify: 'Как проверить исправление', verification: 'Перепроверка',
  vresult: { confirmed: 'подтверждено', downgraded: 'серьёзность понижена', upgraded: 'серьёзность повышена' },
  summary: 'Краткий вывод', criteria: 'Состояние по критериям', criteriaNote: 'Критерии показывают, что удалось оценить. Вычеты зависят от находок.',
  na: 'неприменимо', unknown: 'не установлено', strengths: 'Сильные стороны', unconfirmed: 'Открытые вопросы (в оценку не входят)',
  scoreCalc: 'Расчёт оценки', overallCalc: 'Общий расчёт оценки', meanOf: 'Среднее по запущенным секциям',
  base: 'Исходная оценка', capped: 'Применён потолок', capReason: { critical: 'критическая находка ограничивает оценку значением', high: 'высокая находка ограничивает оценку значением' },
  overallCapReason: { critical: 'критическая находка ограничивает общий балл значением', high: 'высокая находка ограничивает общий балл значением' },
  result: 'Итог', notCounted: 'Не учтено', reason: { info: 'к сведению', 'low-confidence': 'низкая уверенность', 'accepted-risk': 'принятый риск' },
  changes: 'Изменения с прошлого запуска', prevCommit: 'прошлый коммит', notComparable: 'Версия рубрики или формулы изменилась; оценки напрямую не сравнимы.',
  previouslyUnreviewed: 'Ранее не проверялась', currentFindings: 'Текущие находки',
  status: { observed: 'Обнаружено при этой проверке', fixed: 'Исправлено', 'still-present': 'Осталось', 'not-reproduced': 'Не воспроизведено', new: 'Новая', 'missed-earlier': 'Существовала раньше, прошлый запуск пропустил', unaccounted: 'Не объяснено' },
  checked: 'Что проверено', limits: 'Ограничения', effect: 'Влияние на вывод', tools: 'Инструменты',
  toolStatus: { used: 'использован', absent: 'не установлен', skipped: 'пропущен' }, rubric: 'рубрика', sections: 'Секции',
  dirty: 'В рабочей копии были незакоммиченные изменения; ревью относится только к коммиту.',
  footer: 'Оценки считает CLI smart-review только по подтверждённым находкам.', points: 'баллов', atMost: 'не более', mediumTotal: 'средние находки вместе не более', lowTotal: 'низкие находки вместе не более',
  sectionNames: { security: 'Безопасность', tests: 'Тесты', dependencies: 'Зависимости', 'ai-readiness': 'Готовность к AI', hygiene: 'Гигиена кодовой базы',
    delivery: 'Поставка', integrations: 'Внешние интеграции', frontend: 'Фронтенд', database: 'База данных', 'open-source': 'Готовность к открытому распространению' },
};
export function labels(lang) {
  return lang === 'ru' ? ru : en;
}

export function diffScoreLabel(section, L, showDelta = false) {
  if (section.previouslyUnreviewed) return `${L.previouslyUnreviewed}. ${L.currentFindings}: ${section.items.length}.`;
  if (!section.comparable) return L.notComparable;
  const scores = `${section.scoreBefore ?? '—'} → ${section.scoreAfter ?? '—'}`;
  if (!showDelta || section.delta == null) return scores;
  return `${scores} (${section.delta > 0 ? '+' : ''}${section.delta})`;
}

export function diffStatusLabel(item, status) {
  return item.fromSection ? `${status} (${item.fromSection} → ${item.toSection})` : status;
}
