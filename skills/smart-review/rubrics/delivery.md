---
id: delivery
version: 1.2.0
---

# Delivery section

## Question

What must pass before a change reaches users, which artifact reaches them, and how can a bad release be contained?

## Scope

Review the route from a proposed change to a merge, package publication or deployment owned by the project. Delivery owns the gate, the identity of the promoted build and the release recovery procedure. Test effectiveness belongs to tests. Trust in downloaded actions, packages and build tools belongs to dependencies.

## Method

1. Start with recon's CI files, entry points and release instructions. List the distinct routes to users, including manual publication if documented. Trace a normal change to the main branch and a release of the primary deliverable. Include one alternate route if it can publish the same deliverable, such as a tag or manual job. Record which routes you sampled out of the inventory.
2. For each route, start at the merge or publish decision and work backwards. Identify the event, ref, path filters, job conditions, upstream jobs and exact revision checked. Follow local reusable workflows and wrappers to the invoked check and its exit status. Can a changed package miss the check? Can a skipped or allowed-to-fail step still satisfy the next job?
3. Write down separately what the maintainer promises, what the workflow schedules, and what actually blocks that transition according to the supplied evidence. For a merge requirement, match the required status name, target branch and applicable exceptions in a supplied effective rules export or equivalent record of enforcement. For publication, trace the dependency on a successful job or approval for that exact route. A successful run establishes one outcome. An approval named in a document establishes a claim.
4. Follow the candidate forward. Match the tested revision and artifact identifier to the inputs of the publishing job. If a job rebuilds, check what ties the rebuilt output to the checked inputs or verifies it before publication. For concurrent releases check whether a slower, older job can overwrite the selected version.
5. Read the failure branch and the release instructions together. Identify who can halt rollout, which known-good artifact or fixed version they can select, and how consumers learn which version to use. For a partially completed release, find the point from which the operator can safely resume.
6. Where signing or promotion moves files between jobs, trace each distinct producer/consumer implementation (for example, shell on macOS and PowerShell on Windows). Work through one successful build's actual directory contents, optional outputs, receipt names, and already occupied destinations. Compare that set with the consumer's glob, checks and output paths. Record which platform branches the cited tests exercise or inspect. A passing source-pattern test establishes only the branch and condition it checks.
7. Admission controls are negative-space evidence. Enumerate the artifact types the route ships and, for each, the admission control that runs on that exact build before it can ship. An absent control is found by comparing the shipped artifact inventory with the controls each artifact runs, then citing the pipeline steps that build and ship an artifact whose admission is missing. A control of a different artifact type does not close the gap. The same comparison covers version parity between the artifact and the ref it was built from, per lane.


## Evidence rules

- Include the route and revision or artifact in `checked`. A gate finding needs lines for the promised or configured check, its controlling condition or dependency, and the affected transition. For a promotion or rollback finding cite the producer and consumer or the failing recovery step. Describe the change that would close the evidenced gap.
- Use commit-relative paths and lines for findings. Identify any supplied host evidence and its scope in the note. If merge is the only applicable gate and host policy is unavailable, mark `gate-enforcement` as `unknown`. If a publish gate can be assessed independently, score the evidenced gate and record merge enforcement as unknown in its note and in `limits`. A demonstrated scheduling defect belongs under `check-coverage`.
- For an absent-control finding, cite the inventory of shipped artifact types, the control each one runs, and the build and publish steps that ship the artifact without the control. Anchor the finding on those steps; the absence itself has no line to cite.
- Use `na` when recon and the tracked release model establish that a transition does not exist, e.g. deployment rollback for a source-only reference distributed as immutable revisions. An undocumented process for a shipped product is a limit or a gap in a specific promise. A missing workflow filename alone settles neither. Give the uninspected routes and the effect on the verdict in `limits`.

## Severity anchors

- **critical** — the production route demonstrably selects an unchecked or known-failed build for broad automatic rollout and the traced recovery path cannot contain the resulting release.
- **high** — the primary publisher can ship after a required check fails, or promotes an artifact from a different revision than the one approved.
- **medium** — a meaningful subset of changes misses a promised check, or an interrupted release leaves the operator without a usable resumption step and requires manual reconstruction.
- **low** — a stale status or recovery label costs an extra lookup while a working gate or recovery route remains identifiable.

## Criteria

### `check-coverage` — Checks run for the changes they cover
Compare a concrete changed path and ref with the workflow filters, matrix and invoked command. A job named for the whole project may check just one package.

### `gate-enforcement` — Required results and approvals control promotion
For each sampled transition name the blocking result, the revision it covers and the decision that consumes it. Rate the controls supported by evidence and identify any transition whose enforcement remains unknown.

### `artifact-admission-coverage` — Every shipped artifact type passes a functional admission check of that exact build
Enumerate the artifact types the pipeline ships and the admission control each one runs on its own build: functional launch or package verification, not only static checks. When an artifact type ships without an admission control of its own build, cite the build and publish steps that move it to users. A smoke check of a different artifact does not close the gap.

### `release-channel-integrity` — Release channel state stays consistent with the published artifact across lanes and re-runs
Compare the version inside each installer with the tag or ref it was built from, per lane, including prerelease lanes. Check that a re-publish of an already released artifact reasserts the update-channel state instead of skipping it, and that no two admission checks report under one required-context name, so consumers can always resolve which run satisfied the gate.

### `artifact-promotion` — The published artifact matches the checked candidate
Trace the build ID, digest, version or equivalent through transfer and selection. Inspect mutable references, reruns and concurrent jobs when they can change which candidate is published.

### `release-recovery` — A failed release can be contained and recovered
Follow one failed or partial rollout to a stop, rollback or forward fix. Check that the referenced artifact exists in the described retention scheme and the procedure fits the distribution channel.

## Optional tools

Read tracked files and supplied exports locally. Leave workflows, release scripts and hosting APIs idle during the review.

## Common false positives

- A path-filtered job omits prose-only changes while a required aggregate check correctly handles the skip.
- A job accepts failure on one experimental matrix entry. The supported entries still block the publisher.
- A registry keeps package versions immutable. Publishing a corrective version and moving the installation tag can be the project's supported recovery path.
