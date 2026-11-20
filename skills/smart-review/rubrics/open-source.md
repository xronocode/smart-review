---
id: open-source
version: 1.0.0
---

# Open-source readiness section

## Question

Can an outside adopter identify what they may use, get a usable distribution and follow the project's stated path for contributions?

## Scope

Review the project from the perspective of a person outside the maintainer's organization. Start from an offer to distribute source, a stated plan to open the project, or an invitation to contribute. Check the project's own terms, packaged contents, first use and maintainer handoff. Third-party dependency license policy belongs to dependencies, broken internal setup to hygiene, and enforcement of release jobs to delivery.

## Method

1. Start with recon's docs, manifests and entry points. Identify the intended audience, any public and private subpackages, and how an outsider is told to obtain the project. Select one advertised distribution and one permitted contribution, such as a bug report, documentation change or patch. Record which channels and packages these represent.
2. Follow the advertised version from the landing page to the source tree, package manifest or archive recipe. Resolve local license and notice references, their scope and any exceptions for bundled assets. Check inclusion and exclusion rules for the offered entry point, instructions and terms. Read a supplied artifact inventory if available. A packaging recipe supports a prediction about its output.
3. Walk the shortest documented first use on paper as an external user. Resolve required files, imports, commands, example inputs and expected output against the shipped entry point. Identify the first step that requires internal credentials, unpublished artifacts or organization-only tooling. Check for a documented public substitute.
4. Follow the selected contribution from the advertised intake route to the material a maintainer needs to act. For a patch, find the target branch or area, applicable checks and submission route. For a report, find the template or required diagnostic details and recipient. Check who handles an ordinary issue and where a sensitive report is directed if the project offers that channel. Judge the contribution types the project actually accepts.

## Evidence rules

- Minimum for a finding is the line making the external offer or instruction and the tracked line or inventory that shows where it fails. For a missing local file, cite the reference and record the searched path, package exclusions and any alternative route. Name the blocked user, the step and what they would need to proceed.
- Report concrete differences between the project's declared terms, scoped notices and shipped metadata. An unavailable text or conflicting identifier leaves the downstream permission unclear. Avoid legal conclusions. A URL in the tree proves a destination was advertised. Live availability, maintainer response times and actual registry contents need matching supplied evidence.
- Use `na` for an object recon shows is outside the offer, e.g. an explicitly internal project with no external distribution or contribution goal, or contribution intake for an archive that explicitly accepts neither changes nor reports. If audience, external policy or published contents cannot be established, use `unknown` for the affected judgment. A private workspace flag alone does not establish project intent. Give the sampled adopter and contributor paths in `checked` and the missing external evidence and its effect in `limits`.

## Severity anchors

- **critical** — reserve for a demonstrated failure across every supported external distribution that makes the project's primary deliverable unusable and leaves adopters no viable source route.
- **high** — the sole advertised install path omits its required entry point, or the primary redistribution offer refers to incompatible project terms with no stated scope, leaving adopters unable to identify the terms for that artifact.
- **medium** — the accepted contribution path requires an internal-only check or recipient with no documented substitute, or a supported secondary distribution omits a required file.
- **low** — a stale example or intake reference adds a detour where another explicit, usable route covers the same audience and task.

## Criteria

### `project-terms` — Project terms and notices follow the distribution
Compare the declaration a user sees with the applicable text and package inclusion rules. For a mixed-license tree trace one shipped file through any directory-specific exception.

### `distribution` — The advertised distribution contains its entry point
Trace the advertised package, source tag or archive recipe to the expected files, executable or import. Check that the consumer-facing example selects the same deliverable and version family.

### `external-first-use` — An outside user can complete the first documented task
Resolve the prerequisites for one representative use with publicly offered inputs and a concrete expected result. Identify any private-only dependency on the supported path and whether a substitute is supplied.

### `contribution-path` — An accepted contribution can reach review
Take one allowed contribution through preparation, validation and submission as applicable. Verify referenced paths and that a person outside the organization can supply the required inputs under the stated process.

### `maintainer-contact` — Outside users can identify the right maintainer channel
Match an ordinary support or change request to its documented destination and audience. Check any promised confidential reporting route for instructions that send the reporter back to a public channel.

## Optional tools

Read local tracked files and any already supplied package listings. Leave package builds, registry lookups, external links and issue forms untouched.

## Common false positives

- A private root manifest coordinates workspaces while a child package is expressly published under its own terms.
- A project accepts reports by email or patches on a mailing list. An issue tracker and pull-request template are unnecessary for that process.
- A source-only library documents building from a release tag. The absence of a binary release does not break the promised distribution.
