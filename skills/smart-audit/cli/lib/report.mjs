// START_MODULE_CONTRACT
//   PURPOSE: Render an audit run as Markdown and as one self-contained HTML file.
//   SCOPE: Pure rendering from run metadata, findings documents, rubrics, and an optional diff. No external resources.
//   DEPENDS: M-AUDIT-RUBRICS
//   LINKS: M-AUDIT-CLI, V-M-AUDIT-CLI
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   buildSummary - overall score and per-audit scores for a run
//   renderMarkdown - Markdown report
//   renderHtml - self-contained HTML report with light and dark themes
// END_MODULE_MAP
import { labels } from './i18n.mjs';
import { bandOf, WEIGHTS } from './score.mjs';
import { mean } from './util.mjs';

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const sorted = (fs) => [...fs].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.id.localeCompare(b.id));
const ev = (e) => `${e.path}:${e.line}${e.endLine ? `-${e.endLine}` : ''}`;

export function buildSummary(run, docs) {
  const audits = {};
  for (const [id, { doc }] of Object.entries(docs)) {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const f of doc.findings) counts[f.severity] += 1;
    audits[id] = { score: doc.score ? doc.score.value : null, band: doc.score ? doc.score.band : null, rubricVersion: doc.rubricVersion, findings: counts, verdict: doc.verdict };
  }
  const values = Object.values(audits).map((a) => a.score).filter((v) => v !== null);
  const overall = mean(values);
  return { commit: run.repo.commit, branch: run.repo.branch, profile: run.profile, scoringVersion: run.scoringVersion, overall, band: overall === null ? null : bandOf(overall), audits };
}

function criterionTitle(rubric, id, lang) {
  const c = rubric && rubric.criteria.find((x) => x.id === id);
  return c ? c.title[lang] || c.title.en : id;
}

function calcLines(score, L) {
  const lines = [`${L.base}: ${score.base}`];
  for (const s of score.steps) lines.push(`${L.severity[s.severity]}: ${s.count} × ${s.weight} = −${s.subtotal} → ${s.running}`);
  if (score.cap) lines.push(`${L.capped}: ${L.capReason[score.cap.reason]} ${score.cap.value}`);
  lines.push(`${L.result}: ${score.value}/100`);
  return lines;
}

