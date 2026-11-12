# smart-review

**Structured review for any coding agent, in sections — free, local, private.**

One plugin, one name. `changes` reviews a diff, a branch, or a pull request with
specialized passes. `security`, `tests`, `dependencies`, `ai-readiness`, and `hygiene`
review the whole repository at one commit and return evidence-backed findings, a
reproducible 0–100 score, and a machine-checked report. Name a section, or name none and
every applicable one runs.

```
/smart-review:changes        review my diff / branch / PR
/smart-review:security       one scored section
/smart-review:full           everything that applies
```

It installs into Claude Code as a plugin, and into Codex, OpenCode, Kilo, Cursor, Gemini
CLI and 70+ other agents as a skill. There, say *"review my changes"* or *"review the
security of this repository"*.

```markdown
📊 Changes: 12 files, ~340 lines (feature, medium, high-risk)
   Flags: types, errors
⚙️  Recommended: standard+errors → excellence → failure-hunt → simplify

## Review Summary
**Files reviewed:** 12 · **Findings:** 3 blocking, 5 important, 2 nits, 1 suggestion

### Blocking
- `src/auth.ts:47` — race condition in token refresh (excellence)
- `src/payments.ts:112` — no error handler for declined card (failure-hunt)
```

## Why not just ask the agent to "review my code"?

You can — and you get one shallow pass where security, dead code and naming
land in the same wall of text, with a different shape every run. smart-review
makes review a repeatable pipeline:

| | bare prompt | smart-review |
|---|---|---|
| Depth | one pass, whatever the model feels like | mode auto-picked from diff size / type / risk — quick sanity check to a whole-project read-through |
| Coverage | general | specialized passes: excellence, swallowed errors, simplification, single-focus deep dives (security, perf, types, …) |
| Report | free-form, new format every run | severity-labeled findings (`blocking` / `important` / `nit` / `suggestion` / `praise`), deduped across passes |
| Consistency | mood-dependent | same checklist every run, with language guides for TS, Python, Rust, Go, C/C++, Java, React, Vue, CSS, Qt |

And versus cloud reviewers:

| | smart-review | CodeRabbit / Qodo / Greptile |
|---|---|---|
| Runs | your agent, your model, your machine | vendor cloud |
| Cost | free, MIT | subscription |
| Scope | any git repo, terminal, pre-commit, the whole repository at a commit | GitHub/GitLab PRs on hosted plans |
| Privacy | code never leaves your machine/subscription | code goes to the vendor |

The trade-off is honest: hosted reviewers ship deep PR integration (inline
comments, dashboards) and their own tuned models. smart-review gives you
structure and specialized passes inside the agent you already pay for.

## Install (30 seconds)

**Claude Code — as a plugin** (adds the `/smart-review:*` commands):

```
/plugin marketplace add xronocode/smart-review
/plugin install smart-review@smart-review
```

**Any agent — as a skill** (requires Node ≥ 22.20 for the installer):

```bash
npx skills add xronocode/smart-review
```

Project-scoped by default; `-g` installs globally. One agent, no prompts:

```bash
npx skills add xronocode/smart-review -s smart-review -a claude-code -y
```

Then tell your agent *"review my changes"* or *"review this repository"*. In pipelines it
runs non-interactive: it picks the sections, prints the plan, and reports without pausing.

**No npx?** The skill is a plain directory — copy or symlink `skills/smart-review/`
into your agent's skills folder:

| Agent | Project | Global |
|-------|---------|--------|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| Codex, Cursor, Gemini CLI | `.agents/skills/` | `~/.agents/skills/` |
| OpenCode | `.agents/skills/` | `~/.config/opencode/skills/` |
| Kilo Code | `.agents/skills/` | `~/.kilo/skills/` |

