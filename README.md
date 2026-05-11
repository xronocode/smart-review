# Review Orchestrator

Multi-mode code review skill for Kilo / Claude Code. Analyzes context,
picks the right review mode, and launches specialized subagents.

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

Copy (or symlink) `skill/` into your Kilo skills directory:

```bash
# per-project
ln -s $(pwd)/skill .kilo/skills/review-orchestrator

# global
ln -s $(pwd)/skill ~/.kilo/skills/review-orchestrator
```

Or add to `kilo.json`:

```json
{
  "skills": ["./skills/review-orchestrator/skill"]
}
```

## Update references

```
/review-orchestrator:update          # stale only (>7 days)
/review-orchestrator:update --all    # force all
/review-orchestrator:update simplifier  # single source
```

## Structure

```
skill/
├── SKILL.md                   # entry point — orchestrator
├── commands/
│   └── update.md              # /review-orchestrator:update
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
