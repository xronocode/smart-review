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
| `smart-review rubrics` | lists sections, profiles, and scoring constants |
| `smart-review start --repo <path> [--profile quick\|full] [--sections a,b] [--out <dir>] [--lang en\|ru] [--name <repo-name>]` | pins the run to `HEAD`, writes `run.json`, prints it with `runDir` |
| `smart-review check <file> --repo <path>` | checks one `recon.json`, draft, or findings file on its own: schema, evidence on the commit, criteria coverage |
| `smart-review score <run-dir>` | writes `score` into every findings document |
| `smart-review lint <run-dir> --repo <path>` | verifies the run; exit code 1 on errors |
| `smart-review diff <run-dir>` | compares with the previous run, writes `diff.json` |
| `smart-review report <run-dir>` | writes `summary.json`, `report.md`, `report.html`, updates `index.json` |
| `smart-review finish <run-dir> --repo <path>` | `score` + `lint`; when lint passes, `diff` + `report` |
| `smart-review rules` | lists lint rules |

## Files

```
<out>/                         default: <repo>/.smart-review
  index.json                   history of finished runs
  accepted.json                accepted risks (optional, committed by the repository owner)
  runs/<commit-12>/
    run.json                   commit, branch, sections, rubric versions, previous run, accepted risks
    recon.json                 repository map
    prior/<section>.findings.json  findings of an earlier pass on the same commit, kept by `start`
    drafts/<section>.draft.json  inspector output before verification
    <section>.findings.json      verified findings, scored by the CLI
    diff.json                  comparison with the previous run
    summary.json               overall and per-section scores
    report.md, report.html     human-readable reports
```

A run is keyed by commit. Running `start` again on the same commit moves the earlier findings
to `prior/`, removes stale drafts and reports, and the new pass builds on them. With `--out`,
artifacts go to a directory outside the repository and the repository is left untouched.

The review writes only inside `<out>`. If `<out>` is inside the repository, tell the user
whether `.smart-review/` is ignored or tracked; do not edit `.gitignore` yourself.

## Lint rules

`smart-review rules` prints the current list. A lint error means the result is not reportable.
Fix the cause in the findings document (wrong path, wrong line, missing criterion, missing
limits, unexplained previous finding), then run `finish` again. Never edit `score` by hand,
and never delete a finding only because its evidence line was wrong: correct the evidence.
