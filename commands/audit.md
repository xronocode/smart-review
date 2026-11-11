---
description: "Audit this repository at the current commit: evidence-backed findings, a 0-100 score per audit, and an HTML report"
argument-hint: "[quick|full|<audit,audit>] [--out <dir>] [--lang en|ru]"
allowed-tools: ["Bash", "Glob", "Grep", "Read", "Task", "Write"]
---

# Repository audit

Run the `smart-audit` skill on the current repository.

**Arguments:** "$ARGUMENTS"

- `quick` (default), `full`, or a comma-separated list of audits selects what runs.
- `--out <dir>` writes run artifacts outside the repository.
- `--lang en|ru` sets the report language; otherwise use the user's language.

Load `skills/smart-audit/SKILL.md` from this plugin and follow it step by step. This command
adds nothing to the skill: every rule, including the lint gate before reporting, is defined there.
