# smart-review

**Structured, multi-pass code review for any coding agent — free, local, private.**

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

Pick **smart-review** and your agent(s). Project-scoped by default; `-g`
installs globally. One agent, no prompts:

```bash
npx skills add xronocode/smart-review -s smart-review -a claude-code -y
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

## Sources

| Component | Origin |
|-----------|--------|
| excellence-reviewer | [anthropics/claude-code — pr-review-toolkit](https://github.com/anthropics/claude-code/tree/main/plugins/pr-review-toolkit) + custom language guides |
| code-simplifier | [anthropics/claude-code — code-simplifier](https://github.com/anthropics/claude-code/blob/main/plugins/pr-review-toolkit/agents/code-simplifier.md) |
| silent-failure-hunter | [anthropics/claude-code — pr-review-toolkit](https://github.com/anthropics/claude-code/blob/main/plugins/pr-review-toolkit/agents/silent-failure-hunter.md) |
| language guides | [anthropics/claude-code — frontend-design](https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design) + [Anthropic docs](https://docs.anthropic.com) |

## License

MIT
