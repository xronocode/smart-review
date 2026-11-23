# Source coverage in a full review

The inventory answers a question that a criterion score cannot answer. Which operations
did someone actually follow through the source at this commit?

## Map the operations

Use the internal choices and owners returned by `smart-review catalog --json`. A topic
can have several operations. Start from public commands, event registrations, workflows,
user actions and data owners. Group entry points when they call the same implementation
with the same contract. Split them when an adapter, platform, persistence mechanism or
state transition changes the outcome. For example, a search result opened by a click
and by a keyboard shortcut may use two different navigation handlers.

Record each unit in `recon.json` under `operationInventory` with a catalogue `topic`,
a stable `key` within that topic and a short `operation` describing observable behavior.
Use a lowercase slug for the key. A full run includes all 21 internal choices. For a topic
without an obvious implementation, record the specific surface whose applicability the
owner should check. The external assessment has its own separate provenance.

## Trace and account for each unit

The owner copies each identity and operation description into its `operationCoverage`.
Use the following dispositions.

| Status | What to record |
|---|---|
| `traced` | Follow the entry, contract and decisive effect. State the outcome in `note` and cite the supporting pinned file and line in `evidence`. Related lines can describe the caller and the effect. |
| `skipped` | State why the path could not be traced and what a reader therefore cannot conclude. Include evidence if available. |
| `inapplicable` | Describe the bounded search and why the operation does not apply. Cite a positive source anchor such as the command registry, manifest or dispatcher that establishes the boundary. |

For example, an inventory row and its corresponding findings row might be:

```json
{"topic":"frontend-components","key":"search-keyboard-open","operation":"Open a selected search result with the keyboard"}
```

```json
{"topic":"frontend-components","key":"search-keyboard-open","operation":"Open a selected search result with the keyboard","status":"traced","note":"The key handler passes the selected result ID to the same navigation callback as a click.","evidence":[{"path":"src/results.js","line":42}]}
```

Inspect the success path and the most consequential alternative supported by the code,
such as cancellation, partial completion, retry or another platform. Look across the
caller and callee when the consequence depends on a return value, state owner or data
shape. Where first-party behavior ends at an external service, record the last observable
effect and the remaining uncertainty. A finding requires a demonstrated consequence.
One verified root cause has one owner even if several operations expose it.

With a fresh verifier context, before opening the draft the verifier traces an operation selected from pinned source
and recon. Compare the independent trace with the draft, verify newly discovered roots
and send omitted operations back to recon. A solo reviewer reserves a separate trace at recon time and
records the use of a single reviewer in the section limits. Retain gaps if time or missing source limits
the investigation. Counts describe only the recorded inventory and do not estimate the
percentage of the repository examined.

## Later attempts

Bounded reviews may use this format for operations they actually inspect. Keep carried
documents with their original attempts. A historical section without rows provides no
operation counts. Compare findings across revisions by behavior, stable key and evidence.
A reversal in score alone cannot establish whether a fix worked.
