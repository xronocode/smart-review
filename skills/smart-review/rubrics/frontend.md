---
id: frontend
version: 1.0.0
---

# Frontend section

## Question

Does the interface show what the service actually did, and do its components preserve the shared interaction contract?

## Scope

Inspect shipped UI routes, their service adapters, state updates, reusable controls and design-system definitions. Include server-rendered forms, client applications and shipped component libraries. Frontend owns the user's view of a request and the behavior of the controls used to act on it. Provider retries belong to integrations, server access decisions to security, and general code duplication to hygiene.

## Method

1. From recon's entry points and surfaces identify the UI that users receive. Choose one primary user action that changes state and one list, search or navigation that can receive a late result, where present. Name the route and state owner. For a library with no screen, start from a documented exported control and an actual use or supplied example.
2. Walk the action from event or form submission to request construction, service contract, response decoding and the branch that commits UI state. Match field names, optional values, pagination and error semantics. Trace what the user sees during pending, empty, success and failure states. If an optimistic change is rejected, follow the displayed data and any unsaved input through recovery.
3. Consider two actions in sequence, such as switching records while a request is pending or submitting twice. Track the request identity, cache key, cancellation or disabled state. Identify which response may commit to which view and whether the user can retry without losing their input. Ground any ordering claim in reachable handlers.
4. Pick a repeated interaction such as a dialog, form field or menu. Compare up to two shipped consumers with the shared component, variant or token contract. Trace keyboard activation, label and error association, focus return, and disabled or busy behavior where relevant. Check theme and size overrides against the actual token resolution. State which user action or supported mode diverges and where one change would fix it.

## Evidence rules

- For a service finding, cite the UI event, the relevant service or client contract where available, and the state assignment or render branch. Give the input or event order and what the user would see. A contract outside the tree limits what can be concluded about the server. A client that commits an older response to a newer view can still be assessed from its own code.
- For a component finding, cite a shipped use and the definition, sibling use or explicit design rule it violates. Identify the affected behavior, state or supported theme. Assign the matching `frontend-server` or `frontend-components` topic. When one fix covers both, use one finding and both relevant topics.
- Use recon paths to explain `na`, e.g. a headless service with no UI, or a local-only component library with no service interaction. Missing server source, generated controls with unavailable definitions, or an unverified visual effect belong in `unknown` or `limits` as applicable. In `checked` name the sampled routes, states and control uses. In `limits` distinguish source-supported behavior from layout, contrast or assistive-technology outcomes that would require observation.

## Severity anchors

- **critical** — a primary destructive action can apply to a different record than the one the UI identifies, with the target mapping and irreversible effect established at both ends.
- **high** — a primary save displays success after rejection and discards the user's only copy, or a shared control makes a primary task unreachable for a supported input method.
- **medium** — a late response replaces the newly selected record, a failed submission leaves a view permanently busy, or a shared control loses keyboard focus on a commonly used route.
- **low** — a local override obscures a secondary state in a supported theme while the action and its result remain accessible.

## Criteria

### `frontend-server` — UI state follows the service contract
Check the request and response shape, ownership of pending data and the transition on rejection, cancellation or a late result. Credit a plain form submission when the rendered response handles the same contract. A client-only status label is insufficient evidence of a completed mutation.

### `frontend-components` — Components preserve shared behavior and design-system rules
Trace a control's public inputs, semantics, focus and supported variants into actual uses. Determine whether a shared primitive or token change reaches those uses. When no formal design system is claimed, judge the documented or observable interaction contract of comparable controls.

## Optional tools

Read source, markup, styles and any supplied screenshots for the identified states. Leave the application, browser automation, component playground and service endpoints idle.

## Common false positives

- A generated client translates between wire names and component property names before the view reads them.
- An earlier response populates a cache entry keyed by its own record. The currently selected view subscribes to a different key.
- A dialog uses a native control that supplies the keyboard behavior in question, or a one-off variant uses a documented token for a different surface. Verify the rendered element and the active variant before reporting drift.
