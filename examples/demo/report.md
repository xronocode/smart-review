# Repository review: notes-api

**Overall score: 67/100** (Needs work)

- Commit: `b81099ba23c4dd039a8781ce57095209c12a22d1`
- Branch: `main`
- Profile: quick
- Date: 2026-11-12

### Overall score calculation

- Mean of the sections that ran: 67
- Cap applied: a high finding caps the overall score at 69 → 67
- Result: 67/100

| Sections | /100 | Findings |
|---|---|---|
| Security | 64 | 2 high, 1 medium |
| Tests | 69 | 1 high, 1 medium |
| Dependencies | 69 | 1 high, 1 medium |

## Security — 64/100

**Any caller can read any note and any file under the service directory; fix both before exposing the service.**

Two problems are reachable without credentials: the note-by-id route returns notes of other users, and the export route builds a file path from the URL. The service trusts an x-user header as identity, which makes both worse. Request bodies are parsed as JSON with the framework default limit, and no secrets are tracked. Nothing was executed, so runtime behavior behind a proxy is not confirmed.

### Findings

#### F-001 · High · Export route reads files outside the exports directory

- **What was found:** GET /export/:file concatenates the URL segment into a filesystem path and passes it to sendFile without normalizing or confining it.
- **Why it matters:** An unauthenticated caller can request encoded parent segments and read any file the process can read, including source and environment files. It does not allow writing files.
- **What to do:** Resolve the requested name against the exports directory and refuse anything that leaves it; prefer the root option of sendFile. Keep the route read-only.
- **Affected:** File export
- **Evidence:** `src/server.js:20`, `src/server.js:19`
- **How to verify the fix:** A request for an encoded parent path returns 400 or 404.; A test requests a file outside exports/ and asserts it is refused.
- **Verification pass:** confirmed, high confidence. Re-read src/server.js:19-21; no normalization, no root option, no allow-list on this path.

#### F-002 · High · A note can be read by id without checking its owner

- **What was found:** GET /notes/:id returns readNote(id) directly; the list route filters by owner but the single-note route does not.
- **Why it matters:** Any caller can enumerate ids and read every user's notes. Ids are sequential, so enumeration is trivial.
- **What to do:** Check the note owner against the caller in the route or in readNote, and return 404 for notes of other users.
- **Affected:** Reading notes
- **Evidence:** `src/server.js:10`, `src/store.js:8`, `src/store.js:13`
- **How to verify the fix:** A request for another user's note id returns 404.; A test creates notes for two users and asserts the cross-read fails.
- **Verification pass:** confirmed, high confidence. Re-read src/server.js:9-13 and src/store.js:8-10; no owner comparison anywhere on the path.

#### F-003 · Medium · Caller identity is taken from a client-supplied header

- **What was found:** Routes use the x-user request header as the user identity; nothing in this repository authenticates it.
- **Why it matters:** A caller can act as any user by setting the header, unless a gateway outside this repository strips and sets it. That gateway is not visible here.
- **What to do:** Authenticate in the service, or document and enforce that only a trusted proxy can reach it and that it overwrites the header.
- **Affected:** All note routes
- **Evidence:** `src/server.js:7`, `src/server.js:16`
- **How to verify the fix:** Requests without a valid credential are rejected with 401.
- **Verification pass:** severity lowered, medium confidence. Lowered from high: a deployment behind an authenticating proxy is plausible and cannot be ruled out from the repository. Re-read src/server.js:1-23.

### Open questions (not scored)

- **No request rate limit.** No limiter is configured, but no concrete abuse path beyond the findings above was traced.

### State by criterion

Criteria describe the state; they do not change the score.

