# Run layout and CLI

## CLI location

The CLI ships inside the skill. From the directory that contains this skill's `SKILL.md`:

```
node <skill-dir>/cli/smart-review.mjs <command>
```

It needs Node.js 22 or newer and `git`, and has no other dependencies. Below, `smart-review`
stands for that command.

## Commands

| Command | What it does |
|---|---|
| `smart-review catalog --lang ru` / `smart-review catalog --json` | lists all 22 choices by ID, kind, title and owner (Russian labels or machine-readable inventory) |
| `smart-review rubrics` | lists sections, profiles, topic owners and scoring constants |
| `smart-review start --repo <path> [--sections a,b] [--topics a,b] [--external-assessment <file.json>] [--out <dir>] [--lang en\|ru] [--name <repo-name>]` | pins a new attempt to `HEAD` and prints its actual `reviewSections`, requested topics, compatible carried sections and `runDir`. Alternatively select a profile with `--profile quick\|full`. |
| `smart-review check <file> --repo <path>` | checks one `recon.json`, draft, or findings file on its own: schema, evidence on the commit, criteria coverage |
| `smart-review score <run-dir>` | computes scores for freshly reviewed sections |
| `smart-review lint <run-dir> --repo <path>` | verifies the run; exit code 1 on errors |
| `smart-review diff <run-dir>` | compares with the previous run, writes `diff.json` |
| `smart-review report <run-dir>` | renders the local summary, Markdown and HTML; publication requires `finish` |
| `smart-review finish <run-dir> --repo <path>` | scores fresh documents, verifies the whole attempt, computes the diff and publishes a complete report in the index |
| `smart-review rules` | lists lint rules |

The `full` profile selects ten sections. Recon determines the applicability of their
criteria. The `quick` profile selects security, tests and dependencies. A source topic selects
one full owner rubric, shared by all requested topics with that owner.

Full runs started with version 2.3.0 or later require an operation inventory and a
disposition for every reviewed operation. See [source coverage](source-coverage.md).
Quick or explicitly selected scopes can omit the inventory. Carried sections retain
the coverage recorded by their source attempt. Old reports do not establish how
many operations were traced.

For an external-only report use `start --repo . --topics web-pentest`. To also review
public API access, use `start --repo . --topics web-pentest,api-access`. Append
`--external-assessment <file.json>` to supply metadata for a previously performed
assessment. Without metadata the report identifies the need for an external assessment.
External status has no inspector, findings file or score. Assessment references are
recorded as supplied without fetching them or sending traffic to a deployment.

Supply a local JSON object with `assessmentDate` (calendar date) and `scope`. Optional
fields are `deploymentId`, `reference` and `documents` (document names). For example:

```json
{
  "assessmentDate": "2026-11-12",
  "scope": "Customer portal sign-in and account settings",
  "deploymentId": "portal-42",
  "reference": "Assessment A17"
}
```

In `run.externalAssessments["web-pentest"]`, `external-assessment-required` records a
request without metadata. `metadata-supplied` records the supplied description. The
entry identifies its `sourceAttempt` and `recordedAtCommit`. The commit identifies where
the metadata was recorded. An assessment's deployment ID and date describe what the
external assessor reviewed. A later source review can display that same-commit entry
as a historical, unscored assessment with its original date and provenance. The
deployment's correspondence to the commit would require separate evidence.

## Files

```
<out>/                         default: <repo>/.smart-review
  index.json                   history of finished runs
  .publications/<sequence>/    local publication records for concurrent and interrupted finishes
  accepted.json                accepted risks (optional, committed by the repository owner)
  runs/<commit-12>-<attempt>/
    run.json                   commit, branch, sections, rubric versions, previous run, accepted risks
    recon.json                 repository map for source inspection
    prior/<section>.findings.json  findings of an earlier pass on the same commit, kept by `start`
    drafts/<section>.draft.json  inspector output before verification
    <section>.findings.json      verified findings, scored by the CLI
    diff.json                  comparison with the previous run
    summary.json               coverage, scores and any external status
    report.md, report.html     human-readable reports
```

Each start has a new directory. The last entry for a commit in `index.json` points to the
latest successfully published attempt. Old commit-only directories can still be opened.
Historical reports use their stored
sections, scores and rubric/scoring versions. A missing new section or external status
means it was not recorded in that attempt. When comparing overall scores, disclose
differences in the included sections and versions. No migration or backfill is required.
On the same commit, requested sections get their latest original findings in `prior/` for investigation, even if an intervening report excluded that owner as stale.
Compatible unselected sections are copied with their original attempt recorded in `carried`.
Sections from another commit, rubric or scoring version, or language require fresh
inspection. For an observation based on mutable issuer data, identify the source and
snapshot in `checked[].note` and record its date in `checked[].asOf` (`YYYY-MM-DD`, or
`"unknown"` if undated). Effective branch protection, registry versions and advisory
snapshots can change at the same commit. A later selective run excludes that section
with stale reason `external-data` until re-inspected. The advisory-scanner freshness
check also applies to older dependency findings. Stale results do not enter the mean.
If two attempts start from the same result, only the first successful publication advances it;
start the other selection again to build on that result. A failed or interrupted attempt
does not change the published index. With `--out`, artifacts go to a separate output directory.

Publication prepares the next complete index on the same filesystem. An atomic directory
rename elects one attempt for each index position. An atomic file rename installs its index.
The position retains a small receipt so it cannot be claimed twice. A subsequent finish can
complete either rename after an interruption. Keep the index, receipts and runs together
when moving or restoring the output directory.

The review writes only inside `<out>`. If `<out>` is inside the repository, tell the user
whether `.smart-review/` is ignored or tracked; do not edit `.gitignore` yourself.

## Lint rules

`smart-review rules` prints the current list. A lint error means the result is not reportable.
Fix the cause in the findings document (wrong path, wrong line, missing criterion, missing
limits, unexplained previous finding), then run `finish` again. Never edit `score` by hand,
and never delete a finding only because its evidence line was wrong: correct the evidence.
