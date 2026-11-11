---
id: security
version: 1.0.0
---

# Security audit

## Question

Which confirmed, reachable security weaknesses exist in this repository at this commit, and which should be fixed first?

## Scope

In scope: source, configuration, build and release scripts, CI workflows, manifests and lockfiles, and documentation that states security behavior, all as they are on the audited commit.

Out of scope: running the application, its tests, or its install scripts; probing live sites or services; querying vulnerability databases unless a scanner that is already installed does it; git history beyond the audited commit; anything that is only a style preference.

## Method

Work in two passes. Do not skip the first.

1. **Map the attack surface.** From the recon map, list every place where data crosses a trust boundary: network handlers, IPC and RPC commands, CLI arguments, file and clipboard import, deep links, extension or plugin APIs, webviews, templates, deserializers, update channels, CI inputs. For each, name who controls the input and what the code may reach from there (disk, shell, network, DOM, credentials, other users' data).
2. **Trace each entry point to its sinks.** Follow the input through the code to the sensitive operation. A finding exists only where you can name the input, the path, and the missing or broken control. Read the control itself (sanitizer, permission check, path canonicalization) instead of trusting its name.

Secondary renderers and helper binaries are part of the surface. A hardened main application does not cover a preview extension, a companion script, an installer, or a worker that renders or executes the same untrusted content with its own code.

## Evidence rules

- A finding needs the entry point and the sink as evidence lines, and one sentence stating the condition under which it is reachable.
- State what the weakness does *not* allow when that bounds the impact (for example: sandboxed, local-only, needs a prior user action).
- An absent defense is not a finding by itself. "No rate limit", "no CSP", or "no input schema" becomes a finding only with a concrete path where the absence lets an attacker do something. Otherwise record it under the criterion note or as an open question.
- Never copy a secret value into the output. Give the file and line, the kind of secret, and at most its first four characters.
- Dependency advisories belong to the dependencies audit. Here, report only how the project fetches and executes third-party code.

## Severity anchors

- **critical** — unauthenticated or default-reachable code execution, authentication bypass, a committed live credential for a production system, or cross-tenant data access.
- **high** — code execution or data exfiltration that needs one plausible precondition (a crafted file the product is meant to open, a logged-in low-privilege user), or an integrity break in the update or release path.
- **medium** — a real weakness bounded by a sandbox, an optional component, local-only reach, or an unusual precondition.
- **low** — a weakness needing several preconditions or developer-machine-only reach, with limited consequence.
- **info** — a hardening note with no demonstrated path.

## Criteria

### `secrets` — Secrets and credentials
Search tracked files for key formats, tokens, private keys, connection strings, and `.env` files; read how secrets reach the code and CI. 5: no secrets tracked, secrets injected at run time, examples use placeholders. 3: no live secrets, but handling is ad hoc or examples look real. 0–1: a usable credential is committed.

### `authn` — Authentication and sessions
How callers prove identity: tokens, pairing, sessions, cookies, expiry, revocation, comparison of secrets. 5: every non-public entry point checks a credential of adequate entropy, compared safely, revocable. Mark `na` when the product has no authenticated surface.

### `authz` — Authorization and data isolation
After identity is known, can a caller act on objects that are not theirs? Check ownership on every read and write, including resume, replace, and delete paths. 5: ownership and scope checked at the operation, with tests.

### `input` — Input validation at trust boundaries
Types, sizes, encodings, and paths are checked where data enters, not deep inside. 5: boundary parsers reject malformed input and limit size. 2: validation exists on some entry points only.

### `injection` — Command, query, and template injection
Shell calls, SQL and other query languages, template engines, `eval`-like sinks. 5: arguments passed as lists, queries parameterized, no dynamic code from input.

### `rendering` — Rendering of untrusted content
HTML, Markdown, SVG, diagrams, and rich text shown in a browser or webview. Check every renderer separately. 5: sanitized or inert by construction in all renderers, with a restrictive content policy. 0–2: at least one renderer executes active content from a document the product is meant to open.

### `network` — Outbound requests and cross-origin rules
URLs built from input (request forgery), redirects, proxy use, CORS, CSRF on state-changing routes. 5: destinations are allow-listed or derived from configuration; state-changing routes need a credential that a third-party page cannot send.

### `files` — File access, import, and export
Path traversal, symlink following, overwrite of unintended files, executable file types opened from links, size limits. 5: paths canonicalized and confined, dangerous types refused.

### `crypto` — Cryptography, tokens, and update integrity
Randomness source, algorithm choice, key storage, signature and checksum verification of updates and downloads. 5: platform primitives, verified updates, no home-made schemes.

### `supply` — Dependency acquisition and build-time execution
Where the project downloads and runs third-party code outside a lockfile: `npx` or `pipx` without a pinned local tool, `curl | sh`, unpinned CI actions, install scripts enabled by default. 5: everything pinned and verified; tools run from the lockfile.

### `logging` — Logging and error disclosure
Secrets or personal data written to logs, stack traces returned to callers. 5: logs name keys and outcomes, not values.

### `hardening` — Platform hardening and security configuration
Content policy, sandbox and capability settings, security headers in repository-owned configuration, debug-only routes, rate limits where abuse is plausible. Score what the configuration on this commit actually enforces.

### `sectests` — Security regression tests
Tests that would fail if a specific control were removed (sanitizer, ownership check, path confinement). 5: the main controls each have such a test. 2: controls exist but nothing pins them.

## Optional tools

Use only if already installed; record each as `used`, `absent`, or `skipped`.

- `gitleaks detect --no-git --redact --source .` for secret formats. Always pass `--redact`.
- `semgrep --config auto --metrics=off` is **not** allowed (it fetches rules from the network); use `semgrep` only with a rule directory already present in the repository.

A scanner result is a lead. Read the code before turning it into a finding.

## Common false positives

- Test fixtures, documentation examples, and placeholders that look like keys.
- A dangerous call that only receives constants.
- A missing defense in a component that never sees untrusted input.
- A weakness already closed by a control one layer up; check the caller before reporting the callee.
