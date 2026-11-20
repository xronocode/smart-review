---
id: hygiene
version: 1.2.0
---

# Codebase hygiene section

## Question

How much avoidable friction does this codebase carry for the next person or agent who changes it?

## Scope

In scope: tracked files, build and maintenance commands, onboarding, structure, naming, leftovers, formatting and lint configuration, setting resolution, local duplication, parallel implementations, module cohesion, control flow, and error handling.

Out of scope: security impact (security rubric), test quality (test rubric), dependency choice (dependency rubric), architecture redesign, personal style preferences, anything in generated or vendored directories.

## Method

1. **Survey tracked files.** Use `git ls-tree -r -l <commit>` to inventory sizes, binary and build output, backup copies, environment files and tracked generated directories.
2. **Check the working surface.** Commands in the manifest, Makefile, or scripts directory; README steps; formatter and linter configuration and whether a command runs them.
3. **Sample code by size and churn.** Read the largest and most central source files and a sample of ordinary ones. Look for dead code, duplicated logic, mixed responsibilities, swallowed errors, magic values.
4. **Follow failure paths of operations that matter.** A search for empty catch blocks finds the obvious cases only. Pick the operations that persist user state (settings, permissions, recent files, bookmarks) or change the user's content (paste, drop, import, replace), and read what happens when each fails: is the error reported to anyone, and is a half-applied change rolled back? An ignored result (`let _ =`, a promise without a catch, a callback that drops its error) on such a path, or a failure that leaves the content changed, is evidence for `errors`.
5. **Confirm each lead.** Trace candidate leftovers from the project's entry points, including registrations and external consumers. For repeated logic, identify the behavior the callers rely on. For configuration, follow a setting through precedence and validation to its consumer.

## Evidence rules

- Every finding cites lines. For unused code, name the candidate, the supported entry points and the searches used to rule out callers.
- Group by root cause: fifteen files with the same leftover pattern are one finding with representative evidence and a count.
- State the cost in concrete terms: what a contributor has to know, check, or redo because of it.
- Do not report formatting differences line by line; report the missing or unenforced formatter once.

## Severity anchors

- **critical** — not used in this section unless the repository cannot be built or understood at all from its tracked state.
- **high** — the documented build or setup path does not work from a clean clone, or a core area is so entangled that routine changes need coordinated edits across many unrelated places.
- **medium** — a recurring source of mistakes: widespread swallowed errors in a core path; a failed user operation that silently loses persisted state or leaves the user's content changed without rollback or notice; a large dead subsystem that still looks live; hardcoded machine-specific paths in shared scripts; no enforced formatting on a multi-contributor code base; a mandatory contributor step that cannot be carried out from the repository's own instructions.
- **low** — local clutter: an unused export, a stale TODO cluster, a backup copy, an inconsistent name, a tracked build artifact.

## Criteria

### `dead-code` — Unused, disabled, and unreachable code
Check candidates against package exports, CLI manifests, build targets, framework conventions, plugin discovery, registries, reflection, templates, configuration and cross-language callers as applicable. Cite the declaration and evidence that the last supported path was removed or cannot reach it. A callback loaded by name or a public library export with no internal caller can be live. If an external consumer or registration remains unresolved, record the uncertainty. Use `na` for a repository with no maintained code.

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
Empty catch blocks, ignored results, broad catches that hide the cause, missing cleanup or rollback on failure. Score from the failure paths you followed in step 4, not from a pattern search alone.

### `configuration` — Configuration has predictable sources and precedence
Where a runtime, build or deployment setting is consumed, trace its declaration, default, overrides, precedence and validation to the value used. Cite the lines at which two consumers resolve the same setting differently, an advertised override is ignored, or an invalid value silently changes behavior. State the affected mode and consequence. An intentional per-environment override with documented precedence is a valid configuration. Use `na` if there are no such settings and `unknown` if effective resolution is delegated to unavailable tooling. Keep machine-specific paths under `env` and unnamed literals under `constants` unless the defect is in how a setting is resolved.

### `unification` — Equivalent operations follow the same contract
Identify entry points that promise the same behavior, such as a CLI and a batch importer using the same normalization rule. Cite the shared contract and both call paths. If they diverge, name the condition that changes the result or the policy update that requires independent edits. A shared implementation can satisfy the contract at both entry points. Respect intentional differences between API versions, platform adapters and compatibility paths.

Use `na` when there are no comparable operations and `unknown` when the intended equivalence cannot be established. Local repeated logic belongs to `duplication`. Keep a single `unification` finding when drift between separate implementations is the cost.

### `complexity` — Concentrated control flow can be changed safely
Use the size and churn sample to locate concentrations of branching, mutable state or side effects. Trace a maintained operation in the strongest candidate. Cite where a branch sets state and where another relies on it, or where several exits independently restore the same invariant. Describe a realistic change and the paths a maintainer must reason about together. A large declarative dispatch table with independent entries can be straightforward to change.

Use `na` for a purely declarative surface and `unknown` when the relevant behavior cannot be traced. Keep unrelated responsibilities under `cohesion`, and a concrete failure to clean up under `errors`. Cite the same finding key if one fix addresses both.

## Optional tools

Use already installed, trusted static analyzers such as `knip`, `ts-prune`, `vulture` or `cargo udeps` only in modes that read the pinned files without building, writing to the target or loading its code or plugins. Otherwise use an existing report with its tool, revision and scope. Record each tool as `used`, `absent` or `skipped`, and confirm candidates against source. Read the project's own lint command as text.

## Common false positives

- Code referenced only dynamically, from configuration, templates, or another language.
- Public API of a library that nothing inside the repository calls.
- Deliberately dormant features with a documented flag.
- Test fixtures and sample data that look like clutter.
