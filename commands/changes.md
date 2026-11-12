---
description: "Review a diff, branch, or pull request: picks the right reviewers for the change and reports findings by severity"
argument-hint: "[standard|standard+errors|excellence|simplify|targeted --focus <area>|failure-hunt|project]"
allowed-tools: ["Bash", "Glob", "Grep", "Read", "Task", "WebFetch"]
---

# smart-review: changes

Run the `changes` section of the `smart-review` skill.

**Arguments:** "$ARGUMENTS"

An argument names the mode; with no argument the skill recommends one from the size, type,
and risk of the change.

Load `skills/smart-review/SKILL.md` from this plugin, then follow
`skills/smart-review/workflows/changes.md` step by step.
