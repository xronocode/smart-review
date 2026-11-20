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
| `smart-review rubrics` | lists sections, profiles, topic owners and scoring constants |
| `smart-review start --repo <path> [--sections a,b] [--topics a,b] [--out <dir>] [--lang en\|ru] [--name <repo-name>]` | pins a new attempt to `HEAD` and prints its actual `reviewSections`, requested topics, compatible carried sections and `runDir`. Alternatively select a profile with `--profile quick\|full`. |
| `smart-review check <file> --repo <path>` | checks one `recon.json`, draft, or findings file on its own: schema, evidence on the commit, criteria coverage |
| `smart-review score <run-dir>` | writes `score` into every findings document |
| `smart-review lint <run-dir> --repo <path>` | verifies the run; exit code 1 on errors |
| `smart-review diff <run-dir>` | compares with the previous run, writes `diff.json` |
| `smart-review report <run-dir>` | renders the local summary, Markdown and HTML; publication requires `finish` |
| `smart-review finish <run-dir> --repo <path>` | scores fresh documents, verifies the whole attempt, computes the diff and publishes a complete report in the index |
| `smart-review rules` | lists lint rules |

## Files

```
<out>/                         default: <repo>/.smart-review
  index.json                   history of finished runs
  .publications/<sequence>/    local publication records for concurrent and interrupted finishes
  accepted.json                accepted risks (optional, committed by the repository owner)
  runs/<commit-12>-<attempt>/
    run.json                   commit, branch, sections, rubric versions, previous run, accepted risks
    recon.json                 repository map
    prior/<section>.findings.json  findings of an earlier pass on the same commit, kept by `start`
    drafts/<section>.draft.json  inspector output before verification
    <section>.findings.json      verified findings, scored by the CLI
    diff.json                  comparison with the previous run
    summary.json               overall and per-section scores
    report.md, report.html     human-readable reports
```

Each start has a new directory. The last entry for a commit in `index.json` points to the
latest successfully published attempt. Old commit-only directories can still be opened.
On the same commit, requested sections get previous findings in `prior/` for investigation.
Compatible unselected sections are copied with their original attempt recorded in `carried`.
Sections from another commit, rubric or scoring version or language, and dependency reviews
that used an advisory scanner, require a fresh review. Their stale results do not enter the mean.
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
