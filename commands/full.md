---
description: "Consider all ten source sections at the current commit and review pending changes when present"
argument-hint: "[--out <dir>] [--lang en|ru]"
allowed-tools: ["Bash", "Glob", "Grep", "Read", "Task", "Write", "WebFetch"]
---

# smart-review: full

Run the `smart-review` skill with the `full` profile. Select `security`, `tests`,
`dependencies`, `ai-readiness`, `hygiene`, `delivery`, `integrations`, `database`,
`frontend` and `open-source`. Add `changes` when the working tree has uncommitted
changes or the branch is ahead of its default branch.

Show the selection before recon. Use the repository map to establish applicability and
inspect relevant evidence only. Record absent surfaces as `na` with the reason and
insufficient evidence as `unknown`. A section with no assessed criteria has no numeric score.

**Arguments:** "$ARGUMENTS"

- `--out <dir>` writes run artifacts outside the repository.
- `--lang en|ru` sets the report language; otherwise use the user's language.

Load `skills/smart-review/SKILL.md` from this plugin and follow it step by step. Show the
agent count and output directory in the plan.
