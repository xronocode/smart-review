---
description: "Tests section: whether the test suite would catch a regression in what matters. Evidence-backed findings, a 0-100 score, an HTML report"
argument-hint: "[--out <dir>] [--lang en|ru]"
allowed-tools: ["Bash", "Glob", "Grep", "Read", "Task", "Write"]
---

# smart-review: tests

Run the `smart-review` skill with the section list `tests`.

**Arguments:** "$ARGUMENTS"

- `--out <dir>` writes run artifacts outside the repository.
- `--lang en|ru` sets the report language; otherwise use the user's language.

Load `skills/smart-review/SKILL.md` from this plugin and follow it step by step. This command
only names the sections: every rule, including the lint gate before reporting, is in the skill.
