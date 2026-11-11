# Changelog

## v1.3.0 — unreleased

Repository audit: a second skill, **smart-audit**, beside the diff review.
Review modes and agents of smart-review are unchanged.

- **smart-audit skill** (`skills/smart-audit/`): pins a run to a commit, maps
  the repository, runs one rubric-driven auditor per audit, verifies every
  finding in a separate pass, then scores and checks the result with a CLI.
- **Five audits**: security, tests, dependencies, AI readiness, codebase
  hygiene. Profiles: `quick` (first three) and `full`.
- **Evidence contract**: every finding carries `file:line` evidence on the
  audited commit, impact with its precondition, a fix direction, and a way to
  verify the fix. Unconfirmed suspicions are listed separately and not scored.
- **Deterministic score**: `100 − 40·critical − 15·high − 6·medium − 2·low`,
  capped at 39 with a critical and 69 with a high finding. Computed by the CLI,
  never by the model; the report shows each step.
- **`smart-audit` CLI** (Node 22+, no dependencies, ships inside the skill):
  `start`, `check`, `score`, `lint`, `diff`, `report`, `finish`. `lint` rejects a run on
  schema errors, evidence that does not exist on the commit, a commit or rubric
  version mismatch, an edited score, incomplete criteria, empty limits,
  unexplained findings of the previous run, or secret-shaped strings.
- **Run comparison**: fixed / still present / not reproduced / new / existed
  before but missed by the previous run.
- **Reports**: Markdown and one self-contained HTML file (light and dark),
  English or Russian.
- **`SMART_AUDIT.md` guidance file and `.smart-audit/accepted.json`**, both
  read from the audited commit and treated as untrusted input.
- **Claude Code plugin manifest** and `/smart-review:audit` command.
- **CI**: CLI test job (38 tests); `make validate` now checks both skills.
- `package.json` (`smart-audit`, private, not published).

## v1.2.0 — 2026-10-25

One-command install via the ecosystem `skills` CLI, and a README that
explains what the skill is for.

- **`npx skills add xronocode/smart-review`** — the skill now lives at
  `skills/smart-review/`, the layout the [vercel-labs/skills](https://github.com/vercel-labs/skills)
  CLI discovers natively: one command installs into Claude Code, Codex,
  OpenCode, Kilo and 70+ other agents (project or global, symlink or copy).
- **README rewritten**: what it is vs a bare "review my code" prompt and vs
  cloud reviewers (CodeRabbit/Qodo), example report, 30-second quickstart.
- Manual-install matrix aligned with the skills CLI agent paths.

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
