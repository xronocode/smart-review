---
id: tests
version: 1.1.0
---

# Test audit

## Question

Would this test suite catch a real regression before release, and can someone else run it?

## Scope

In scope: test code, fixtures, runner configuration, coverage configuration, documented test commands, and the CI steps that run tests.

Out of scope: branch protection and release gating (not part of this version); production code quality except where it makes code untestable; rewriting tests.

## Method

1. **Map the test surface.** From recon: test roots, runners, commands, which product surfaces have tests and which have none.
2. **Sample by risk, not by file order.** Read the tests around the code where a bug would hurt most (data integrity, security controls, money, state machines, parsers), then a sample of ordinary tests. Say how many test files you read out of how many exist.
3. **Walk the main user-visible features.** Risk-first sampling misses ordinary features whose tests look fine. Take the features the README or the recon surfaces present as the product's core (at least five: for an editor, things like creating a table, typing a heading, saving, searching; for a service, its main endpoints). For each, find the UI action or entry point in the code, then find the test that would fail if that entry point were disconnected or called with wrong arguments. A feature whose only tests mount the component, stub the action, or assert on the stub is unprotected, however many tests mention it.
4. **Check each assertion you cite against the code under test.** Ask of each suspicious test: what change to the product would make it fail? If none would, it is decorative. A test named as a regression test for a cleanup, an unmount, or an error path deserves this question in particular.
5. **Optional bounded run.** You may run the documented test command once if the user allowed commands, it needs no secrets, no network services, and no undeclared setup, and it is expected to finish within ten minutes. Never retry until green, never install anything that the lockfile does not declare. If you do not run it, say so in limits; a documented command is then "discoverable", not "passing".

## Evidence rules

- A finding names the test (file and line) and the product behavior it fails to protect.
- "Coverage is low" is not a finding without the specific unprotected behavior.
- A test that always passes, asserts only that a mock was called with what the test itself passed in, or asserts on a constant, is evidence for `assertions`.
- Skipped, focused (`.only`), or commented-out tests are evidence with their line.
- Do not report missing tests for generated, vendored, or trivially declarative code.

## Severity anchors

- **critical** — the suite cannot detect breakage of a core guarantee and gives a false green (for example, the only test of an authorization check always passes).
- **high** — a primary user-facing surface or a security or data-integrity control has no effective test, or the suite cannot be run by anyone but its author.
- **medium** — a core user-visible feature or a meaningful behavior is protected only by decorative, stubbed, or flaky tests; important paths skipped.
- **low** — local weaknesses: duplicated setup, an unpinned time or random source, a slow test, a missing edge case in otherwise good coverage.

## Criteria

### `purpose` — Tests target behavior that matters
Do tests follow product risk, or are they concentrated on easy code? 5: the riskiest behaviors are visibly the best tested.

### `regression` — Tests would fail on a real regression
Pick three plausible bugs in core code and check whether a test would catch each. 5: all three would be caught.

### `assertions` — Assertions prove outcomes
Assertions check results, state, and error contents, not only that code ran. 2 or lower if you find decorative assertions in important areas.

### `unit` — Logic is tested in isolation
Pure logic has fast tests without real IO.

### `integration` — Component boundaries are exercised
Real collaboration between modules, storage, IPC, or HTTP layers is tested somewhere, not only mocked.

### `journeys` — User-visible flows are covered end to end
At least the main flows run through the real UI or public interface. `na` for libraries without a user-facing flow.

### `failure` — Error and negative paths
Invalid input, denied permission, missing resource, and failure of a dependency are tested.

### `edges` — Boundary and edge cases
Empty, maximal, unicode, concurrent, and off-by-one cases where they matter.

### `state` — State transitions and ordering-sensitive paths
Sequences, undo and redo, retries, races, lifecycle. `na` when the product is stateless.

### `determinism` — Deterministic and environment-independent
No dependence on wall-clock time, random seeds, test order, network, or a developer's machine. Retries configured in the runner are evidence of flakiness, not a fix.

### `runnable` — Suite runs from a documented command
The README or contributor guide gives one command per suite, and CI uses the same commands.

### `coverage` — Coverage is measured and meaningful
A threshold exists, is enforced, and excludes are justified. `unknown` when no coverage evidence is in the repository.

### `data` — Fixtures and test data are explicit and isolated
Tests create what they need and clean up; no shared mutable fixtures.

### `doubles` — Test doubles are kept apart from real integration checks
It is clear which tests prove real integration and which prove behavior against fakes.

### `speed` — Feedback time is acceptable
Evidence from CI configuration or timings in the repository. `unknown` if there is none; do not guess.

### `maintainability` — Test code is maintainable
Helpers, naming, and structure let a newcomer add a test without copying a page of setup.

## Optional tools

None required. Coverage reports already committed or produced by the bounded run may be cited.

## Common false positives

- A mock-heavy unit test next to a real integration test of the same behavior.
- Snapshot tests that are reviewed and small.
- A skip with a linked issue and a platform condition.
