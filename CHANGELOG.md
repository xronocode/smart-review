# Changelog

## v1.1.0 — 2026-10-25

Security hardening and repo infrastructure; no changes to review modes.

- **update command hardened**: domain allowlist for fetches, fetched text
  is treated as untrusted data (never instructions), agent prompt files
  (`agents/*.md`) are only rewritten after explicit user confirmation,
  updates write markdown only.
- **CI**: structure validation, upstream link check, gitleaks scan of git
  history; actions pinned by commit SHA, workflow token read-only.
- **SECURITY.md** with a private reporting path and the threat model of a
  prompt-shipping repo; **dependabot** for the CI actions.
- **README**: install matrix for Claude Code / Kilo / OpenCode / Codex
  (project and global paths), security section, notes for runtimes without
  slash commands.
- Renamed the skill id `review-orchestrator` → `smart-review` everywhere
  (slash command is now `/smart-review:update`); install directory name
  follows the repo name.

## v1.0.0 — 2026-05-11

Initial public release: multi-mode review orchestrator skill with five
subagents (project-scanner, excellence-reviewer, code-simplifier,
targeted-reviewer, silent-failure-hunter), language reference guides, and
the reference update command.
