# smart-review

Agent-agnostic multi-mode code review skill for **Kilo / Claude Code /
OpenCode / Codex** (and any runtime that reads the
[Agent Skills](https://agentskills.io/specification) format). Analyzes
context, picks the right review mode, and launches specialized subagents.

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

## Install

The skill is one directory (`skill/`). Point your runtime's skills
directory at it — per-project or global:

| Runtime | Project path | Global path |
|---------|--------------|-------------|
| Claude Code | `.claude/skills/smart-review` | `~/.claude/skills/smart-review` |
| Kilo | `.kilo/skills/smart-review` | `~/.kilo/skills/smart-review` |
| OpenCode | `.opencode/skills/smart-review` | `~/.config/opencode/skills/smart-review` |
| Codex | — | `~/.codex/skills/smart-review` |

```bash
git clone https://github.com/xronocode/smart-review.git
ln -s $(pwd)/smart-review/skill ~/.claude/skills/smart-review   # example: Claude Code, global
```

Kilo alternative — register in `kilo.json`:

```json
{
  "skills": ["./skills/smart-review/skill"]
}
```

Notes for non-Claude runtimes:

- The `model:` pins (`opus` / `sonnet`) in `agents/*.md` are honored by
  Claude Code and ignored elsewhere.
- Slash commands (`/smart-review:update`) exist in Claude Code and Kilo.
  In other runtimes ask the agent directly: *"update the skill references
  following skill/commands/update.md"*.

## Update references

```
/smart-review:update          # stale only (>7 days)
/smart-review:update --all    # force all
/smart-review:update simplifier  # single source
```

## Security

What this skill can do when loaded: read files, run `git diff`, and
launch review subagents (Read/Grep/Glob/Bash). Auto-fix is opt-in —
without pre-approval it only reports.

The update command fetches remote documents from an **allowlist of two
domains** (`raw.githubusercontent.com/anthropics/*`, `docs.anthropic.com`),
treats fetched text as untrusted data (never as instructions), and
requires explicit confirmation before changing agent prompt files.
Details: [skill/commands/update.md](skill/commands/update.md) and
[SECURITY.md](SECURITY.md).

Found something? Report it privately:
[security advisory](https://github.com/xronocode/smart-review/security/advisories/new).

## Structure

```
skill/
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
    ├── project-scan.json      # auto-generated project scan cache
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
