---
id: security
version: 1.2.0
---

# Security section

## Question

Which confirmed, reachable security weaknesses exist in this repository at this commit, and which should be fixed first?

## Scope

In scope: source, configuration, build and release scripts, CI workflows, manifests and lockfiles, and documentation that states security behavior, all as they are on the reviewed commit.

Review the pinned source statically. Running target code, testing credentials, sending API requests, generating payloads, developing exploits or reproducing attacks are outside this method. Dependency advisory evidence belongs in the dependencies section.

## Method

Work in two passes. Do not skip the first.

1. **Map the attack surface.** From the recon map, list every place where data crosses a trust boundary: network handlers, IPC and RPC commands, CLI arguments, file and clipboard import, deep links, extension or plugin APIs, webviews, templates, deserializers, update channels, CI inputs. For each, name who controls the input and what the code may reach from there (disk, shell, network, DOM, credentials, other users' data).
2. **Trace each entry point to its sinks.** Follow the input through the code to the sensitive operation. A finding exists only where you can name the input, the path, and the missing or broken control. Read the control itself (sanitizer, permission check, path canonicalization) instead of trusting its name.

Secondary renderers and helper binaries are part of the surface. A hardened main application does not cover a preview extension, a companion script, an installer, or a worker that renders or executes the same untrusted content with its own code.

## Evidence rules

- A finding needs the entry point and the sink as evidence lines, and one sentence stating the condition under which it is reachable.
- State what the weakness does *not* allow when that bounds the impact (for example: sandboxed, local-only, needs a prior user action).
- An absent defense is not a finding by itself. "No rate limit", "no CSP", or "no input schema" becomes a finding only with a concrete path where the absence lets an attacker do something. Otherwise record it under the criterion note or as an open question.
- Redact credential values in full. Give the file, line, credential kind and consumer. A source trace can establish exposure or use of a default. Current validity, revocation and deployment require separate evidence.
- Dependency advisories belong to the dependencies section. Here, report only how the project fetches and executes third-party code.

## Severity anchors

- **critical** — unauthenticated or default-reachable code execution, authentication bypass, a committed live credential for a production system, or cross-tenant data access.
- **high** — code execution or data exfiltration that needs one plausible precondition (a crafted file the product is meant to open, a logged-in low-privilege user), or an integrity break in the update or release path.
- **medium** — a real weakness bounded by a sandbox, an optional component, local-only reach, or an unusual precondition.
- **low** — a weakness needing several preconditions or developer-machine-only reach, with limited consequence.
- **info** — a hardening note with no demonstrated path.

## Criteria

### `secrets` — Secrets and credentials
Search tracked source, configuration (including environment files), examples and CI inputs for tokens, private keys and credential-bearing connection strings. Cite the declaration and evidence identifying its use or intended recipient. Public verification keys and references to injected secrets are legitimate. An example value still matters if a shipped authentication path accepts it as a default. Rate exposure and injection from the traced use and report search coverage. Keep ambiguous values unconfirmed. A source-only review cannot establish that an account is live.

### `authn` — Authentication and sessions
For each caller type on a protected surface, cite the entry point, where the identity check is attached, and what happens when proof is missing, invalid or expired. For credentials and sessions the project issues, check randomness, comparison, expiry and revocation. A deliberately anonymous route or a handler wrapped by verified router middleware can legitimately lack a local check. Mark `na` when the product has no authenticated surface. If identity is delegated, judge the binding and failure behavior visible here. Use `unknown` for a decision that depends entirely on unavailable provider configuration.

### `authz` — Authorization and data isolation
After identity is known, can a caller act on objects that are not theirs? Check ownership on every read and write, including resume, replace, and delete paths. 5: ownership and scope checked at the operation, with tests.

### `api-access` — Public API behavior matches declared permissions
Inventory externally callable API operations, including authenticated ones, from registrations and published contracts. In `checked`, give operations traced / identified for each API family and version (including unversioned routes). Name uncovered operations or groups in `limits`. A shared handler counts for each version only after checking its binding and any version-specific policy or serializer.

For each traced operation, cite the declared caller, action, permitted records and response fields. Follow the registration to its effective guard, the read or write that selects records, and the projection that produces the response. Cite field names and redact data values. For a command returning no data, cite the empty response contract. A finding needs a policy clause and source lines showing a concrete mismatch. An internal model containing a restricted field can still be safe when the bound serializer omits it.

Use `na` when the inventory establishes that the project exposes no public API. Use `unknown` when there is an API but the policy or enforcement needed for comparison is unavailable. Limit partial judgments to the traced operations. Keep one finding for a shared cause across versions or criteria. Attribute a broken identity check to `authn`, a public API policy mismatch to `api-access`, and other operation-level isolation gaps to `authz`. Cross-reference the same key wherever the evidence overlaps.

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
Where the project downloads and runs third-party code outside a lockfile: `npx` or `pipx` without a pinned local tool, `curl | sh`, unpinned CI actions, install scripts enabled by default. A runner such as `npx <tool>` or `pnpm dlx` falls back to downloading whatever the registry serves when the tool is not installed locally, even if the tool is a declared dependency: read each script that calls one and check whether it verifies the local install first or forbids the download (`npx --no-install`, `npm exec --no`, a direct `node_modules/.bin` path). Search scripts and tool directories, not only workflows. 5: everything pinned and verified; tools run from the lockfile and cannot fall back to a download.

### `logging` — Logging and error disclosure
Secrets or personal data written to logs, stack traces returned to callers. 5: logs name keys and outcomes, not values.

### `hardening` — Platform hardening and security configuration
Content policy, sandbox and capability settings, security headers in repository-owned configuration, debug-only routes, rate limits where abuse is plausible. Score what the configuration on this commit actually enforces.

### `sectests` — Security regression tests
Tests that would fail if a specific control were removed (sanitizer, ownership check, path confinement). 5: the main controls each have such a test. 2: controls exist but nothing pins them.

## Optional tools

Use only if already installed; record each as `used`, `absent`, or `skipped`.

- Use a trusted installed Gitleaks with redaction enabled only when its input contains the pinned commit's blobs and its configuration comes from a trusted location. If only a working-directory scan is available, read the committed blobs directly and record the scanner as skipped. Mask secrets in all output.
- `semgrep --config auto --metrics=off` is **not** allowed (it fetches rules from the network); use `semgrep` only with a rule directory already present in the repository.

A scanner result is a lead. Read the code before turning it into a finding.

## Common false positives

- Test fixtures, documentation examples, and placeholders that look like keys.
- A dangerous call that only receives constants.
- A missing defense in a component that never sees untrusted input.
- A weakness already closed by a control one layer up; check the caller before reporting the callee.
