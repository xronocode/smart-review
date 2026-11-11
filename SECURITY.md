# Security policy

## Supported versions

Security fixes go into the latest release only.

| Version | Supported |
|:---|:---:|
| Latest release | Yes |
| Older releases | No |

## Reporting a vulnerability

Please report security problems privately, not in a public issue:

1. Open [a private security advisory](https://github.com/xronocode/smart-review/security/advisories/new) for this repository.
2. Describe the issue and, if possible, a minimal document or sequence that triggers it.

You will get a reply in the advisory thread. Once a fix is released, the advisory is published with credit unless you prefer otherwise.

## What counts as a security issue here

This repository ships **instructions that run inside coding agents**
(`skills/*/SKILL.md`, `skills/*/agents/*.md`) and one small CLI
(`skills/smart-audit/cli/`). Relevant threat classes:

- **Prompt injection via the update path.** `/smart-review:update` fetches
  documents from an allowlist of two domains and writes them into skill
  files. Report anything that lets fetched content execute as instructions,
  bypass the allowlist, or be written into `agents/` without confirmation
  (see `skill/commands/update.md`, "Security rules").
- **Malicious skill content.** Anything in this repo that makes a loaded
  agent exfiltrate data, fetch unexpected URLs, or run commands beyond
  `git diff` / file reads without user approval.
- **Audit result manipulation.** `smart-audit` reads a repository it does not
  trust. Report anything that lets content of the audited repository
  (source, comments, `SMART_AUDIT.md`, `.smart-audit/accepted.json`) change a
  score other than through confirmed findings, suppress a `high` or
  `critical` finding, widen the audited scope, or make the agent run a
  command, install something, or write outside the run directory.
- **Secret disclosure by the audit.** Findings, recon, reports, and chat
  output must not contain secret values. Report any path where a credential
  from the audited repository reaches an output file and `smart-audit lint`
  accepts it.
- **CLI input handling.** `smart-audit` parses findings documents and reads
  git objects by path. Report path traversal out of the audited repository,
  command injection through file names or arguments, or HTML injection into
  `report.html` from finding text.
- **CI compromise.** The workflow pins its actions by commit SHA and runs
  with `permissions: contents: read`; report any step that widens that.

## Out of scope

- Findings produced *by* the skills when reviewing or auditing your code
  (that is their job, not a vulnerability).
- An audit that misses a real problem or reports a false one. That is a
  quality issue: open a regular issue with the finding and the code.
- Secret formats that `smart-audit lint` does not recognize. The pattern list
  is a safety net, not a scanner; open a regular issue to add a format.
- Issues in the upstream sources under `raw.githubusercontent.com/anthropics/*`
  — report those to the upstream repository.
