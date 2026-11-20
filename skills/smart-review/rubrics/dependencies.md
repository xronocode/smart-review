---
id: dependencies
version: 1.2.0
---

# Dependency section

## Question

Can this project's dependencies be installed reproducibly and trusted, and which gaps matter most?

## Scope

In scope: manifests, lockfiles, vendored code, git and URL dependencies, package-manager configuration, install and build scripts, CI steps that install or download tools, update automation.

Inspect pinned manifests and lockfiles as data. Version and advisory comparisons may use a dated release catalogue, advisory snapshot or existing audit report. A live advisory lookup requires explicit user permission and an already installed, trusted scanner that reads the pinned inputs without executing project code. Installs, builds and dependency changes are outside this review.

## Method

1. **Inventory every source of third-party code.** Each ecosystem and each manifest: registry packages, git dependencies, vendored directories, downloaded binaries, CI actions, container base images, tools fetched at run time.
2. **Check reproducibility per source.** Is there a lockfile, is it used by the documented and CI install commands (`npm ci`, `--frozen-lockfile`, `--locked`), are integrity hashes present, are git dependencies pinned to a commit?
3. **Check acquisition paths outside the lockfile.** Search scripts, Makefiles, tool directories, and workflows for `npx`, `pnpm dlx`, `pipx run`, `go run pkg@latest`, `cargo install`, `curl … | sh`, unpinned actions and images. For every runner call (`npx <tool>`), open the script and decide which of three cases it is: the tool is undeclared (always a download); the tool is declared and the call cannot download (`--no-install`, `npm exec --no`, a `node_modules/.bin` path, or an explicit check that the local install exists); or the tool is declared but the call silently falls back to a registry download when `node_modules` is absent. The third case is a finding.
4. **Follow credentials.** For each job or script that holds signing keys, publishing tokens, or deployment credentials, list which third-party code runs in the same job before or while the credential is available: install scripts, build plugins, tools fetched at run time.
5. **Check install-time execution.** Lifecycle scripts, build scripts, and whether CI disables them where it can.
6. **Judge fit.** Runtime versus development separation, unused or duplicate packages, abandoned packages on critical paths, declared licenses.

## Evidence rules

- Cite the manifest or lockfile line, or the script line that fetches code.
- Give counts where you state them (packages per lockfile) and say how you counted.
- When a comparison actually uses mutable release, support or advisory data from outside the commit, set `checked[].asOf` on its observation to the source snapshot date (`YYYY-MM-DD`) or `"unknown"` if undated. This marks the section for fresh inspection on a selective repeat. Omit the field for commit-only observations and skipped lookups. In the same entry's `note`, identify the publisher, URL or artifact path, and snapshot revision, digest or identifier. For scanner results also record the tool/version, run date, input revision or lockfile digest, and ecosystems covered. A scan date alone cannot date the advisory database. Every finding still needs evidence lines on the reviewed commit.
- State which packages and ecosystems the snapshot covers and any gaps. Compare snapshots on repeat runs. If a package is unchanged and a new advisory or release appeared in the reference data, identify the changed evidence. Without a suitable reference, record the affected comparison as `unknown` with a limit. Use `na` when the source inventory establishes there are no relevant third-party dependencies.
- One unpinned pattern repeated in many scripts is one finding with several evidence lines.

## Severity anchors

- **critical** — a dependency or tool on the release or deployment path is fetched unpinned and executed with access to signing keys or deployment credentials.
- **high** — the primary install path is not reproducible (no lockfile, or the lockfile is not used); an unpinned fetch runs in CI with write permissions; third-party install or build scripts run unrestricted in the job that holds release signing keys or publishing credentials, when the project restricts them elsewhere or could restrict them here; a reachable, known-exploited vulnerable runtime dependency.
- **medium** — an undeclared tool fetched on a developer or test path; git dependency without integrity; install scripts enabled with no review process on paths without credentials; an abandoned package on a critical path; a shipped direct dependency whose declared license contradicts the project's own written license policy.
- **low** — a declared tool called through a runner that can fall back to a download on a developer or test path; unused or duplicated packages; a development dependency declared as runtime; missing update automation; license metadata gaps without a policy conflict.

## Criteria

### `inventory` — Dependency sources are inventoried
All sources of third-party code are discoverable from the repository. 5: every source is declared in a manifest or documented.

### `reproducible` — Installs are reproducible
Lockfiles exist for every ecosystem and the documented and CI commands honor them.

### `vulnerabilities` — State of known vulnerabilities
Match the advisory ID, ecosystem, package identity and affected range to the resolved version on this commit. Trace the package into a runtime or build path and check the advisory's platform, feature and usage conditions. Cite both the resolution and the consumer or build step. An entry for a different platform, a patched backport, or an optional dependency excluded from the build can refute a version-only hit. A clean scan describes only its inputs and snapshot date. If reachability or the match is unresolved, keep the lead unconfirmed.

### `separation` — Runtime, build, and test dependencies are separated
Production installs do not pull development tooling; the split matches actual use.

### `acquisition` — Packages and tools are fetched safely
No execution of code that bypasses the lockfile; registries and sources are explicit.

### `scripts` — Install and build scripts are controlled
Lifecycle scripts are known and limited; CI uses `--ignore-scripts` or an allow-list where practical.

### `freshness` — Dependencies are maintained and reasonably current
Compare the pinned version with a release or support snapshot for the same ecosystem, package, channel and supported major line. Cite the release, support date or maintenance policy alongside the locked version and project compatibility constraints. Explain the cost of lag, such as depending on a line past the publisher's support date. A newer prerelease or major version alone establishes no maintenance gap. A lockfile gives a resolved version but cannot establish the latest release. When one upgrade addresses a known advisory, keep one finding under `vulnerabilities` and reference its key here if relevant.

### `footprint` — No unused or duplicated dependencies
Packages declared but never imported; several libraries for one job; multiple major versions of one package without reason.

### `licenses` — Declared licenses are compatible
Best effort from manifest metadata and license files. State your confidence. `unknown` is acceptable.

### `updates` — Updates are a routine process
Update automation or a documented cadence exists and covers every ecosystem present, including CI actions.

## Optional tools

Use only trusted, already installed tools that read pinned inputs without loading target plugins, configuration code or install hooks. Record each as `used`, `absent`, or `skipped`. Obtain explicit permission before any online advisory lookup.

- Use `osv-scanner`, `npm audit`, `cargo audit` or `pip-audit` only in a read-only mode that inspects the existing resolution. Skip modes that install, resolve new versions or apply fixes.
- Existing `knip` or `depcheck` reports can supply leads about unused packages. Confirm each against imports, commands, registration and build configuration.

## Common false positives

- A package used only through a CLI in scripts or through configuration, reported as unused.
- A workspace or path dependency reported as unpinned.
- `npx` in a CI step that runs after a lockfile install in the same job: the local binary exists there. The fallback matters for scripts a person runs on a machine where the install may be missing.
