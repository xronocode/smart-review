# smart-review

**Structured, multi-pass code review for any coding agent — free, local, private.**
Now with **[smart-audit](#repository-audit-smart-audit)**: a whole-repository audit
with evidence-backed findings, a reproducible 0–100 score, and a machine-checked report.

One command installs it into Claude Code, Codex, OpenCode, Kilo, Cursor, Gemini
CLI and 70+ other agents. After that, "review my changes" in your agent stops
being a single generic glance: smart-review reads the diff, picks the right
review mode, runs specialized review passes, and returns one prioritized report.

```markdown
📊 Changes: 12 files, ~340 lines (feature, medium, high-risk)
   Flags: types, errors
⚙️  Recommended: full+errors → excellence → failure-hunt → simplify

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
| Depth | one pass, whatever the model feels like | mode auto-picked from diff size / type / risk — quick sanity check to full-project audit |
| Coverage | general | specialized passes: excellence, swallowed errors, simplification, single-focus deep dives (security, perf, types, …) |
| Report | free-form, new format every run | severity-labeled findings (`blocking` / `important` / `nit` / `suggestion` / `praise`), deduped across passes |
| Consistency | mood-dependent | same checklist every run, with language guides for TS, Python, Rust, Go, C/C++, Java, React, Vue, CSS, Qt |

And versus cloud reviewers:

| | smart-review | CodeRabbit / Qodo / Greptile |
|---|---|---|
| Runs | your agent, your model, your machine | vendor cloud |
| Cost | free, MIT | subscription |
| Scope | any git repo, terminal, pre-commit, whole-codebase audit | GitHub/GitLab PRs on hosted plans |
| Privacy | code never leaves your machine/subscription | code goes to the vendor |

The trade-off is honest: hosted reviewers ship deep PR integration (inline
comments, dashboards) and their own tuned models. smart-review gives you
structure and specialized passes inside the agent you already pay for.

## Install (30 seconds)

Requires Node ≥ 22.20:

```bash
npx skills add xronocode/smart-review
```

Pick **smart-review**, **smart-audit**, or both, and your agent(s). Project-scoped by default; `-g`
installs globally. One agent, no prompts:

```bash
npx skills add xronocode/smart-review -s smart-review -a claude-code -y
```

Claude Code users can install the same repository as a plugin instead, which
adds the `/smart-review:audit` command:

```
/plugin marketplace add xronocode/smart-review
/plugin install smart-review@smart-review
```

Then tell your agent *"review my changes"* — the skill loads on review
requests. In pipelines it runs non-interactive: auto-selects the recommended
mode and prints the report without pausing.

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
Claude Code and ignored elsewhere; slash commands exist in Claude Code and
Kilo — elsewhere ask the agent directly: *"update the skill references
following skills/smart-review/commands/update.md"*.

## Modes

| Mode | Agents | When |
|------|--------|------|
| `full` | excellence → simplify | Post-implementation, pre-commit |
| `full+errors` | excellence → failure-hunt → simplify | Large PR, pre-merge |
| `excellence` | excellence | Quick sanity check |
| `simplify` | simplify | Code works but feels complex |
| `targeted` | targeted --focus | Specific concern |
| `failure-hunt` | failure-hunt | Suspicion of swallowed errors |
| `full-project` | project-scanner → excellence → failure-hunt → simplify | Whole-codebase audit |

## How it works

1. **Classify** — the orchestrator runs `git diff`, scores size / type / risk,
   and flags markers (new types, error-handling changes, test changes).
2. **Recommend** — it proposes a mode and waits for your yes (or your override).
3. **Review** — specialized subagents run in sequence, each with its own
   checklist; findings accumulate into one deduplicated list with severity labels.
4. **Report** — one consolidated summary: blocking first, praise included.

## Repository audit (smart-audit)

Review answers *"what is wrong with this change?"*. An audit answers *"what state is
this repository in at this commit?"* Tell your agent **"audit this repository"** (or
run `/smart-review:audit` in Claude Code) and you get:

```
Overall: 67/100 (needs work) · notes-api @ 895cffb11905

| Audit        | Score | Findings          |
| Security     | 64    | 2 high, 1 medium  |
| Tests        | 69    | 1 high, 1 medium  |
| Dependencies | 69    | 1 high, 1 medium  |

Fix first
1. [high] Export route reads files outside the exports directory (`src/server.js:20`)
2. [high] A note can be read by id without checking its owner (`src/server.js:10`)

Report: .smart-audit/runs/895cffb11905/report.html
```

A full example, generated from a synthetic repository, is in
[examples/demo/](examples/demo/): [report.md](examples/demo/report.md),
`report.html` (one self-contained file, light and dark themes), and the underlying
[findings](examples/demo/security.findings.json).

### What makes the result trustworthy

| | "audit my repo" prompt | smart-audit |
|---|---|---|
| Scope | whatever the model notices | one bounded question per audit, a fixed list of criteria, a mapping pass before any judgment |
| Findings | claims | every finding has `file:line` evidence on the audited commit, a reachability condition, a fix direction, and a way to verify the fix |
| Second opinion | none | a separate verification pass re-reads the code and tries to refute each finding; it can lower a severity or drop the finding |
| Score | a number the model felt like | computed by a script from confirmed findings; the report prints the arithmetic |
| Checking the result | reading it | `smart-audit lint` rejects the run if an evidence line does not exist on the commit, the score was edited, a criterion is missing, limits are empty, or a secret leaked into the output |
| Next run | starts from zero | compared finding by finding: fixed, still present, new, or *existed before but the previous run missed it* |

### Audits and profiles

| Audit | Question |
|---|---|
| `security` | Which confirmed, reachable security weaknesses exist at this commit, and which should be fixed first? |
| `tests` | Would this test suite catch a real regression before release, and can someone else run it? |
| `dependencies` | Can the dependencies be installed reproducibly and trusted? |
| `ai-readiness` | Can a coding agent take a task here from request to verified change without tribal knowledge? |
| `hygiene` | How much avoidable friction does the codebase carry for the next person who changes it? |

`quick` (default) runs the first three; `full` runs all five. Each audit has a rubric in
[skills/smart-audit/rubrics/](skills/smart-audit/rubrics/) with its method, evidence
rules, severity anchors, and criteria.

### The score

```
score = 100 − 40·critical − 15·high − 6·medium − 2·low      (never below 0)
any critical → at most 39        any high → at most 69
low findings together deduct at most 14
```

70–100 good, 40–69 needs work, 0–39 at risk. A repository with a confirmed high-severity
problem is never "good"; one with a critical problem is always "at risk". Criteria are
shown in the report but never enter the score. Rationale:
[reference/scoring.md](skills/smart-audit/reference/scoring.md).

### How it works

1. **Pin** — `smart-audit start` pins the run to the current commit and shows the plan.
2. **Recon** — one agent maps the repository: stack, entry points, trust boundaries, tests, CI, docs.
3. **Audit** — one auditor per audit follows its rubric and writes a draft with evidence. In parallel where the agent supports subagents, sequentially where it does not.
4. **Verify** — a second pass re-checks every finding against the code.
5. **Score, lint, report** — `smart-audit finish` computes scores, verifies the run, compares it with the previous one, and writes `report.md` and `report.html`.

The CLI ships inside the skill (`skills/smart-audit/cli/`), needs only Node.js 22+ and
git, and has no dependencies. You can also use it in CI as a gate:

```bash
node skills/smart-audit/cli/smart-audit.mjs lint .smart-audit/runs/<commit> --repo .
```

### Telling the auditor what you already know

- **`SMART_AUDIT.md`** in the repository root: plain-language context ("rate limiting is
  enforced at the gateway", "`gen/` is generated"). The auditor verifies each claim. It
  cannot set a score, hide a reachable security path, or authorize commands.
- **`.smart-audit/accepted.json`**: risks you have accepted, by finding key and with a
  reason. Accepted `low` and `medium` findings stay in the report and stop counting.
  `high` and `critical` findings always count.

Both are read from the audited commit, not from the working tree. Details:
[reference/untrusted-input.md](skills/smart-audit/reference/untrusted-input.md).

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
- A full audit of a large repository uses a lot of model time: one recon pass plus two
  passes per audit.
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

smart-audit is read-only for the repository it audits: it runs read-only `git`,
its own CLI, and — only if already installed — the scanners a rubric names. It
treats everything in the audited repository, including `SMART_AUDIT.md` and
`accepted.json`, as untrusted data, masks secrets in its output, and writes only
into the run directory (`.smart-audit/` or the `--out` directory you choose).

Found something? Report it privately:
[security advisory](https://github.com/xronocode/smart-review/security/advisories/new).

## Structure

```
skills/smart-review/
├── SKILL.md                   # entry point — orchestrator
├── commands/
│   └── update.md              # /smart-review:update
├── agents/
│   ├── project-scanner.md
│   ├── excellence-reviewer.md
│   ├── code-simplifier.md
│   ├── targeted-reviewer.md
│   └── silent-failure-hunter.md
└── reference/
    ├── index.md               # source registry + freshness dates
    ├── anthropic-prompting.md
    ├── anthropic-opus47.md
    └── ...language guides
```

```
skills/smart-audit/
├── SKILL.md                   # entry point — audit orchestrator
├── agents/                    # recon, auditor, verifier
├── rubrics/                   # <audit>.md (method) + <audit>.json (criteria), profiles.json
├── reference/                 # findings contract, scoring, untrusted input, run layout
├── schemas/                   # JSON Schemas for findings, recon, run
└── cli/                       # smart-audit: start, check, score, lint, diff, report, finish
commands/audit.md              # /smart-review:audit (Claude Code plugin)
.claude-plugin/                # plugin and marketplace manifests
examples/demo/                 # example report from a synthetic repository
tests/                         # CLI tests (node:test) and structure checks
```

## Development

```bash
make validate   # structure of both skills, rubric consistency
make test       # smart-audit CLI tests
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