| | /5 | |
|---|---|---|
| Secrets and credentials | 5 | No key formats or environment files among 6 tracked files. |
| Authentication and sessions | 1 | Identity is an unauthenticated header (F-003). |
| Authorization and data isolation | 1 | List filters by owner; read by id does not (F-002). |
| Input validation at trust boundaries | 3 | JSON body parsing with default limits; note text is not validated. |
| Command, query, and template injection | n/a | No shell, query language, or template engine is used. |
| Rendering of untrusted content | n/a | The service returns JSON only. |
| Outbound requests and cross-origin rules | n/a | No outbound requests. |
| File access, import, and export | 1 | Export path is built from the URL (F-001). |
| Cryptography, tokens, and update integrity | n/a | No cryptography or update channel. |
| Dependency acquisition and build-time execution | 3 | The export script fetches a tool with npx outside the lockfile; reported in the dependency section. |
| Logging and error disclosure | 4 | No logging of request bodies. |
| Platform hardening and security configuration | 2 | No security headers or limits configured in the repository. |
| Security regression tests | 0 | No test pins ownership or path confinement. |

### Strengths

- No secrets are tracked.
- The notes list is filtered by owner.

### Score calculation

- Starting score: 100
- High: 2 × 15 = −30 → 70
- Medium: 1 × 6 = −6 → 64
- Result: 64/100

### What was checked

- **Entry points.** Traced all 4 HTTP routes in src/server.js to the store and filesystem calls.
- **Secrets.** Searched all 6 tracked files for key formats.

### Limits

- The service was not started and no requests were sent. — *Effect on the conclusion:* Framework-level path handling was judged from the code, not observed.
- Deployment configuration is not in the repository. — *Effect on the conclusion:* Whether a proxy authenticates callers is unknown; F-003 is rated with that in mind.

### Tools

- gitleaks: not installed

## Tests — 69/100

**The suite would not catch a broken route or a broken ownership rule: only the in-memory store has tests, and one of the two is decorative.**

Two tests exist, both for the store. Nothing exercises the HTTP routes, so the two security problems found in the security section could be introduced or fixed without any test changing. The suite runs from a documented command and is deterministic. Coverage is not measured.

### Findings

#### F-001 · High · No test exercises the HTTP routes

- **What was found:** The only test file imports the store module. The four routes in src/server.js, including ownership and file export, have no test.
- **Why it matters:** The primary user-facing surface can break or leak data with a green suite.
- **What to do:** Add route-level tests that start the app on an ephemeral port and cover list, read, create, and export, including cross-user access.
- **Affected:** All routes
- **Evidence:** `test/store.test.js:3`, `src/server.js:7`
- **How to verify the fix:** A test fails when the owner filter is removed from the list route.
- **Verification pass:** confirmed, high confidence. Listed tracked test files: one. Re-read test/store.test.js:1-12; no import of server.js.

#### F-002 · Medium · The list test passes for any result

- **What was found:** The test asserts only that listNotes returns a truthy value; an empty array is truthy.
- **Why it matters:** Removing or inverting the owner filter would not fail the test.
- **What to do:** Assert the exact notes returned for two different owners.
- **Affected:** Listing notes
- **Evidence:** `test/store.test.js:11`
- **How to verify the fix:** The test fails when the filter in listNotes is removed.
- **Verification pass:** confirmed, high confidence. Re-read test/store.test.js:10-12 against src/store.js:4-6.

### State by criterion

Criteria describe the state; they do not change the score.

| | /5 | |
|---|---|---|
| Tests target behavior that matters | 2 | Tests cover the simplest module, not the routes. |
| Tests would fail on a real regression | 1 | Of three plausible bugs (owner filter, id lookup, export path) none would be caught. |
| Assertions prove outcomes | 2 | One decorative assertion out of two tests. |
| Logic is tested in isolation | 3 | Store logic is tested in isolation, thinly. |
| Component boundaries are exercised | 0 | No route or boundary test. |
| User-visible flows are covered end to end | 0 | No end-to-end flow. |
| Error and negative paths | 0 | No negative case. |
| Boundary and edge cases | 0 | No boundary case. |
| State transitions and ordering-sensitive paths | 1 | Shared module state between tests is not reset. |
| Deterministic and environment-independent | 4 | No time, random, or network dependence. |
| Suite runs from a documented command | 5 | README documents npm test. |
| Coverage is measured and meaningful | not established | No coverage configuration or report in the repository. |
| Fixtures and test data are explicit and isolated | 2 | Tests rely on shared in-memory state. |
| Test doubles are kept apart from real integration checks | n/a | No test doubles are used. |
| Feedback time is acceptable | not established | No timing evidence in the repository. |
| Test code is maintainable | 4 | Small and readable. |

