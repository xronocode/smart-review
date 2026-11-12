---
description: "Every applicable section: all scored repository sections at the current commit, plus a review of pending changes when there are any"
argument-hint: "[--out <dir>] [--lang en|ru]"
allowed-tools: ["Bash", "Glob", "Grep", "Read", "Task", "Write", "WebFetch"]
---

# smart-review: full

Run the `smart-review` skill with no section named, so that every applicable section runs:
all scored sections that have a rubric, and `changes` when there are uncommitted changes or
the branch is ahead of the default branch.

**Arguments:** "$ARGUMENTS"

- `--out <dir>` writes run artifacts outside the repository.
- `--lang en|ru` sets the report language; otherwise use the user's language.

Load `skills/smart-review/SKILL.md` from this plugin and follow it step by step. Show the
plan with the number of agents before starting: a full run is the most expensive one.
