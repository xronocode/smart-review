---
id: integrations
version: 1.1.0
---

# External integration reliability section

## Question

When an external service is slow, unavailable or only partly successful, what happens to the operation and how does it recover?

## Scope

Inspect first-party callers and consumers at an independently operated service boundary, including provider APIs, callbacks, remote queues and SDK adapters. Integrations owns the handling of provider outcomes. UI presentation belongs to frontend, access policy to security, application query cost to database and release failures to delivery.

## Method

For a locally hosted API that serves independently installed extensions, include an extension-initiated operation. Trace its success reply through any event or queue to the consumer that applies the operation. Check which target identity and completion signal the contract requires. A documented acceptance-only reply can legitimately precede completion. For a fallback, trace the primary and backup through to the resource they deliver and identify shared dependencies that survive the switch.

1. From recon's surfaces, entry points and manifests, identify reachable provider operations and their owners. Trace one important read and one state-changing operation where present. Include one asynchronous completion path if the caller delegates the result to a webhook or worker. Record the operation, provider and count sampled.
2. From the caller, follow the adapter into the configured client or worker. Read the effective deadline, cancellation handling and retry policy including outer job redelivery. Compare the combined wait and number of attempts with the caller's budget. If SDK defaults or platform settings are unavailable, identify the unresolved bound.
3. Walk three outcomes applicable to the operation on paper. For a rejected or throttled request follow classification and backoff. For a lost reply after acceptance follow the operation identity across retries. For a batch or callback with mixed outcomes follow each item's acknowledgement and persisted state. Check the actual success predicate, including an error signaled inside a successful transport response.
4. Pick one exhausted or indeterminate operation and follow it beyond the last catch. Who can find the affected item, tell whether the provider committed it, and resume or reconcile it? Read the durable record, correlation identifier, alert or work queue and the recovery consumer. If recovery undoes an earlier step, verify that it targets the completed effect and can itself be retried. Check when the consumer clears the record and what happens to later successful items.

## Evidence rules

- For each finding cite the reachable caller and the decisive handling lines. Name the provider outcome, the caller-visible result or durable state, the next attempt and its consequence. A recovery finding needs the last recorded state and the path that consumes, discards or strands it. Group shared adapter defects once.
- Separate the contract established by supplied code or documents from assumptions about provider behavior. Claim duplicate effects only with evidence for a repeatable send and the provider operation's semantics. Describe an unresolved completion as such. In `limits`, name missing provider contracts, settings or operational records and what they prevent you from determining.
- Mark a criterion `na` when recon and the reachable call graph rule out its object, e.g. only side-effect-free lookups for replay of writes. A mock, dependency or URL in a sample is insufficient to establish an integration. If a production provider is bound outside the tree and its handling cannot be established, use `unknown`. Record the paths that distinguish these cases in `checked`.

## Severity anchors

- **critical** — a primary flow demonstrably acknowledges permanent loss of consequential work or repeats an irreversible effect across a batch with no surviving way to identify affected items.
- **high** — a reachable lost reply can duplicate a consequential write, or the system marks unpaid, undelivered or otherwise unfinished work complete and discards its recovery record.
- **medium** — nested attempts can exceed a documented job budget, a transient failure permanently strands a recoverable item, or retrying the whole batch needlessly repeats expensive completed work.
- **low** — a recoverable failure lacks a useful status or correlation detail and requires an extra lookup to locate the item.

## Criteria

### `provider-outcomes` — Provider outcomes reach the correct caller state
Read the mapping for meaningful success, rejection, throttling and malformed or partial replies. Trace a degraded response to a caller that can distinguish it from an empty valid result.

### `attempt-budget` — Waiting and repeated attempts are bounded
Account for deadlines, cancellation and backoff across the client and worker together. Inspect whether a permanent error still consumes the transient retry budget.

### `replay-safety` — Repeated writes preserve the intended effect
Follow the operation key from creation to each send and through worker restart or redelivery. Check its scope and lifetime. A fresh key per attempt cannot identify a previously accepted write.

### `partial-completion` — Partial and out-of-order outcomes preserve progress
Compare when the consumer checkpoints or acknowledges with when it records the effect for each item. Follow a repeated callback or a late failure for an already completed item.

### `provider-recovery` — Unfinished work can be located and reconciled
Trace the last failed attempt to a durable retry, reconciliation, operator procedure or explicit user retry appropriate to the operation. Identify how recovery determines what remains to be done.

## Optional tools

Inspect local source, supplied contracts and already available diagnostic samples. Keep provider clients, fixtures, webhook senders and workers stopped. Make no outbound requests.

## Common false positives

- The transport has no retry loop because a durable queue retries the entire operation and the consumer uses the same provider key each time.
- A read returns cached data during an outage. The contract allows that age and the caller preserves the staleness indicator.
- An acknowledgement precedes provider completion because transfer to a durable queue has succeeded. The queue's consumer owns completion and recovery.
