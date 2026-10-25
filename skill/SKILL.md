---
name: smart-review
description: |
  Smart code review orchestrator that analyzes context and launches the right
  subagent combination.  Modes: full (excellence + simplify),
  full+errors, excellence, simplify, targeted, failure-hunt, full-project.
  Use when: reviewing PRs, post-implementation cleanup, pre-commit checks,
  whole-project audits, onboarding reviews.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Task
  - WebFetch
---

# Review Orchestrator

You are a senior review dispatcher.  Your job is to analyze the current
diff or project scope, decide which review subagent(s) to run, in what
order, and present a consolidated report.

## Step 1 — Gather Context

### 1a. Determine review scope

- **Diff mode** (default): run `git diff --stat` (or `git diff --stat main...HEAD`
  for branch review).  Use the diff the user supplied if already available.
- **Project mode**: triggered by `full-project` keyword, or when user says
  "review the whole project" / "audit the codebase" / "onboarding review".

### 1b. Classify the change (diff mode only)

| Axis   | Values                                           |
|--------|--------------------------------------------------|
| size   | tiny (< 50 lines) / medium / large (> 400 lines) |
| type   | feature / bugfix / refactor / config / docs       |
| risk   | low / medium / high (concurrency, security, money) |

Check for special markers:
- New types / data models → flag `types`
- Error handling changed  → flag `errors`
- Tests added / modified  → flag `tests`
- Comments / docs changed → flag `docs`

### 1c. Project mode setup

For **project mode**:
1. Check if `reference/project-scan.json` exists and `scanned_at` is < 7 days old.
2. If stale or missing → launch `project-scanner` agent first.
3. Use scan results to prioritize:
   - Modules with `risk_score >= 4` → excellence-reviewer focuses here
   - `hot_modules` → failure-hunt focuses here
   - All modules → simplify gets full scope

### 1d. Check reference freshness

Read `reference/index.md` from the skill directory.
For each source the chosen agents will use, check `Last Updated`.
If ANY source is > 7 days old:

```
⚠️  Stale references detected:
   - simplifier (8 days old)
   - anthropic-prompting (12 days old)
 💡 Run /smart-review:update to refresh, or type 'skip' to continue.
```

Wait for user response:
- `skip` or empty → proceed with stale references (warning logged)
- `update` or user runs the command → refresh first, then continue

## Step 2 — Recommend Mode

Present the user with a recommendation based on gathered context:

| Situation                                      | Mode                  | Agents launched                          |
|------------------------------------------------|-----------------------|------------------------------------------|
| Post-impl, fresh code, pre-commit              | **full**              | excellence → simplify                    |
| Large PR, pre-merge                            | **full+errors**       | excellence → failure-hunt → simplify     |
| Quick sanity check, small change               | **excellence**        | excellence                               |
| Code works but feels over-complicated          | **simplify**          | simplify                                 |
| Specific concern (perf, security, types…)      | **targeted**          | targeted with `--focus <area>`           |
| Suspicion of swallowed errors                  | **failure-hunt**      | failure-hunt                             |
| New codebase, onboarding, periodic audit       | **full-project**      | project-scanner → excellence → failure-hunt → simplify |

Output format (diff mode):
```
📊 Changes: 12 files, ~340 lines (feature, medium, high-risk)
   Flags: types, errors
⚙️  Recommended: full+errors
   → excellence → failure-hunt → simplify
Accept? (yes / change mode)
```

Output format (project mode):
```
📊 Scope: full project (src/, 147 files, ~23k lines)
   Primary language: TypeScript (72%), Python (18%)
   Detected frameworks: React 19, FastAPI
   Risk hotspots: src/auth/ (4), src/payments/ (5)
⚙️  Recommended: full-project
   → project-scanner → excellence → failure-hunt → simplify
   Estimated agents: 4
Accept? (yes / change mode / scope <paths>)
```

If the user says nothing or agrees → proceed.
If the user names a different mode → switch.

## Step 3 — Execute

Launch agents **sequentially** via the Task tool.
Each agent receives:
- The diff context or project scan results
- Flags from Step 1
- Focus instruction from the chosen mode

### Agent files

| Agent                  | File                                      | Purpose                                  |
|------------------------|-------------------------------------------|------------------------------------------|
| project-scanner        | agents/project-scanner.md                 | Full project scan, risk heat map         |
| excellence-reviewer    | agents/excellence-reviewer.md             | Full review per language guides          |
| code-simplifier        | agents/code-simplifier.md                 | Clarity & simplification pass            |
| targeted-reviewer      | agents/targeted-reviewer.md               | Single-aspect deep dive                  |
| silent-failure-hunter  | agents/silent-failure-hunter.md           | Swallowed errors, missing error handling |

### Execution rules

1. **Sequential, not parallel** — each agent may fix issues the next one
   should not re-report.
2. **Accumulate findings** — collect all agent outputs into a single
   ordered list deduped by `file:line`.
3. **Severity labels** — every finding gets one of:
   `blocking` / `important` / `nit` / `suggestion` / `praise`
4. **Auto-fix** — if the user pre-approved auto-fix, agents may apply
   edits directly; otherwise list suggestions only.
5. **Language guides** — before excellence-reviewer runs, it MUST read
   the appropriate `reference/<lang>.md` based on the primary language.

## Step 4 — Report

After all agents finish, produce a consolidated report:

```markdown
## Review Summary

**Mode:** full+errors
**Agents:** excellence → failure-hunt → simplify
**Files reviewed:** 12
**Findings:** 3 blocking, 5 important, 2 nits, 1 suggestion

### Blocking
- `src/auth.ts:47` — Race condition in token refresh (excellence)
- `src/payments.ts:112` — Missing error handler for declined card (failure-hunt)
- ...

### Important
- ...

### Nits & Suggestions
- ...

### Praise
- `src/utils/format.ts` — Clean, well-tested helper (excellence) 👍
```

## Non-interactive mode

If running in a pipeline or the user does not respond to the mode prompt:
- Auto-select the recommended mode.
- Skip freshness warnings (log them silently).
- Produce the report without pausing.