### Strengths

- One documented command runs the suite.
- Tests are deterministic.

### Score calculation

- Starting score: 100
- High: 1 × 15 = −15 → 85
- Medium: 1 × 6 = −6 → 79
- Cap applied: a high finding caps the score at 69
- Result: 69/100

### What was checked

- **Test files.** Read the only test file (1 of 1) and both modules under test.

### Limits

- The test command was not run. — *Effect on the conclusion:* The suite is known to be discoverable, not known to pass.

## Dependencies — 69/100

**Installs are not reproducible: there is no lockfile, and one script downloads a tool at run time.**

The project declares one runtime dependency with a caret range and tracks no lockfile, so two installs can differ. The export script runs a tool through npx that is not a declared dependency. No scanner was available, so the state of known vulnerabilities is not established.

### Findings

#### F-001 · High · No lockfile is tracked

- **What was found:** package.json declares express with a caret range and the repository has no package-lock.json; the README tells users to run npm ci, which requires one.
- **Why it matters:** Installs are not reproducible and the documented install command fails on a clean clone.
- **What to do:** Generate and commit package-lock.json and keep npm ci as the documented command.
- **Affected:** Installation
- **Evidence:** `package.json:11`, `README.md:6`
- **How to verify the fix:** npm ci succeeds on a clean clone.
- **Verification pass:** confirmed, high confidence. git ls-files shows no lockfile; re-read package.json and README.md.

#### F-002 · Medium · Export script downloads an undeclared tool with npx

- **What was found:** The export script runs npx json2csv-cli; the package is not in dependencies or devDependencies, so npx resolves and downloads it at run time.
- **Why it matters:** Whatever version the registry serves runs with the developer's permissions. Reach is limited to machines that run the export script.
- **What to do:** Declare the tool as a devDependency so it is pinned by the lockfile, and call it through an npm script.
- **Affected:** Data export script
- **Evidence:** `package.json:8`
- **How to verify the fix:** The tool appears in the lockfile and npx resolves it locally.
- **Verification pass:** confirmed, high confidence. Re-read package.json:5-12; the package is not declared.

### State by criterion

Criteria describe the state; they do not change the score.

| | /5 | |
|---|---|---|
| Dependency sources are inventoried | 4 | One ecosystem, one manifest, plus one undeclared tool. |
| Installs are reproducible | 0 | No lockfile (F-001). |
| State of known vulnerabilities | not established | No scanner installed and no committed section report. |
| Runtime, build, and test dependencies are separated | 4 | One runtime dependency; no development dependencies declared. |
| Packages and tools are fetched safely | 2 | npx fetch outside the manifest (F-002). |
| Install and build scripts are controlled | 3 | No lifecycle scripts in the project itself; third-party scripts are not restricted. |
| Dependencies are maintained and reasonably current | not established | Without a lockfile the installed versions are not determined. |
| No unused or duplicated dependencies | 5 | One dependency, used. |
| Declared licenses are compatible | not established | The project declares no license. |
| Updates are a routine process | 0 | No update automation. |

### Strengths

- A single small runtime dependency.

### Score calculation

- Starting score: 100
- High: 1 × 15 = −15 → 85
- Medium: 1 × 6 = −6 → 79
- Cap applied: a high finding caps the score at 69
- Result: 69/100

### What was checked

- **Manifests.** Read package.json and the tracked file list for lockfiles and vendored code.
- **Scripts.** Read all 3 npm scripts for run-time fetches.

### Limits

- No vulnerability scanner was available. — *Effect on the conclusion:* Known advisories for express are not assessed.

### Tools

- osv-scanner: not installed
- npm audit: skipped — No lockfile to audit.

---

Scores are computed by the smart-review CLI from confirmed findings only. smart-review 2.0.0, scoring v3.
