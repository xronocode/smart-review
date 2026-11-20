---
id: tests
version: 1.2.0
---

# Test section

## Question

Would this test suite catch a real regression before release, and can someone else run it?

## Scope

In scope: test code, fixtures, runner configuration, coverage configuration, documented test commands, and the CI steps that run tests.

The delivery section reviews branch protection and release gates. Here, inspect production code where it determines what a test can observe. Leave test fixes to the maintainer.

## Method

1. **Map the test surface.** From recon: test roots, runners, commands, which product surfaces have tests and which have none.
2. **Sample by risk, not by file order.** Read the tests around the code where a bug would hurt most (data integrity, security controls, money, state machines, parsers), then a sample of ordinary tests. Say how many test files you read out of how many exist.
3. **Walk the main user-visible features.** Identify core features from the README and registered entry points. Trace at least five when present, or all of them when fewer exist. Include ordinary flows alongside high-risk ones. For each, trace the public action to the test assertion that would detect a disconnected handler or wrong argument. Mounting a component or asserting only on a stub can leave the real action unprotected. In `checked[].note`, record the number traced out of the number identified, name the features sampled, and cite the entry points and assertions or gaps. If there are no user-visible flows, record 0 of 0 and the basis for marking `journeys` inapplicable.
4. **Check each assertion you cite against the code under test.** Ask of each suspicious test: what change to the product would make it fail? If none would, it is decorative. A test named as a regression test for a cleanup, an unmount, or an error path deserves this question in particular.
5. **Read existing results.** Never execute the reviewed project's code, including tests, collection, hooks, builds or coverage commands. A committed or supplied CI report may establish what ran. Record its producer, immutable artifact reference or path, tested commit, date or run ID, suite or job, and outcome. Match the revision and scope to the claim. A report from a different revision supplies historical context only.

## Evidence rules

- A finding names the test (file and line) and the product behavior it fails to protect.
- "Coverage is low" is not a finding without the specific unprotected behavior.
- A test that always passes, asserts only that a mock was called with what the test itself passed in, or asserts on a constant, is evidence for `assertions`.
- Skipped, focused (`.only`), or commented-out tests are evidence with their line.
- Do not report missing tests for generated, vendored, or trivially declarative code.
- Source can establish that a test is wired to a behavior, checks a meaningful outcome, and has a documented invocation. Use `unknown` for execution-dependent judgments without attributable results. A green badge, configured timeout or unrelated passing job gives no evidence about this suite's results, coverage or elapsed time.

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
Trace uncontrolled time, randomness, ordering, network or machine state to the assertion it affects. Configured retries warrant inspection. Claim observed flakiness only when attributable results show inconsistent outcomes under comparable conditions.

### `runnable` — Suite runs from a documented command
Trace the documented command to runner configuration and the CI job that selects the suite. Describe which invocation and prerequisites are discoverable. Claim a passing run only for a matching existing result and name the tested environment.

### `coverage` — Coverage is measured and meaningful
Inspect configured thresholds, the CI step that enforces them, and justified exclusions. Quote measured coverage only for the files, metric and revision identified by an existing report. Use `unknown` if neither measurement nor configuration is available.

### `data` — Fixtures and test data are explicit and isolated
Tests create what they need and clean up; no shared mutable fixtures.

### `doubles` — Test doubles are kept apart from real integration checks
It is clear which tests prove real integration and which prove behavior against fakes.

### `speed` — Feedback time is acceptable
Use attributable existing timings for the relevant suite and environment. A CI timeout is an upper limit on a job. Use `unknown` when actual elapsed time is unavailable.

### `maintainability` — Test code is maintainable
Helpers, naming, and structure let a newcomer add a test without copying a page of setup.

## Optional tools

None required. Inspect existing result artifacts as data.

## Common false positives

- A mock-heavy unit test next to a real integration test of the same behavior.
- Snapshot tests that are reviewed and small.
- A skip with a linked issue and a platform condition.
