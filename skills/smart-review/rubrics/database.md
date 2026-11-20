---
id: database
version: 1.0.0
---

# Database query efficiency section

## Question

How does database work grow on the application's own data paths, and which costs can the available evidence establish?

## Scope

Review queries this project issues or defines for a reachable application, worker or library operation. Include ORM-generated queries when their shape is supported by the mapping, and stored queries invoked on that path. Database owns query shape, repeated access and result volume. Access control and injection belong to security. A remote API call with no project-owned query belongs to integrations.

## Method

1. Use recon's entry points, storage surfaces and exclusions to find the code that chooses the query. Select up to three distinct operations, favoring a list or search, a relationship traversal, and a batch job or bulk update where present. Record the caller, query builder or SQL, relevant schema revision and the reason for the sample. Trace views, scopes and eager-loading helpers called from those operations.
2. For each operation name the unit of input and the unit returned. Follow filters, projections, ordering, limits and cursor or offset from the caller to the database. Determine whether a page bounds database work, network transfer or only the final response. Count separately any total-count query. Check whether a join multiplies rows before pagination or hydration.
3. For a loop, take two possible input sizes and derive the number of trips in terms of distinct keys or batches. Locate the database call inside the loop or the lazy relationship access that triggers it. Account for preloading, request caches, parameter limits and chunk size. A loop over already loaded objects costs no extra trip.
4. Compare the predicate and ordering actually issued with supplied schema, indexes and uniqueness constraints. Check composite key order, casts or expressions, and whether a bound is backed by a constraint. State what work an index could support. If supplied, match a saved plan or trace to the query shape, parameters, engine, schema and data scale before attributing an observed scan, sort, row count or timing.

## Evidence rules

- Minimum for a structural finding is a reachable caller, the owned query or mapping, and a concrete growth mechanism, all cited at commit lines. Give a count, bound or formula with its assumptions, e.g. one parent lookup plus one per distinct unloaded parent. For excess transfer name the columns or rows fetched and the subset used.
- A performance observation needs a matching supplied measurement. A missing index declaration, a scan on a small table, or a query with several joins does not establish latency. Report demonstrable repeated work independently of measured speed. Leave production latency, index choice or prevalence `unknown` where plans, statistics or workload evidence are missing. In `limits` state the inference those missing data prevent.
- Mark `na` when recon and inspection of the production entry points establish no application-owned query, e.g. SQL examples for a query parser or a client that only forwards opaque requests. If a runtime mapping or external schema hides the query, record `unknown` for the affected criterion. Identify the mapped and excluded paths and sampled operations in `checked`.

## Severity anchors

- **critical** — matching supplied evidence ties the owned query to exhaustion of a shared resource and loss of the primary service under its supported workload.
- **high** — a routine operation provably reads or rewrites the full growing collection for a small result and supplied scale or a hard resource bound establishes a material impact on the primary path.
- **medium** — a reachable request adds one avoidable database trip per input row, or the database returns an unbounded set that the caller discards down to a fixed page. The extra work can be demonstrated statically.
- **low** — a bounded operation loads a redundant field or issues one avoidable additional lookup, with a localized cost.

## Criteria

### `result-bounds` — Selection and pagination bound the work requested
Compare the rows and fields needed with those selected, transferred and materialized. For pagination inspect filter placement, stable ordering and what the next page must skip or reread.

### `round-trips` — Database trips scale with the intended batch
Count list lookups, lazy loads and per-item mutations on one invocation. Trace batching to the database call and check the largest allowed input against the actual chunking rule.

### `access-path` — Predicates and ordering fit the declared access paths
Pair the real filter, join and sort keys with schema evidence. Identify what can be pruned or fetched by key and which step still needs work proportional to the candidate set.

### `observed-cost` — Query cost is established for a stated workload
Compare one matching saved plan, timing or statement-count trace to the intended operation and its workload. Explain its measured scope. Use `unknown` when no suitable observations are supplied.

## Optional tools

Use local text inspection of mappings, schema and supplied plans. Keep the application and database stopped. Do not connect, run a query or generate a plan.

## Common false positives

- A full scan over a fixed enumeration fits the product's enforced data bound.
- A migration creates the index under a different name, or a unique constraint already supplies the access path in the declared engine.
- A streaming export intentionally reads every matching row. Bounded buffers and resumable chunks can satisfy its contract even though a paginated screen would need a smaller result.