(Paths for 70+ more agents: [vercel-labs/skills docs](https://github.com/vercel-labs/skills/blob/main/docs/agents.md).)

Notes for non-Claude runtimes: `model:` pins in `agents/*.md` are honored by
Claude Code and ignored elsewhere; slash commands exist where the agent supports plugin
commands — elsewhere ask the agent directly: *"run the security section of smart-review"*,
*"update the skill references following skills/smart-review/commands/update.md"*.

## Upgrading from 1.x

The skill keeps its name, so an existing install upgrades in place: run the same
`npx skills add xronocode/smart-review` again (or replace the copied directory).
In Claude Code you can switch to the plugin instead; remove the old skill copy from
`.claude/skills/smart-review` so the agent does not load two versions.

What changed for you:

| 1.x | 2.0 |
|---|---|
| "review my changes" | unchanged; also `/smart-review:changes` |
| mode `full` | `standard` |
| mode `full+errors` | `standard+errors` |
| mode `full-project` | `project` |
| — | scored sections: `/smart-review:security`, `:tests`, `:dependencies`, `:ai-readiness`, `:hygiene` |
| — | `/smart-review:full`: every applicable section; `/smart-review:quick`: security, tests, dependencies |

The old mode names are still understood when given as a mode of the `changes` section.
The word `full` on its own now means "every applicable section". Scored sections need
Node.js 22+ and git; the `changes` section needs neither.

## Sections

| Section | Command | Reviews | Result |
|---|---|---|---|
| `changes` | `/smart-review:changes` | a diff, a branch, or a pull request | findings by severity, no score |
| `security` | `/smart-review:security` | the repository at one commit | findings with `file:line`, 0–100 score |
| `tests` | `/smart-review:tests` | the repository at one commit | same |
| `dependencies` | `/smart-review:dependencies` | the repository at one commit | same |
| `ai-readiness` | `/smart-review:ai-readiness` | the repository at one commit | same |
| `hygiene` | `/smart-review:hygiene` | the repository at one commit | same |

`/smart-review:quick` runs security, tests, and dependencies. `/smart-review:full`, or a
request that names no section, runs every scored section plus `changes` when there are
uncommitted changes or the branch is ahead of the default branch. The plan, with the
number of agents, is shown before anything starts.

A scored section is a rubric: two files in
[skills/smart-review/rubrics/](skills/smart-review/rubrics/). Adding a section means
adding a rubric and a command file; the orchestrator does not change.

## The `changes` section

| Mode | Agents | When |
|------|--------|------|
| `standard` | excellence → simplify | Post-implementation, pre-commit |
| `standard+errors` | excellence → failure-hunt → simplify | Large PR, pre-merge |
| `excellence` | excellence | Quick sanity check |
| `simplify` | simplify | Code works but feels complex |
| `targeted` | targeted --focus | Specific concern |
| `failure-hunt` | failure-hunt | Suspicion of swallowed errors |
| `project` | project-scanner → excellence → failure-hunt → simplify | Read-through of a whole codebase |

1. **Classify** — the orchestrator runs `git diff`, scores size / type / risk,
   and flags markers (new types, error-handling changes, test changes).
2. **Recommend** — it proposes a mode and waits for your yes (or your override).
3. **Review** — specialized subagents run in sequence, each with its own
   checklist; findings accumulate into one deduplicated list with severity labels.
4. **Report** — one consolidated summary: blocking first, praise included.

## The scored sections

The `changes` section answers *"what is wrong with this change?"*. The scored sections
answer *"what state is this repository in at this commit?"* Tell your agent **"review this
repository"** (or run `/smart-review:quick` in Claude Code) and you get:

```
Overall: 67/100 (needs work) · notes-api @ b81099ba23c4

| Section      | Score | Findings          |
| Security     | 64    | 2 high, 1 medium  |
| Tests        | 69    | 1 high, 1 medium  |
| Dependencies | 69    | 1 high, 1 medium  |

Fix first
1. [high] Export route reads files outside the exports directory (`src/server.js:20`)
2. [high] A note can be read by id without checking its owner (`src/server.js:10`)

Report: .smart-review/runs/b81099ba23c4/report.html
```

A full example, generated from a synthetic repository, is in
[examples/demo/](examples/demo/): [report.md](examples/demo/report.md),
`report.html` (one self-contained file, light and dark themes), and the underlying
[findings](examples/demo/security.findings.json).

### What makes the result trustworthy

| | "review my repo" prompt | smart-review |
|---|---|---|
| Scope | whatever the model notices | one bounded question per section, a fixed list of criteria, a mapping pass before any judgment |
| Findings | claims | every finding has `file:line` evidence on the reviewed commit, a reachability condition, a fix direction, and a way to verify the fix |
| Second opinion | none | a separate verification pass re-reads the code and tries to refute each finding; it can lower a severity or drop the finding |
| Score | a number the model felt like | computed by a script from confirmed findings; the report prints the arithmetic |
| Checking the result | reading it | `smart-review lint` rejects the run if an evidence line does not exist on the commit, the score was edited, a criterion is missing, limits are empty, or a secret leaked into the output |
| Next run | starts from zero | compared finding by finding: fixed, still present, new, or *existed before but the previous run missed it* |

### The question each section answers

| Section | Question |
|---|---|
| `security` | Which confirmed, reachable security weaknesses exist at this commit, and which should be fixed first? |
| `tests` | Would this test suite catch a real regression before release, and can someone else run it? |
| `dependencies` | Can the dependencies be installed reproducibly and trusted? |
| `ai-readiness` | Can a coding agent take a task here from request to verified change without tribal knowledge? |
| `hygiene` | How much avoidable friction does the codebase carry for the next person who changes it? |

Each section has a rubric in [skills/smart-review/rubrics/](skills/smart-review/rubrics/)
with its method, evidence rules, severity anchors, and criteria.

### The score

```
score = 100 − 40·critical − 15·high − 6·medium − 2·low      (never below 0)
any critical → at most 39        any high → at most 69
medium findings together deduct at most 30
low findings together deduct at most 14
```

The overall score is the mean of the sections that ran under the same caps: a counted
critical in any section keeps it at most 39, otherwise a counted high keeps it at most 69.

70–100 good, 40–69 needs work, 0–39 at risk. A repository with a confirmed high-severity
problem is never "good"; one with a critical problem is always "at risk". Medium findings
alone never leave the good band, so a more thorough review never scores lower than a
shallow one. Criteria are
shown in the report but never enter the score. Rationale:
[reference/scoring.md](skills/smart-review/reference/scoring.md).

### How it works

1. **Pin** — `smart-review start` pins the run to the current commit and shows the plan.
2. **Recon** — one agent maps the repository: stack, entry points, trust boundaries, tests, CI, docs.
3. **Inspect** — one inspector per section follows its rubric and writes a draft with evidence. In parallel where the agent supports subagents, sequentially where it does not.
4. **Verify** — a second pass re-checks every finding against the code.
5. **Score, lint, report** — `smart-review finish` computes scores, verifies the run, compares it with the previous one, and writes `report.md` and `report.html`.

The CLI ships inside the skill (`skills/smart-review/cli/`), needs only Node.js 22+ and
git, and has no dependencies. You can also use it in CI as a gate:

```bash
node skills/smart-review/cli/smart-review.mjs lint .smart-review/runs/<commit> --repo .
```

### Telling the reviewer what you already know

- **`SMART_REVIEW.md`** in the repository root: plain-language context ("rate limiting is
  enforced at the gateway", "`gen/` is generated"). The inspector verifies each claim. It
  cannot set a score, hide a reachable security path, or authorize commands.
- **`.smart-review/accepted.json`**: risks you have accepted, by finding key and with a
  reason. Accepted `low` and `medium` findings stay in the report and stop counting.
  `high` and `critical` findings always count.

Both are read from the reviewed commit, not from the working tree. Details:
[reference/untrusted-input.md](skills/smart-review/reference/untrusted-input.md).

### Limits, honestly

- It is a static read by a language model. It does not run your application, and it
  will miss things. Every report lists what was not checked and how that bounds the
  conclusion.
- Two runs on the same commit can differ in what they find. The score is reproducible
  *given the findings*; the findings themselves are not guaranteed to be complete. The
  run comparison says when a later run found something an earlier one missed.
- Known-vulnerability data comes only from scanners you already have installed
  (`osv-scanner`, `npm audit`, `cargo audit`, …). Without one, that criterion is
  reported as "not established" instead of guessed.
- A full run on a large repository uses a lot of model time: one recon pass plus two
  passes per scored section.
- No active testing of live sites, no autofix, no scheduling in this version.

## Updating references

```
/smart-review:update          # stale only (>7 days)
/smart-review:update --all    # force all
/smart-review:update simplifier  # single source
```

## Security

What the skill can do when loaded: read files, run `git diff`, and launch
review subagents. Auto-fix is opt-in — without pre-approval it only reports.

The update command fetches remote documents from an **allowlist of two
domains** (`raw.githubusercontent.com/anthropics/*`, `docs.anthropic.com`),
treats fetched text as untrusted data (never as instructions), and requires
explicit confirmation before changing agent prompt files. Details:
[skills/smart-review/commands/update.md](skills/smart-review/commands/update.md)
and [SECURITY.md](SECURITY.md).

The scored sections are read-only for the repository they review: they run read-only `git`,
the bundled CLI, and — only if already installed — the scanners a rubric names. They
treat everything in the reviewed repository, including `SMART_REVIEW.md` and
`accepted.json`, as untrusted data, mask secrets in the output, and write only
into the run directory (`.smart-review/` or the `--out` directory you choose).

Found something? Report it privately:
[security advisory](https://github.com/xronocode/smart-review/security/advisories/new).

## Structure

```
skills/smart-review/
├── SKILL.md                   # entry point — chooses sections, shows the plan
├── workflows/
│   ├── changes.md             # the changes section: modes, agents, report
│   └── repository.md          # the scored sections: recon, inspect, verify, score, lint
├── agents/                    # reviewers for changes; recon, inspector, verifier
├── rubrics/                   # <section>.md (method) + <section>.json (criteria), profiles.json
├── reference/                 # language guides, findings contract, scoring, run layout
├── schemas/                   # JSON Schemas for findings, recon, run
├── cli/                       # smart-review: start, check, score, lint, diff, report, finish
├── commands/update.md         # reference refresh instructions
└── templates/
commands/                      # one plugin command per section, plus full, quick, update
.claude-plugin/                # plugin and marketplace manifests
examples/demo/                 # example report from a synthetic repository
tests/                         # CLI tests (node:test) and structure checks
```

## Development

```bash
make validate   # skill structure, rubric consistency, one command per section
make test       # CLI tests
node examples/build-example.mjs   # regenerate examples/demo/
```

## Sources

| Component | Origin |
|-----------|--------|
| excellence-reviewer | [anthropics/claude-code — pr-review-toolkit](https://github.com/anthropics/claude-code/tree/main/plugins/pr-review-toolkit) + custom language guides |
| code-simplifier | [anthropics/claude-code — code-simplifier](https://github.com/anthropics/claude-code/blob/main/plugins/pr-review-toolkit/agents/code-simplifier.md) |
| silent-failure-hunter | [anthropics/claude-code — pr-review-toolkit](https://github.com/anthropics/claude-code/blob/main/plugins/pr-review-toolkit/agents/silent-failure-hunter.md) |
| language guides | [anthropics/claude-code — frontend-design](https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design) + [Anthropic docs](https://docs.anthropic.com) |

## License

MIT
