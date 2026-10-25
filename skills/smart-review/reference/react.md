# React Review Guide

## Hooks
- `useEffect`: declare dependencies honestly. If you need prev value, use `useRef`.
- `useMemo` / `useCallback`: only when profiling shows benefit, not preemptively.
- Custom hooks: prefix with `use`, return tuple or object consistently.
- Don't call hooks conditionally or in loops.

## React 19
- Actions: `useActionState`, `useOptimistic` for form-like async mutations.
- Server Components (RSC): no `useState`, `useEffect`, or event handlers.
- `Suspense` boundaries: place at route-level or section-level, not per-component.
- `use()` hook for reading promises and context in render.

## Component Patterns
- Explicit `Props` type: `interface Props { ... }` above the component.
- Destructure props in function signature.
- Colocate related logic — hook + component in same file if small.
- Extract when > 100 LOC or when reused.

## State Management
- Local state first. Lift only when needed.
- Context for theme/auth. Zustand/Jotai for complex shared state.
- TanStack Query v5 for server state: `useQuery`, `useMutation`, `useSuspenseQuery`.

## Performance
- Avoid unnecessary re-renders: React.memo only when profiling shows need.
- Lazy-load routes: `React.lazy(() => import('./Page'))`.
- Key lists with stable IDs, not array indices.
- Virtualize long lists (react-window / virtuoso).

## Testing
- Prefer testing-library over enzyme.
- Test behavior, not implementation.
- Use `screen.getByRole` over `getByTestId` when possible.
