// START_MODULE_CONTRACT
//   PURPOSE: Compare a review run with the previous run, finding by finding.
//   SCOPE: Pure comparison of two sets of findings documents matched by stable finding keys.
//   DEPENDS: none
//   LINKS: M-SECTION-CLI, V-M-SECTION-CLI
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   diffRuns - per-section classification of findings and score deltas between two runs
// END_MODULE_MAP

// Finding keys are section-local unless the former owner acknowledges a transfer.
// A null entry means more than one finding in this run uses the key.
function uniqueFindings(docs) {
  const byKey = new Map();
  for (const [section, { doc }] of Object.entries(docs)) {
    for (const finding of doc.findings) {
      byKey.set(finding.key, byKey.has(finding.key) ? null : { section, finding });
    }
  }
  return byKey;
}

function ownerTransfers(current, previous) {
  const before = uniqueFindings(previous.docs);
  const after = uniqueFindings(current.docs);
  const transfers = new Map();
  for (const [section, { doc }] of Object.entries(current.docs)) {
    for (const { key, status, note } of doc.previous || []) {
      const prior = before.get(key), next = after.get(key);
      if (status === 'still-present' && prior?.section === section && next && next.section !== section) {
        transfers.set(key, { fromSection: section, toSection: next.section, severityBefore: prior.finding.severity, note });
      }
    }
  }
  return transfers;
}

// START_CONTRACT: diffRuns
//   PURPOSE: Classify findings as fixed, still-present, not-reproduced, new, or missed-earlier.
//   INPUTS: { current: {run, docs}, previous: {run, docs} }
//   OUTPUTS: { previousCommit, commit, sections: { [id]: { previouslyUnreviewed, scoreBefore, scoreAfter, delta, comparable, items } } }
//   SIDE_EFFECTS: none
// END_CONTRACT: diffRuns
export function diffRuns(current, previous) {
  const sections = {};
  const transfers = ownerTransfers(current, previous);
  for (const [id, { doc }] of Object.entries(current.docs)) {
    const prev = previous.docs[id]?.doc;
    const priorFindings = prev?.findings ?? [];
    const nowKeys = new Map(doc.findings.map((f) => [f.key, f]));
    const notes = new Map((doc.previous || []).map((p) => [p.key, p]));
    const items = [];
    // START_BLOCK_CLASSIFY_PREVIOUS
    for (const pf of priorFindings) {
      if (transfers.has(pf.key)) continue; // Report the finding once, under its current owner.
      const base = { key: pf.key, title: pf.title, severity: pf.severity };
      if (nowKeys.has(pf.key)) {
        const nf = nowKeys.get(pf.key);
        items.push({ ...base, status: 'still-present', title: nf.title, severity: nf.severity, severityBefore: pf.severity });
      } else if (notes.has(pf.key)) {
        const n = notes.get(pf.key);
        items.push({ ...base, status: n.status === 'still-present' ? 'not-reproduced' : n.status, note: n.note });
      } else {
        items.push({ ...base, status: 'unaccounted' });
      }
    }
    // END_BLOCK_CLASSIFY_PREVIOUS
    const prevKeys = new Set(priorFindings.map((f) => f.key));
    for (const f of doc.findings) {
      if (prevKeys.has(f.key)) continue;
      const item = { key: f.key, title: f.title, severity: f.severity };
      const transfer = transfers.get(f.key);
      if (transfer) items.push({ ...item, status: 'still-present', ...transfer });
      else if (!prev) items.push({ ...item, status: 'observed' });
      else items.push({ ...item, status: f.origin === 'missed-earlier' ? 'missed-earlier' : 'new' });
    }
    const before = prev?.score?.value ?? null;
    const after = doc.score?.value ?? null;
    const comparable = Boolean(prev) && prev.rubricVersion === doc.rubricVersion &&
      (prev.score?.scoringVersion ?? previous.run.scoringVersion) === (doc.score?.scoringVersion ?? current.run.scoringVersion);
    sections[id] = {
      previouslyUnreviewed: !prev,
      scoreBefore: before,
      scoreAfter: after,
      delta: comparable && before !== null && after !== null ? after - before : null,
      comparable,
      items,
    };
  }
  return { previousCommit: previous.run.repo.commit, commit: current.run.repo.commit, sections };
}
