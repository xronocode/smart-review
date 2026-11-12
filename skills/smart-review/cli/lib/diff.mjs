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

// START_CONTRACT: diffRuns
//   PURPOSE: Classify findings as fixed, still-present, not-reproduced, new, or missed-earlier.
//   INPUTS: { current: {run, docs}, previous: {run, docs} }
//   OUTPUTS: { previousCommit, commit, sections: { [id]: { scoreBefore, scoreAfter, delta, comparable, items } } }
//   SIDE_EFFECTS: none
// END_CONTRACT: diffRuns
export function diffRuns(current, previous) {
  const sections = {};
  for (const [id, { doc }] of Object.entries(current.docs)) {
    const prev = previous.docs[id] && previous.docs[id].doc;
    if (!prev) {
      sections[id] = { scoreBefore: null, scoreAfter: doc.score ? doc.score.value : null, delta: null, comparable: false, items: [] };
      continue;
    }
    const nowKeys = new Map(doc.findings.map((f) => [f.key, f]));
    const notes = new Map((doc.previous || []).map((p) => [p.key, p]));
    const items = [];
    // START_BLOCK_CLASSIFY_PREVIOUS
    for (const pf of prev.findings) {
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
    const prevKeys = new Set(prev.findings.map((f) => f.key));
    for (const f of doc.findings) {
      if (!prevKeys.has(f.key)) items.push({ key: f.key, title: f.title, severity: f.severity, status: f.origin === 'missed-earlier' ? 'missed-earlier' : 'new' });
    }
    const before = prev.score ? prev.score.value : null;
    const after = doc.score ? doc.score.value : null;
    sections[id] = {
      scoreBefore: before,
      scoreAfter: after,
      delta: before === null || after === null ? null : after - before,
      comparable: prev.rubricVersion === doc.rubricVersion && (!prev.score || !doc.score || prev.score.scoringVersion === doc.score.scoringVersion),
      items,
    };
  }
  return { previousCommit: previous.run.repo.commit, commit: current.run.repo.commit, sections };
}