// START_CONTRACT: renderMarkdown
//   PURPOSE: Produce the Markdown report for a run.
//   INPUTS: { run, docs, rubrics, summary, diff?: object, lang: string }
//   OUTPUTS: { string - Markdown text }
//   SIDE_EFFECTS: none
// END_CONTRACT: renderMarkdown
export function renderMarkdown({ run, docs, rubrics, summary, diff, lang }) {
  const L = labels(lang);
  const name = (id) => L.auditNames[id] || id;
  const o = [];
  o.push(`# ${L.title}: ${run.repo.name || ''}`.trim(), '');
  o.push(`**${L.overall}: ${summary.overall ?? '—'}/100** (${summary.band ? L.band[summary.band] : '—'})`, '');
  o.push(`- ${L.commit}: \`${run.repo.commit}\``, `- ${L.branch}: \`${run.repo.branch}\``, `- ${L.profile}: ${run.profile}`, `- ${L.date}: ${run.startedAt.slice(0, 10)}`, '');
  if (run.repo.dirty) o.push(`> ${L.dirty}`, '');
  o.push(`| ${L.audits} | /100 | ${L.findings} |`, '|---|---|---|');
  for (const [id, a] of Object.entries(summary.audits)) {
    const c = a.findings;
    const parts = ['critical', 'high', 'medium', 'low', 'info'].filter((s) => c[s]).map((s) => `${c[s]} ${L.severity[s].toLowerCase()}`);
    o.push(`| ${name(id)} | ${a.score ?? '—'} | ${parts.join(', ') || '—'} |`);
  }
  o.push('');
  for (const [id, { doc }] of Object.entries(docs)) {
    o.push(`## ${name(id)} — ${doc.score ? doc.score.value : '—'}/100`, '', `**${doc.verdict}**`, '', doc.summary, '');
    o.push(`### ${L.findings}`, '');
    if (!doc.findings.length) o.push(L.noFindings, '');
    for (const f of sorted(doc.findings)) {
      o.push(`#### ${f.id} · ${L.severity[f.severity]} · ${f.title}`, '');
      o.push(`- **${L.what}:** ${f.what}`, `- **${L.impact}:** ${f.impact}`, `- **${L.fix}:** ${f.fix}`);
      if (f.affected.length) o.push(`- **${L.affected}:** ${f.affected.join(' · ')}`);
      o.push(`- **${L.evidence}:** ${f.evidence.map((e) => `\`${ev(e)}\``).join(', ')}`);
      o.push(`- **${L.verify}:** ${f.verify.join('; ')}`);
      o.push(`- **${L.verification}:** ${L.vresult[f.verification.result]}, ${L.confidence[f.confidence]}. ${f.verification.note}`, '');
    }
    if (doc.unconfirmed.length) {
      o.push(`### ${L.unconfirmed}`, '');
      for (const u of doc.unconfirmed) o.push(`- **${u.title}.** ${u.note}`);
      o.push('');
    }
    o.push(`### ${L.criteria}`, '', L.criteriaNote, '', `| | /5 | |`, '|---|---|---|');
    for (const c of doc.criteria) {
      const s = c.status === 'scored' ? String(c.score) : c.status === 'na' ? L.na : L.unknown;
      o.push(`| ${criterionTitle(rubrics[id], c.id, lang)} | ${s} | ${c.note.replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`);
    }
    o.push('');
    if (doc.strengths.length) o.push(`### ${L.strengths}`, '', ...doc.strengths.map((s) => `- ${s}`), '');
    if (doc.score) {
      o.push(`### ${L.scoreCalc}`, '', ...calcLines(doc.score, L).map((l) => `- ${l}`));
      for (const n of doc.score.notCounted) o.push(`- ${L.notCounted}: ${n.id} (${L.reason[n.reason]})`);
      o.push('');
    }
    const d = diff && diff.audits[id];
    if (d && d.items.length) {
      o.push(`### ${L.changes}`, '', `${d.scoreBefore ?? '—'} → ${d.scoreAfter ?? '—'} (${L.prevCommit} \`${diff.previousCommit.slice(0, 12)}\`)`, '');
      if (!d.comparable) o.push(`> ${L.notComparable}`, '');
      for (const it of d.items) o.push(`- **${L.status[it.status]}:** ${it.title}${it.note ? ` — ${it.note}` : ''}`);
      o.push('');
    }
    o.push(`### ${L.checked}`, '', ...doc.checked.map((c) => `- **${c.area}.** ${c.note}`), '');
    o.push(`### ${L.limits}`, '', ...doc.limits.map((l) => `- ${l.text} — *${L.effect}:* ${l.effect}`), '');
    if (doc.tools.length) o.push(`### ${L.tools}`, '', ...doc.tools.map((t) => `- ${t.name}${t.version ? ` ${t.version}` : ''}: ${L.toolStatus[t.status]}${t.note ? ` — ${t.note}` : ''}`), '');
  }
  o.push('---', '', `${L.footer} smart-audit ${run.toolVersion}, scoring v${run.scoringVersion}.`, '');
  return o.join('\n');
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function ring(value, band, size = 120) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const v = value ?? 0;
  return `<svg class="ring ${band || ''}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${v}/100"><circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}"/><circle class="arc" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-dasharray="${((c * v) / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/><text x="50%" y="50%" dy=".35em" text-anchor="middle">${value ?? '—'}</text></svg>`;
}

