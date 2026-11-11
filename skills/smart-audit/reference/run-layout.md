# Run layout and CLI

## CLI location

The CLI ships inside the skill. From the directory that contains this skill's `SKILL.md`:

```
node <skill-dir>/cli/smart-audit.mjs <command>
```

It needs Node.js 22 or newer and `git`, and has no other dependencies. Below, `smart-audit`
stands for that command.

## Commands

| Command | What it does |
|---|---|
| `smart-audit rubrics` | lists audits, profiles, and scoring constants |
| `smart-audit start --repo <path> [--profile quick\|full] [--audits a,b] [--out <dir>] [--lang en\|ru]` | pins the run to `HEAD`, writes `run.json`, prints it with `runDir` |
| `smart-audit score <run-dir>` | writes `score` into every findings document |
| `smart-audit lint <run-dir> --repo <path>` | verifies the run; exit code 1 on errors |
| `smart-audit diff <run-dir>` | compares with the previous run, writes `diff.json` |
| `smart-audit report <run-dir>` | writes `summary.json`, `report.md`, `report.html`, updates `index.json` |
| `smart-audit finish <run-dir> --repo <path>` | `score` + `lint`; when lint passes, `diff` + `report` |
| `smart-audit rules` | lists lint rules |

## Files

```
<out>/                         default: <repo>/.smart-audit
  index.json                   history of finished runs
  accepted.json                accepted risks (optional, committed by the repository owner)
  runs/<commit-12>/
    run.json                   commit, branch, audits, rubric versions, previous run, accepted risks
    recon.json                 repository map
    drafts/<audit>.draft.json  auditor output before verification
    <audit>.findings.json      verified findings, scored by the CLI
    diff.json                  comparison with the previous run
    summary.json               overall and per-audit scores
    report.md, report.html     human-readable reports
```

A run is keyed by commit. Running again on the same commit replaces that run. With `--out`,
artifacts go to a directory outside the repository and the repository is left untouched.

The audit writes only inside `<out>`. If `<out>` is inside the repository, tell the user
whether `.smart-audit/` is ignored or tracked; do not edit `.gitignore` yourself.

## Lint rules

`smart-audit rules` prints the current list. A lint error means the result is not reportable.
Fix the cause in the findings document (wrong path, wrong line, missing criterion, missing
limits, unexplained previous finding), then run `finish` again. Never edit `score` by hand,
and never delete a finding only because its evidence line was wrong: correct the evidence.
