#!/usr/bin/env python3
"""Structural checks for the smart-review skill: rubric prose and criteria lists agree,
profiles name real rubrics, every section has a plugin command and a row in SKILL.md,
schemas and manifests are valid JSON with one version, the README translations keep the
shape of README.md, and the scoring document states the constants the CLI uses."""
import json
import re
import sys
from pathlib import Path

root = Path(sys.argv[1] if len(sys.argv) > 1 else "skills/smart-review")
errors = []


def fail(msg):
    errors.append(msg)


rubrics = {}
for jf in sorted((root / "rubrics").glob("*.json")):
    if jf.name == "profiles.json":
        continue
    data = json.loads(jf.read_text(encoding="utf-8"))
    rid = jf.stem
    rubrics[rid] = data
    if data.get("id") != rid:
        fail(f"{jf}: id '{data.get('id')}' does not match file name")
    if not re.fullmatch(r"\d+\.\d+\.\d+", str(data.get("version", ""))):
        fail(f"{jf}: version must be MAJOR.MINOR.PATCH")
    for lang in ("en", "ru"):
        if not data.get("question", {}).get(lang) or not data.get("title", {}).get(lang):
            fail(f"{jf}: missing title or question in '{lang}'")
    ids = [c["id"] for c in data.get("criteria", [])]
    if len(ids) != len(set(ids)) or not ids:
        fail(f"{jf}: criteria ids must be unique and non-empty")
    for c in data.get("criteria", []):
        if not c.get("title", {}).get("en") or not c.get("title", {}).get("ru"):
            fail(f"{jf}: criterion '{c.get('id')}' needs en and ru titles")

    md = root / "rubrics" / f"{rid}.md"
    if not md.exists():
        fail(f"{md} missing")
        continue
    text = md.read_text(encoding="utf-8")
    front = re.match(r"---\n(.*?)\n---\n", text, re.S)
    meta = dict(re.findall(r"^(\w+):\s*(.+)$", front.group(1), re.M)) if front else {}
    if meta.get("id") != rid:
        fail(f"{md}: front matter id '{meta.get('id')}' does not match")
    if meta.get("version") != data.get("version"):
        fail(f"{md}: version {meta.get('version')} differs from {jf.name} {data.get('version')}")
    md_ids = re.findall(r"^### `([a-z0-9-]+)`", text, re.M)
    if md_ids != ids:
        fail(f"{md}: criteria headings {md_ids} differ from {jf.name} {ids}")
    if data["question"]["en"] not in text:
        fail(f"{md}: the question text differs from {jf.name}")
    for section in ("## Question", "## Scope", "## Method", "## Evidence rules", "## Severity anchors", "## Criteria", "## Common false positives"):
        if section not in text:
            fail(f"{md}: section '{section}' missing")

profiles = json.loads((root / "rubrics" / "profiles.json").read_text(encoding="utf-8"))
for name, ids in profiles.items():
    for rid in ids:
        if rid not in rubrics:
            fail(f"profiles.json: profile '{name}' names unknown rubric '{rid}'")
for required in ("quick", "full"):
    if required not in profiles:
        fail(f"profiles.json: profile '{required}' missing")

