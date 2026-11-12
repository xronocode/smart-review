// START_MODULE_CONTRACT
//   PURPOSE: Deterministic 0-100 score for one section, computed only from its findings.
//   SCOPE: Deductions by severity, caps, bands, and the overall mean. No model judgment, no IO.
//   DEPENDS: none
//   LINKS: M-SECTION-CLI, V-M-SECTION-CLI
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   SCORING_VERSION - version of the weights and caps below
//   SEVERITIES - severity names from most to least severe
//   WEIGHTS - points deducted per counted finding of each severity
//   CAPS - highest score allowed with a critical or a high finding
//   MEDIUM_TOTAL_MAX - largest total deduction for medium findings
//   LOW_TOTAL_MAX - largest total deduction for low findings
//   BANDS - score bands and their lower bounds
//   bandOf - band name for a 0-100 value
//   computeScore - score object for a findings document
//   overallCap - the cap the overall score inherits from the sections that ran
// END_MODULE_MAP

export const SCORING_VERSION = '3';
export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
export const WEIGHTS = { critical: 40, high: 15, medium: 6, low: 2, info: 0 };
export const CAPS = { critical: 39, high: 69 };
// Medium findings together never deduct more than this, so medium findings alone can
// never push the score out of the good band (100 - 30 = 70).
export const MEDIUM_TOTAL_MAX = 30;
// Low findings together never deduct more than this: less than one high finding.
export const LOW_TOTAL_MAX = 14;
const TOTAL_MAX = { medium: MEDIUM_TOTAL_MAX, low: LOW_TOTAL_MAX };
export const BANDS = [
  { name: 'good', min: 70 },
  { name: 'fair', min: 40 },
  { name: 'poor', min: 0 },
];

export function bandOf(value) {
  return BANDS.find((b) => value >= b.min).name;
}

// START_CONTRACT: computeScore
//   PURPOSE: Turn confirmed findings into a score with a step-by-step breakdown a reader can redo by hand.
//   INPUTS: { doc: findings document, accepted?: Array<{section, key}> - accepted-risk entries }
//   OUTPUTS: { score object: scoringVersion, base, steps, raw, cap, value, band, notCounted }
//   SIDE_EFFECTS: none
// END_CONTRACT: computeScore
export function computeScore(doc, accepted = []) {
  const acceptedKeys = new Set(accepted.filter((a) => a.section === doc.section).map((a) => a.key));
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  const notCounted = [];
  // START_BLOCK_CLASSIFY_FINDINGS
  for (const f of doc.findings || []) {
    if (f.severity === 'info') {
      notCounted.push({ id: f.id, reason: 'info' });
    } else if (f.confidence === 'low') {
      notCounted.push({ id: f.id, reason: 'low-confidence' });
    } else if (acceptedKeys.has(f.key) && (f.severity === 'low' || f.severity === 'medium')) {
      notCounted.push({ id: f.id, reason: 'accepted-risk' });
    } else {
      counts[f.severity] += 1;
    }
  }
  // END_BLOCK_CLASSIFY_FINDINGS
  const steps = [];
  let running = 100;
  for (const sev of ['critical', 'high', 'medium', 'low']) {
    if (!counts[sev]) continue;
    const full = counts[sev] * WEIGHTS[sev];
    const limit = TOTAL_MAX[sev];
    const subtotal = limit === undefined ? full : Math.min(full, limit);
    running -= subtotal;
    const step = { severity: sev, count: counts[sev], weight: WEIGHTS[sev], subtotal, running: Math.max(0, running) };
    if (subtotal < full) step.limited = limit;
    steps.push(step);
  }
  const raw = Math.max(0, running);
  let cap = null;
  if (counts.critical && raw > CAPS.critical) cap = { value: CAPS.critical, reason: 'critical' };
  else if (!counts.critical && counts.high && raw > CAPS.high) cap = { value: CAPS.high, reason: 'high' };
  const value = cap ? cap.value : raw;
  return { scoringVersion: SCORING_VERSION, base: 100, steps, raw, cap, value, band: bandOf(value), notCounted };
}

// START_CONTRACT: overallCap
//   PURPOSE: The band cap the overall score inherits, so the per-section promises hold at the run level too.
//   INPUTS: { scores: Array - per-section score objects, or null for sections without a score }
//   OUTPUTS: { { value, reason } | null - 39 with a counted critical in any section, otherwise 69 with a counted high }
//   SIDE_EFFECTS: none
// END_CONTRACT: overallCap
export function overallCap(scores) {
  let cap = null;
  for (const s of scores || []) {
    if (!s) continue;
    const counted = Object.fromEntries((s.steps || []).map((t) => [t.severity, t.count]));
    if (counted.critical) return { value: CAPS.critical, reason: 'critical' };
    if (counted.high) cap = { value: CAPS.high, reason: 'high' };
  }
  return cap;
}