const CSS = `:root{--bg:#f6f7f9;--card:#fff;--ink:#16181d;--mute:#5d6470;--line:#e2e5ea;--good:#1a8f4c;--fair:#b97a00;--poor:#c8322b;--critical:#8b1a16;--high:#c8322b;--medium:#b97a00;--low:#4b6a9b;--info:#6b7280;--chip:#eef0f4}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#101216;--card:#181b21;--ink:#e8eaee;--mute:#9aa2af;--line:#2a2f38;--good:#3fc57a;--fair:#e0a83a;--poor:#f0635b;--critical:#ff8a82;--high:#f0635b;--medium:#e0a83a;--low:#8fb0e6;--info:#9aa2af;--chip:#232831}}
:root[data-theme=dark]{--bg:#101216;--card:#181b21;--ink:#e8eaee;--mute:#9aa2af;--line:#2a2f38;--good:#3fc57a;--fair:#e0a83a;--poor:#f0635b;--critical:#ff8a82;--high:#f0635b;--medium:#e0a83a;--low:#8fb0e6;--info:#9aa2af;--chip:#232831}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:960px;margin:0 auto;padding:24px 16px 64px}h1{font-size:1.6rem;margin:0 0 4px}h2{font-size:1.3rem;margin:0}h3{font-size:1rem;margin:28px 0 10px;text-transform:uppercase;letter-spacing:.05em;color:var(--mute)}
code{font:.86em ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--chip);padding:1px 5px;border-radius:4px;overflow-wrap:anywhere}
.meta{color:var(--mute);font-size:.9rem;display:flex;flex-wrap:wrap;gap:4px 18px;margin-top:6px}
.hero{display:flex;gap:24px;align-items:center;flex-wrap:wrap;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px;margin-bottom:18px}
.ring .track{fill:none;stroke:var(--line);stroke-width:9}.ring .arc{fill:none;stroke:var(--mute);stroke-width:9;stroke-linecap:round}.ring text{font-size:2rem;font-weight:700;fill:var(--ink)}
.ring.good .arc{stroke:var(--good)}.ring.fair .arc{stroke:var(--fair)}.ring.poor .arc{stroke:var(--poor)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-bottom:26px}
.tile{display:block;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;text-decoration:none;color:inherit}.tile b{font-size:1.9rem;display:block;line-height:1.1}.tile span{color:var(--mute);font-size:.9rem}
.good{color:var(--good)}.fair{color:var(--fair)}.poor{color:var(--poor)}
section.audit{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px;margin-bottom:22px}
.ahead{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.ahead .ring text{font-size:1.5rem}.verdict{font-weight:600;margin:14px 0 6px}
.chip{display:inline-block;font-size:.78rem;font-weight:600;padding:2px 9px;border-radius:999px;background:var(--chip);white-space:nowrap}
.chip.critical{color:var(--critical)}.chip.high{color:var(--high)}.chip.medium{color:var(--medium)}.chip.low{color:var(--low)}.chip.info{color:var(--info)}
details.finding{border:1px solid var(--line);border-radius:10px;margin:10px 0;padding:0 14px}details.finding>summary{cursor:pointer;padding:12px 0;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;font-weight:600;list-style:none}details.finding>summary::-webkit-details-marker{display:none}
details.finding .fid{color:var(--mute);font-weight:400;font-size:.85rem}dl{margin:0 0 12px}dt{font-size:.8rem;text-transform:uppercase;letter-spacing:.04em;color:var(--mute);margin-top:10px}dd{margin:2px 0 0}
ul{padding-left:20px;margin:6px 0}.ev li{list-style:none;margin-left:-20px}
table{width:100%;border-collapse:collapse;font-size:.93rem}td,th{text-align:left;padding:7px 8px;border-top:1px solid var(--line);vertical-align:top}th{color:var(--mute);font-weight:500}
.bar{display:inline-block;width:64px;height:7px;border-radius:4px;background:var(--line);vertical-align:middle;margin-right:8px;overflow:hidden}.bar i{display:block;height:100%;background:var(--mute)}
.calc td:last-child{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.calc tr.total td{font-weight:700;border-top:2px solid var(--line)}
.note{color:var(--mute);font-size:.9rem}.warn{border-left:3px solid var(--fair);padding:6px 12px;background:var(--chip);border-radius:0 8px 8px 0;margin:10px 0}
footer{color:var(--mute);font-size:.85rem;margin-top:26px}@media print{details.finding{break-inside:avoid}}`;

