# Vue 3 Review Guide

## Composition API
- Use `<script setup>` syntax — no need for `setup()` function.
- Keep `setup()` clean — extract composables for reusable logic.
- Use `ref` for primitives, `reactive` for objects.
- Destructuring `reactive` loses reactivity — use `toRefs`.

## Props & Emits
- Define with `defineProps<T>()` and `defineEmits<T>()`.
- Validate prop types at runtime for non-TS projects.
- Use `withDefaults` for optional props with defaults.

## Watchers
- `watch`: explicit source, avoid watching reactive objects directly (watch getter instead).
- `watchEffect`: auto-tracks dependencies, good for side effects.
- Use `{ flush: 'post' }` when watching DOM-dependent state.
- Clean up with `onCleanup` or return a stop function.

## Composables
- Prefix with `use` (e.g., `useAuth`, `useFetch`).
- Return reactive refs, not raw values.
- Handle cleanup in `onUnmounted` if needed.

## State Management (Pinia)
- One store per domain. Keep stores modular.
- Prefer `defineStore` with setup syntax.
- Use `$reset` for resetting state to initial values.
- Actions are async by default — no need for separate async wrappers.

## Reactivity Gotchas
- Reassigning a `ref` inside `reactive` works; reassigning a `reactive` property to a new object loses tracking.
- `shallowRef` / `shallowReactive` for performance on large structures.
- `markRaw` for objects that should never be reactive (e.g., third-party class instances).
