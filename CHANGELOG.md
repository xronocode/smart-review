# Changelog

## v2.0.0 — unreleased

smart-review becomes a plugin made of **sections**. The diff review is now the `changes`
section; five scored sections review the whole repository at one commit. One skill, one
name, one command per section.

**Upgrading from 1.x.** The skill name is unchanged, so `npx skills add
xronocode/smart-review` upgrades an existing install in place. Breaking: the modes `full`,
`full+errors`, and `full-project` of the diff review are now `standard`,
`standard+errors`, and `project` (the old names are still understood as modes of the
`changes` section); `full` on its own now means "every applicable section"; with no section
named, every applicable section runs instead of the diff review alone.

- **Sections**: `changes`, `security`, `tests`, `dependencies`, `ai-readiness`, `hygiene`.
  `SKILL.md` chooses the sections, shows the plan with the number of agents, and hands
  them to `workflows/changes.md` or `workflows/repository.md`.
- **Plugin commands**: `/smart-review:changes`, `:security`, `:tests`, `:dependencies`,
  `:ai-readiness`, `:hygiene`, `:quick` (security, tests, dependencies), `:full` (every
  applicable section), `:update`. A scored section is a rubric plus a command file; the
  orchestrator does not change when one is added.
- **Scored sections**: a run is pinned to a commit; one agent maps the repository, one
  inspector per section follows its rubric, a separate pass verifies every finding, and
  the CLI scores and checks the result.
- **Evidence contract**: every finding carries `file:line` evidence on the reviewed
  commit, impact with its precondition, a fix direction, and a way to verify the fix.
  Unconfirmed suspicions are listed separately and not scored.
- **Deterministic score** (scoring version 3): `100 − 40·critical − 15·high − 6·medium −
  2·low`, capped at 39 with a critical and 69 with a high finding; medium findings
  together deduct at most 30 and low findings at most 14, so a more thorough review is not
  punished for finding more. The overall score is the mean of the sections under the same
  caps. Computed by the CLI, never by the model; the report shows each step. Scores are
  comparable only within one scoring version.
- **`smart-review` CLI** (Node 22+, no dependencies, ships inside the skill): `start`,
  `check`, `score`, `lint`, `diff`, `report`, `finish`, `rubrics`. `lint` rejects a run on
  schema errors, evidence that does not exist on the commit, a commit or rubric version
  mismatch, an edited score, incomplete criteria, empty limits, unexplained findings of
  the previous run, or secret-shaped strings.
- **Run comparison**: fixed / still present / not reproduced / new / existed before but
  missed by the previous run.
- **Reports**: Markdown and one self-contained HTML file (light and dark), English or
  Russian.
- **`SMART_REVIEW.md` guidance file and `.smart-review/accepted.json`**, both read from
  the reviewed commit and treated as untrusted input.
- **Claude Code plugin and marketplace manifests**.
- **README** rewritten around sections, with a section for agents and translations:
  Русский, 简体中文, Español. `make validate` fails when a translation drifts from the
  shape of `README.md`.
- **Upstream links** of the `changes` section point at `anthropics/claude-plugins-official`,
  where the source plugins moved; `make check-links` passes again.
- The overall-score calculation shows the cap line only when the cap lowers the mean.
- **CI**: CLI test job (46 tests); `make validate` checks the skill, the rubrics, and that
  every section has a command.
- `package.json` (`@xronocode/smart-review`, private, not published).

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
