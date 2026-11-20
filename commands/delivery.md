---
description: "Trace CI/CD safeguards from checks to release and rollback at the reviewed commit"
argument-hint: "[--out <dir>] [--lang en|ru]"
allowed-tools: ["Bash", "Glob", "Grep", "Read", "Task", "Write"]
---

# smart-review: delivery

Run the `smart-review` skill with the section list `delivery`.
Pass `$ARGUMENTS` through to the dispatcher. `--out <dir>` selects the output directory
and `--lang en|ru` selects the report language.

Load `skills/smart-review/SKILL.md` from this plugin and follow its repository workflow.
