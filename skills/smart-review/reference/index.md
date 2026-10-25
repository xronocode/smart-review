# Reference Index

> Auto-managed by `/smart-review:update`.
> Manual edits allowed for adding new sources.

## Agent Prompts (upstream)

| ID | File | Source URL | Last Updated |
|----|------|-----------|--------------|
| code-simplifier | agents/code-simplifier.md | https://raw.githubusercontent.com/anthropics/claude-code/main/plugins/pr-review-toolkit/agents/code-simplifier.md | 2026-05-10 |
| code-reviewer | agents/excellence-reviewer.md | https://raw.githubusercontent.com/anthropics/claude-code/main/plugins/pr-review-toolkit/agents/code-reviewer.md | 2026-05-10 |
| failure-hunter | agents/silent-failure-hunter.md | https://raw.githubusercontent.com/anthropics/claude-code/main/plugins/pr-review-toolkit/agents/silent-failure-hunter.md | 2026-05-10 |
| comment-analyzer | — (not included) | https://raw.githubusercontent.com/anthropics/claude-code/main/plugins/pr-review-toolkit/agents/comment-analyzer.md | 2026-05-10 |
| pr-test-analyzer | — (not included) | https://raw.githubusercontent.com/anthropics/claude-code/main/plugins/pr-review-toolkit/agents/pr-test-analyzer.md | 2026-05-10 |
| type-design-analyzer | — (not included) | https://raw.githubusercontent.com/anthropics/claude-code/main/plugins/pr-review-toolkit/agents/type-design-analyzer.md | 2026-05-10 |

## Reference Guides

| ID | File | Source URL | Last Updated |
|----|------|-----------|--------------|
| anthropic-prompting | reference/anthropic-prompting.md | https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/be-clear-and-direct | 2026-05-10 |
| anthropic-opus47 | reference/anthropic-opus47.md | https://docs.anthropic.com/en/docs/about-claude/models | 2026-05-10 |
| frontend-design | reference/frontend-design.md | https://raw.githubusercontent.com/anthropics/claude-code/main/plugins/frontend-design/skills/frontend-design/SKILL.md | 2026-05-10 |
| typescript | reference/typescript.md | local (derived from excellence-reviewer + best practices) | 2026-05-10 |
| react | reference/react.md | local (derived from excellence-reviewer + best practices) | 2026-05-10 |
| vue | reference/vue.md | local (derived from best practices) | 2026-05-10 |
| python | reference/python.md | local (derived from best practices) | 2026-05-10 |
| rust | reference/rust.md | local (derived from best practices) | 2026-05-10 |
| java | reference/java.md | local (derived from best practices) | 2026-05-10 |
| go | reference/go.md | local (derived from best practices) | 2026-05-10 |
| c | reference/c.md | local (derived from best practices) | 2026-05-10 |
| cpp | reference/cpp.md | local (derived from best practices) | 2026-05-10 |
| css | reference/css-less-sass.md | local (derived from best practices) | 2026-05-10 |
| qt | reference/qt.md | local (derived from best practices) | 2026-05-10 |

## Generated (local scan)

| ID | File | Source URL | Last Updated |
|----|------|-----------|--------------|
| project-scan | reference/project-scan.json | local scan | — |

## Freshness Policy

- **Stale threshold**: 7 days
- On review start the orchestrator checks each source the active agents will use.
- If any source is stale the orchestrator prints a warning and suggests `/smart-review:update`.
- Project scan cache is separate: re-scanned automatically when stale.
