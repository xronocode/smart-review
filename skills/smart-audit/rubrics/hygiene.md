---
id: hygiene
version: 1.0.0
---

# Codebase hygiene audit

## Question

How much avoidable friction does this codebase carry for the next person or agent who changes it?

## Scope

In scope: tracked files as a whole (what is committed that should not be, what is missing), build and maintenance commands, onboarding documentation, structure, naming, leftovers, formatting and lint configuration, local duplication, module cohesion, and error handling patterns.

Out of scope: security impact (security rubric), test quality (test rubric), dependency choice (dependency rubric), architecture redesign, personal style preferences, anything in generated or vendored directories.

## Method

1. **Survey tracked files.** Use `git ls-files` on the audited commit: sizes, binary and build output, backup copies, environment files, generated directories that are tracked.
2. **Check the working surface.** Commands in the manifest, Makefile, or scripts directory; README steps; formatter and linter configuration and whether a command runs them.
3. **Sample code by size and churn.** Read the largest and most central source files and a sample of ordinary ones. Look for dead code, duplicated logic, mixed responsibilities, swallowed errors, magic values.
4. **Confirm each lead.** Before reporting code as unused, search for references including dynamic ones (string lookups, registries, reflection, configuration). Before reporting duplication, confirm the copies really do the same job.

## Evidence rules

- Every finding cites lines. For "unused", also state what you searched for and that nothing references it.
- Group by root cause: fifteen files with the same leftover pattern are one finding with representative evidence and a count.
- State the cost in concrete terms: what a contributor has to know, check, or redo because of it.
- Do not report formatting differences line by line; report the missing or unenforced formatter once.

## Severity anchors

- **critical** — not used in this audit unless the repository cannot be built or understood at all from its tracked state.
- **high** — the documented build or setup path does not work from a clean clone, or a core area is so entangled that routine changes need coordinated edits across many unrelated places.
- **medium** — a recurring source of mistakes: widespread swallowed errors in a core path, a large dead subsystem that still looks live, hardcoded machine-specific paths in shared scripts, no enforced formatting on a multi-contributor code base.
- **low** — local clutter: an unused export, a stale TODO cluster, a backup copy, an inconsistent name, a tracked build artifact.

## Criteria

### `dead-code` — Unused, disabled, and unreachable code
Unreferenced modules and exports, commented-out blocks, permanently false flags, remnants of removed features.

### `artifacts` — Tracked binaries and build output
Build results, caches, archives, and large binaries that are tracked without a stated reason.

### `ignore` — Ignore rules cover generated and local files
`.gitignore` covers build output, editor files, environment files, and tool caches used by this project.

### `commands` — Build and maintenance commands
One discoverable command each for build, test, lint, and format; they agree with what CI runs.

### `onboarding` — Getting-started documentation
A newcomer can get from clone to a running or tested project by following the README.

### `structure` — Directory structure is understandable
Top-level layout communicates purpose; no parallel trees doing the same job.

### `env` — Environment files and machine-specific assumptions
Environment templates exist; no absolute paths, usernames, or host names of the author's machine in shared files.

### `constants` — Magic values and hardcoded data
Limits, URLs, timeouts, and identifiers are named and defined once.

### `naming` — Consistent naming and language
One naming scheme per layer and one human language for identifiers and comments.

### `leftovers` — Backup copies and stale markers
`*.bak`, `*_old`, `copy of`, and TODO/FIXME/HACK markers without an owner or issue.

### `formatting` — Formatting and linting are enforced
A formatter and linter are configured and a command or hook runs them. `unknown` if configuration exists but nothing shows whether it is enforced.

### `duplication` — Local simplicity and reuse
Repeated logic that should be one function; over-general abstractions with one caller.

### `cohesion` — Modules have one clear responsibility
Very large files or modules mixing unrelated concerns; long positional parameter lists.

### `errors` — Errors are handled, not swallowed
Empty catch blocks, ignored results, broad catches that hide the cause, missing cleanup on failure.

## Optional tools

Use only if already installed or already a project dependency: `knip`, `ts-prune`, `vulture`, `cargo udeps`, the project's own lint command. Record each as `used`, `absent`, or `skipped`. Tool output is a lead; confirm before reporting.

## Common false positives

- Code referenced only dynamically, from configuration, templates, or another language.
- Public API of a library that nothing inside the repository calls.
- Deliberately dormant features with a documented flag.
- Test fixtures and sample data that look like clutter.
