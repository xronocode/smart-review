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
(`skill/SKILL.md`, `skill/agents/*.md`). Relevant threat classes:

- **Prompt injection via the update path.** `/smart-review:update` fetches
  documents from an allowlist of two domains and writes them into skill
  files. Report anything that lets fetched content execute as instructions,
  bypass the allowlist, or be written into `agents/` without confirmation
  (see `skill/commands/update.md`, "Security rules").
- **Malicious skill content.** Anything in this repo that makes a loaded
  agent exfiltrate data, fetch unexpected URLs, or run commands beyond
  `git diff` / file reads without user approval.
- **CI compromise.** The workflow pins its actions by commit SHA and runs
  with `permissions: contents: read`; report any step that widens that.

## Out of scope

- Findings produced *by* the skill when reviewing your code (that is its
  job, not a vulnerability).
- Issues in the upstream sources under `raw.githubusercontent.com/anthropics/*`
  — report those to the upstream repository.
