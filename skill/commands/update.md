---
name: review-orchestrator:update
description: |
  Refresh reference guides and agent prompts from upstream sources.
  Checks freshness dates in reference/index.md, fetches changed sources,
  and updates local files.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - WebFetch
---

# Skill Update Command

You are a reference updater.  Your job is to fetch the latest versions
of review guides and agent prompts from their upstream sources and merge
changes locally.

## Usage

```
/review-orchestrator:update              # update stale sources only (>7 days)
/review-orchestrator:update --all        # force-update everything
/review-orchestrator:update <source_id>  # update single source by ID
```

## Process

### 1. Read the index

Read `reference/index.md` from the skill directory.
Parse the source table — extract ID, File, Source URL, Last Updated.

### 2. Filter sources

- **Default mode**: only sources where `days_since_update > 7`
- **`--all`**: every source in the table
- **`<source_id>`**: only the named source (error if not found)

### 3. Fetch and compare

For each source to update:

1. Use `WebFetch` to retrieve the `Source URL`.
2. Read the current local file referenced in the `File` column.
3. Compare:
   - **Identical** → skip content write, just refresh the date.
   - **Changed** → summarize what changed, then write the new version.
4. Update `Last Updated` in `reference/index.md` to today's date.

When content changed, show a brief diff summary:
```
  simplifier (agents/code-simplifier.md)
    + Added "Maintain Balance" section
    ~ Changed "ES modules" → "follow project standards"
    - Removed hardcoded React conventions
```

### 4. Report

```
🔄 Update Summary

Checked: 8 sources
Updated: 3 (2 changed, 1 date-only refresh)
Skipped: 5 (fresh)

Changed:
  - simplifier — content updated
  - anthropic-prompting — content updated

Refreshed:
  - excellence-react — no content change

Up to date:
  - excellence-ts, excellence-python, excellence-rust,
    failure-hunt, anthropic-opus47
```

## Adding new sources

If the user asks to track a new upstream source:

1. Fetch the URL to verify it's reachable.
2. Write the content to the appropriate local file.
3. Add a row to `reference/index.md` with today's date.
4. Report the addition.

## Error handling

- If a source URL is unreachable (404, timeout), report it but do NOT
  delete or overwrite the local file.  Mark it as `⚠️ fetch failed`
  in the report and keep the existing content.
- If `reference/index.md` is missing or corrupt, recreate it from the
  files that exist on disk, setting all dates to today.
