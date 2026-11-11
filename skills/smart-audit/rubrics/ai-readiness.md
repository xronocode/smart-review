---
id: ai-readiness
version: 1.0.0
---

# AI readiness audit

## Question

Can a coding agent take a task in this repository from request to verified change without tribal knowledge?

## Scope

In scope: agent instruction files (`AGENTS.md`, `CLAUDE.md`, tool-specific rules), README and contributor documentation, architecture and decision records, plans and task tracking kept in the repository, scripts and commands that verify a change, repository layout, and environment setup files.

Out of scope: which model or agent the team uses; code style; whether CI enforces the checks (not part of this version); guessing whether code was written by an agent.

## Method

1. **Read as a newcomer agent would.** Start from the root instruction file and follow only what it points to. Note where the trail stops.
2. **Walk one realistic task.** Pick a plausible small change in the main product area and write down, from repository evidence only: where the code is, what must not break, how to run the relevant check, how to know the task is done, and where to record what was done. Every step you cannot answer from the repository is evidence.
3. **Cross-check instructions against the code.** Open the commands, paths, and conventions the documentation names and confirm they exist on this commit. A stale instruction is worse than none.

## Evidence rules

- Cite the instruction line and, for contradictions, the code or configuration line that disagrees.
- A missing file with a conventional name is not a finding. The finding is the missing *information*, wherever it should live.
- A documented command counts as discoverable. Do not claim it passes unless you ran it under the test rubric's bounded-run rule.
- Volume is not quality: a long instruction file that repeats generic advice scores lower than a short one with repository-specific facts.

## Severity anchors

- **critical** — instructions direct an agent to do something destructive or unsafe by default (run against production, commit secrets, force-push).
- **high** — an agent cannot verify its own work: no discoverable way to run tests or checks for the main product area; or core instructions contradict the code so that following them breaks the build.
- **medium** — a significant gap that forces repeated prompting: no definition of done, stale paths or commands in the main instruction file, product intent absent for the main feature area, guidance that only works in one tool.
- **low** — polish: thin navigation aids, missing handoff conventions, minor drift.

## Criteria

### `entry` — Agent entry instructions exist and are accurate
A root instruction file states what the project is, how it is laid out, and the rules that matter, and what it says is true on this commit.

### `context-tech` — Technical context is written down
Architecture, module boundaries, data flow, and key invariants are recoverable from documents, not only from code.

### `context-product` — Product intent is written down
What the product is for, who uses it, and what must stay true for them.

### `context-process` — Working process is written down
Branching, review, release, and how changes are proposed and accepted.

### `task-path` — A task has a path to a definition of done
Acceptance criteria, plans, or specifications are kept where an agent can find them and are tied to verification.

### `verification` — Completion is machine-checkable
Commands for tests, type checks, linters, and builds are documented, scoped (per package or area), and fast enough to use during work.

### `navigation` — Code is discoverable without reading everything
Naming, directory layout, module maps, and indexes let an agent find the right file with a search.

### `portability` — Guidance works across agents
Core guidance lives in tool-neutral files; tool-specific files add to it instead of forking it.

### `memory` — Decisions and work state survive between sessions
Decision records, changelogs, and plans capture why things are as they are and what is in progress.

### `safety` — The environment is safe to set up and run
Setup needs no production credentials, destructive commands are marked, secrets have templates, and the default configuration is safe.

### `consistency` — Documentation agrees with the code
No contradictions between instruction files, or between instructions and the repository. Score from the cross-check in step 3.

## Optional tools

None.

## Common false positives

- Penalizing a repository for not using a particular framework, file name, or agent.
- Counting generated documentation as written context.
- Treating absent CI evidence as a readiness gap.