// START_CONTRACT: renderHtml
//   PURPOSE: Produce one self-contained HTML report for a run.
//   INPUTS: { run, docs, rubrics, summary, diff?: object, lang: string }
//   OUTPUTS: { string - HTML document with inline CSS and SVG, no scripts, no external resources }
//   SIDE_EFFECTS: none
// END_CONTRACT: renderHtml
export function renderHtml({ run, docs, rubrics, summary, diff, lang }) {
  const L = labels(lang);
  const name = (id) => L.auditNames[id] || id;
  const h = [];
  h.push(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(L.title)}: ${esc(run.repo.name || '')}</title><style>${CSS}</style></head><body><main>`);
  h.push(`<div class="hero">${ring(summary.overall, summary.band)}<div><h1>${esc(L.title)}: ${esc(run.repo.name || '')}</h1><div class="${summary.band || ''}"><b>${esc(L.overall)}: ${summary.overall ?? '—'}/100 · ${summary.band ? esc(L.band[summary.band]) : '—'}</b></div><div class="meta"><span>${esc(L.commit)} <code>${esc(run.repo.commit.slice(0, 12))}</code></span><span>${esc(L.branch)} <code>${esc(run.repo.branch)}</code></span><span>${esc(L.profile)}: ${esc(run.profile)}</span><span>${esc(run.startedAt.slice(0, 10))}</span></div></div></div>`);
  if (run.repo.dirty) h.push(`<p class="warn">${esc(L.dirty)}</p>`);
  h.push('<div class="grid">');
  for (const [id, a] of Object.entries(summary.audits)) {
    const n = Object.values(a.findings).reduce((x, y) => x + y, 0);
    h.push(`<a class="tile" href="#${esc(id)}"><b class="${a.band || ''}">${a.score ?? '—'}</b>${esc(name(id))}<br><span>${n} · ${esc(L.findings.toLowerCase())}</span></a>`);
  }
  h.push('</div>');
  for (const [id, { doc }] of Object.entries(docs)) {
    const sc = doc.score;
    h.push(`<section class="audit" id="${esc(id)}"><div class="ahead">${ring(sc ? sc.value : null, sc ? sc.band : '', 84)}<div><h2>${esc(name(id))}</h2><span class="note">${esc(L.rubric)} ${esc(doc.rubricVersion)}</span></div></div>`);
    h.push(`<p class="verdict">${esc(doc.verdict)}</p><p>${esc(doc.summary)}</p>`);
    h.push(`<h3>${esc(L.findings)}</h3>`);
    if (!doc.findings.length) h.push(`<p class="note">${esc(L.noFindings)}</p>`);
    for (const f of sorted(doc.findings)) {
      h.push(`<details class="finding"><summary><span class="chip ${f.severity}">${esc(L.severity[f.severity])}</span><span>${esc(f.title)}</span><span class="fid">${esc(f.id)}</span></summary><dl>`);
      h.push(`<dt>${esc(L.what)}</dt><dd>${esc(f.what)}</dd><dt>${esc(L.impact)}</dt><dd>${esc(f.impact)}</dd><dt>${esc(L.fix)}</dt><dd>${esc(f.fix)}</dd>`);
      if (f.affected.length) h.push(`<dt>${esc(L.affected)}</dt><dd>${f.affected.map(esc).join(' · ')}</dd>`);
      h.push(`<dt>${esc(L.evidence)}</dt><dd><ul class="ev">${f.evidence.map((e) => `<li><code>${esc(ev(e))}</code>${e.note ? ` ${esc(e.note)}` : ''}</li>`).join('')}</ul></dd>`);
      h.push(`<dt>${esc(L.verify)}</dt><dd><ul>${f.verify.map((v) => `<li>${esc(v)}</li>`).join('')}</ul></dd>`);
      h.push(`<dt>${esc(L.verification)}</dt><dd>${esc(L.vresult[f.verification.result])}, ${esc(L.confidence[f.confidence])}. ${esc(f.verification.note)}</dd></dl></details>`);
    }
    if (doc.unconfirmed.length) h.push(`<h3>${esc(L.unconfirmed)}</h3><ul>${doc.unconfirmed.map((u) => `<li><b>${esc(u.title)}.</b> ${esc(u.note)}</li>`).join('')}</ul>`);
    if (sc) {
      h.push(`<h3>${esc(L.scoreCalc)}</h3><table class="calc"><tr><td>${esc(L.base)}</td><td></td><td>${sc.base}</td></tr>`);
      for (const s of sc.steps) h.push(`<tr><td><span class="chip ${s.severity}">${esc(L.severity[s.severity])}</span> ${s.count} × ${s.weight}</td><td>−${s.subtotal}</td><td>${s.running}</td></tr>`);
      if (sc.cap) h.push(`<tr><td>${esc(L.capped)}: ${esc(L.capReason[sc.cap.reason])} ${sc.cap.value}</td><td></td><td>${sc.cap.value}</td></tr>`);
      h.push(`<tr class="total"><td>${esc(L.result)}</td><td></td><td>${sc.value}/100</td></tr></table>`);
      if (sc.notCounted.length) h.push(`<p class="note">${esc(L.notCounted)}: ${sc.notCounted.map((n) => `${esc(n.id)} (${esc(L.reason[n.reason])})`).join(', ')}</p>`);
    }
    const d = diff && diff.audits[id];
    if (d && d.items.length) {
      const delta = d.delta === null ? '' : ` (${d.delta > 0 ? '+' : ''}${d.delta})`;
      h.push(`<h3>${esc(L.changes)}</h3><p><b>${d.scoreBefore ?? '—'} → ${d.scoreAfter ?? '—'}${delta}</b> <span class="note">${esc(L.prevCommit)} <code>${esc(diff.previousCommit.slice(0, 12))}</code></span></p>`);
      if (!d.comparable) h.push(`<p class="warn">${esc(L.notComparable)}</p>`);
      h.push(`<table>${d.items.map((it) => `<tr><td style="white-space:nowrap">${esc(L.status[it.status])}</td><td>${esc(it.title)}${it.note ? `<br><span class="note">${esc(it.note)}</span>` : ''}</td></tr>`).join('')}</table>`);
    }
    h.push(`<h3>${esc(L.criteria)}</h3><p class="note">${esc(L.criteriaNote)}</p><table>`);
    for (const c of doc.criteria) {
      const cell = c.status === 'scored' ? `<span class="bar"><i style="width:${c.score * 20}%"></i></span>${c.score}/5` : esc(c.status === 'na' ? L.na : L.unknown);
      h.push(`<tr><td><b>${esc(criterionTitle(rubrics[id], c.id, lang))}</b><br><span class="note">${esc(c.note)}</span></td><td style="white-space:nowrap">${cell}</td></tr>`);
    }
    h.push('</table>');
    if (doc.strengths.length) h.push(`<h3>${esc(L.strengths)}</h3><ul>${doc.strengths.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`);
    h.push(`<h3>${esc(L.checked)}</h3><ul>${doc.checked.map((c) => `<li><b>${esc(c.area)}.</b> ${esc(c.note)}</li>`).join('')}</ul>`);
    h.push(`<h3>${esc(L.limits)}</h3><ul>${doc.limits.map((l) => `<li>${esc(l.text)}<br><span class="note">${esc(L.effect)}: ${esc(l.effect)}</span></li>`).join('')}</ul>`);
    if (doc.tools.length) h.push(`<h3>${esc(L.tools)}</h3><ul>${doc.tools.map((t) => `<li><code>${esc(t.name)}</code>${t.version ? ` ${esc(t.version)}` : ''}: ${esc(L.toolStatus[t.status])}${t.note ? ` — ${esc(t.note)}` : ''}</li>`).join('')}</ul>`);
    h.push('</section>');
  }
  const w = WEIGHTS;
  h.push(`<footer>${esc(L.footer)} smart-audit ${esc(run.toolVersion)}, scoring v${esc(run.scoringVersion)}: −${w.critical}/−${w.high}/−${w.medium}/−${w.low} ${esc(L.points)}.</footer></main></body></html>\n`);
  return h.join('\n');
}
