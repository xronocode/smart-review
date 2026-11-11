# Findings contract

Every audit produces one JSON document, `<audit>.findings.json`, that must validate against
`schemas/findings.schema.json` and pass `smart-audit lint`. This file explains what each part
must contain. The schema says what is *allowed*; this says what is *good*.

## Document fields

| Field | Content |
|---|---|
| `schemaVersion` | `1` |
| `audit` | rubric id, equal to the file name prefix |
| `rubricVersion` | `version` from the rubric you used |
| `commit` | full 40-character SHA from `run.json` |
| `lang` | `en` or `ru`: the language of all prose in this document |
| `verdict` | one sentence that answers the audit question; it is the report headline |
| `summary` | one short paragraph: the main risk, what to do first, the main strengths, the main limit |
| `findings` | confirmed problems (see below) |
| `unconfirmed` | suspicions you could not confirm; never scored |
| `criteria` | exactly one entry per rubric criterion |
| `strengths` | controls and practices worth keeping, each a concrete sentence |
| `checked` | what you actually traced, as `{area, note}` |
| `limits` | what you did not run or read, as `{text, effect}` |
| `tools` | every optional tool named by the rubric, as `used`, `absent`, or `skipped` |
| `previous` | accounting for the previous run's findings (only when a previous run exists) |
| `score` | **written by the CLI only.** Never write or edit it. |

## A finding

A finding is a confirmed, independent problem with evidence on the audited commit.

| Field | Rule |
|---|---|
| `id` | `F-001`, `F-002`, … in order of severity |
| `key` | stable kebab-case name of the *root cause*, e.g. `preview-renders-active-html`. It identifies the finding across runs: reuse the previous run's key when the root cause is the same, and do not put line numbers or counts in it |
| `title` | what is wrong, in plain words, without severity words |
| `severity` | `critical`, `high`, `medium`, `low`, or `info`, using the rubric's anchors |
| `confidence` | `high`: you read the whole path. `medium`: the path is clear but one link is inferred. `low`: plausible but unproven — prefer `unconfirmed` |
| `what` | the mechanism: which input, through which code, reaches what |
| `impact` | what it costs or allows, under which condition, and what it does **not** allow |
| `fix` | the direction of the fix and what to preserve while fixing; not a patch |
| `affected` | product areas or user-visible functions touched |
| `evidence` | one or more `{path, line}` on the audited commit; start with the line where the problem is, then supporting lines |
| `verify` | observable checks that will be true once it is fixed |
| `origin` | only with a previous run: `missed-earlier` if the problem already existed at the previous commit, otherwise `new` |
| `verification` | written by the verification pass: `{result, note}` |

Rules that keep findings honest:

- **One root cause, one finding.** Five symptoms of one missing check are one finding with five evidence lines.
- **No evidence, no finding.** If you cannot point to a line, it goes to `unconfirmed` or to a criterion note.
- **Absence is not a finding by itself.** A missing defense or practice becomes a finding only with a concrete consequence.
- **Do not inflate.** Severity follows the rubric anchors and the real precondition, not how alarming the category sounds.
- **Do not repeat across audits.** If another rubric owns the topic, leave it to that audit.
- **Paths are repository-relative**, with forward slashes, exactly as `git ls-files` prints them.
- **Never include a secret value.** Describe its kind and location.

## Criteria

One entry per criterion id of the rubric, no more, no fewer.

- `status: "scored"` with `score` 0–5: 5 strong evidence and no gap; 4 good with a minor gap; 3 partial or uneven; 2 weak; 1 nominal; 0 absent or misleading.
- `status: "na"`: the criterion does not apply to this repository. Say why in `note`.
- `status: "unknown"`: you could not establish it from available evidence. Say what is missing in `note`.

`note` is one or two sentences of repository-specific evidence. Criteria describe the state; they never change the score, so do not use them to hide or double-count a finding.

## Checked and limits

`checked` lists what you traced, concretely enough that a reader could repeat it ("read all 7 workflow files", "traced 12 IPC commands from registration to handler"). Give counts.

`limits` lists what bounds the conclusion. Each has `text` (what was not done) and `effect` (what the reader therefore cannot conclude). At least one limit always exists: a static read is never complete.

## Previous run

When `run.json` has `previous`, read the previous `<audit>.findings.json` first.

- Same root cause still present: keep the same `key`.
- Previous finding no longer present: add `{key, status, note}` to `previous` with `fixed` (you saw the change that fixed it) or `not-reproduced` (you could not find it again and cannot point to a fix).
- A problem you found now that already existed at the previous commit: set `origin: "missed-earlier"`. Check with `git show <previous-commit>:<path>`.

Lint fails if a previous finding is neither still present nor explained.

## Minimal example

```json
{
  "schemaVersion": 1,
  "audit": "security",
  "rubricVersion": "1.0.0",
  "commit": "0123456789abcdef0123456789abcdef01234567",
  "lang": "en",
  "verdict": "One medium problem in the preview extension; no high or critical issues.",
  "summary": "The preview extension renders document HTML without sanitizing it…",
  "findings": [
    {
      "id": "F-001",
      "key": "preview-renders-active-html",
      "title": "Preview extension runs active HTML from the previewed document",
      "severity": "medium",
      "confidence": "high",
      "what": "render() passes the document body to the webview without sanitizing…",
      "impact": "Previewing an untrusted file can run script in the preview webview… The OS sandbox prevents file and process access.",
      "fix": "Sanitize or disable raw HTML in the preview renderer and add a restrictive content policy; keep the main editor's sanitizer unchanged.",
      "affected": ["File preview"],
      "evidence": [{ "path": "preview/Renderer.swift", "line": 42 }],
      "verify": ["A document containing a script tag shows it as text in the preview."],
      "verification": { "result": "confirmed", "note": "Re-read Renderer.swift:30-60; no sanitizer on this path." }
    }
  ],
  "unconfirmed": [],
  "criteria": [{ "id": "secrets", "status": "scored", "score": 5, "note": "No key formats in 412 tracked text files." }],
  "strengths": ["The main editor sanitizes pasted and rendered HTML."],
  "checked": [{ "area": "Entry points", "note": "Traced 14 IPC commands from registration to handler." }],
  "limits": [{ "text": "Nothing was executed.", "effect": "Runtime behavior of the sandbox is not confirmed." }],
  "tools": [{ "name": "gitleaks", "status": "absent" }]
}
```

(The example lists one criterion for brevity; a real document lists all of them.)