for jf in list((root / "schemas").glob("*.json")) + [Path(".claude-plugin/plugin.json"), Path(".claude-plugin/marketplace.json"), Path("package.json")]:
    try:
        json.loads(jf.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        fail(f"{jf}: invalid JSON ({e})")

score_src = (root / "cli" / "lib" / "score.mjs").read_text(encoding="utf-8")
scoring_doc = (root / "reference" / "scoring.md").read_text(encoding="utf-8")
w = dict(re.findall(r"(critical|high|medium|low): (\d+)", re.search(r"WEIGHTS = \{(.*?)\}", score_src).group(1)))
caps = dict(re.findall(r"(critical|high): (\d+)", re.search(r"CAPS = \{(.*?)\}", score_src).group(1)))
formula = f"100 − {w['critical']}·critical − {w['high']}·high − {w['medium']}·medium − {w['low']}·low"
if formula not in scoring_doc:
    fail(f"reference/scoring.md does not state the CLI formula: {formula}")
for sev, cap in caps.items():
    if f"min(score, {cap})" not in scoring_doc:
        fail(f"reference/scoring.md does not state the {sev} cap {cap}")
low_max = re.search(r"LOW_TOTAL_MAX = (\d+)", score_src).group(1)
if f"low findings together deduct at most {low_max}" not in scoring_doc:
    fail(f"reference/scoring.md does not state the low-findings limit {low_max}")
version = re.search(r"SCORING_VERSION = '(\w+)'", score_src).group(1)
if f"scoring version `{version}`" not in scoring_doc:
    fail("reference/scoring.md does not name the current scoring version")

pkg = json.loads(Path("package.json").read_text(encoding="utf-8"))
tool = re.search(r"TOOL_VERSION = '([\d.]+)'", (root / "cli" / "lib" / "util.mjs").read_text(encoding="utf-8")).group(1)
if pkg.get("version") != tool:
    fail(f"package.json version {pkg.get('version')} differs from CLI TOOL_VERSION {tool}")
plugin = json.loads(Path(".claude-plugin/plugin.json").read_text(encoding="utf-8"))
market = json.loads(Path(".claude-plugin/marketplace.json").read_text(encoding="utf-8"))
versions = {"plugin.json": plugin.get("version"), "marketplace metadata": market.get("metadata", {}).get("version"),
            "marketplace plugin": market["plugins"][0].get("version")}
for where, v in versions.items():
    if v != pkg.get("version"):
        fail(f"{where} version {v} differs from package.json {pkg.get('version')}")

skill_text = (root / "SKILL.md").read_text(encoding="utf-8")
if not re.search(r"^name: smart-review$", skill_text, re.M):
    fail("SKILL.md: the skill name must stay 'smart-review' so that existing installs upgrade in place")
for sid in sorted(rubrics) + ["changes"]:
    if not Path("commands", f"{sid}.md").exists():
        fail(f"commands/{sid}.md missing: every section needs a plugin command")
    if f"| `{sid}` |" not in skill_text:
        fail(f"SKILL.md: section '{sid}' is not in the sections table")
for cmd in ("full", "quick", "update"):
    if not Path("commands", f"{cmd}.md").exists():
        fail(f"commands/{cmd}.md missing")
for cmd in sorted(Path("commands").glob("*.md")):
    if not re.match(r"---\ndescription: \".+\"\n", cmd.read_text(encoding="utf-8")):
        fail(f"{cmd}: front matter must start with a quoted description")

readme = Path("README.md").read_text(encoding="utf-8")


def shape(text):
    return {
        "headings": len(re.findall(r"^#{2,3} ", text, re.M)),
        "code blocks": len(re.findall(r"^```", text, re.M)) // 2,
        "link targets": sorted(set(re.findall(r"\]\(([^)]+)\)", text)) - {"README.md", "README.ru.md", "README.zh-CN.md", "README.es.md"}),
    }


for tr in ("README.ru.md", "README.zh-CN.md", "README.es.md"):
    if not Path(tr).exists():
        fail(f"{tr} missing: the README ships in four languages")
        continue
    want, have = shape(readme), shape(Path(tr).read_text(encoding="utf-8"))
    for key in want:
        if want[key] != have[key]:
            fail(f"{tr}: {key} differ from README.md; translate the change or the files drift apart")

if pkg.get("dependencies") or pkg.get("devDependencies"):
    fail("package.json must not declare dependencies")

if errors:
    print("\n".join(f"FAIL: {e}" for e in errors))
    sys.exit(1)
print(f"rubrics OK: {', '.join(sorted(rubrics))} ({sum(len(r['criteria']) for r in rubrics.values())} criteria)")
