# TypeScript Review Guide

## Type Safety
- Avoid `any` — use `unknown` + type guards instead.
- Use discriminated unions for state machines: `{ status: 'loading' } | { status: 'success', data: T }`.
- Prefer interfaces for object shapes, types for unions/intersections.
- Use `readonly` for immutable properties.
- Enable strict mode: `strict: true` in tsconfig.

## Async / Await
- Always handle promise rejections (try/catch or .catch).
- Avoid `await` in loops — use `Promise.all` for parallel work.
- Use `AbortController` for cancellable async operations.
- Prefer `async/await` over raw promises for readability.

## Immutability
- Use `as const` for literal types.
- Prefer `ReadArray<T>` / `readonly T[]` for arrays not meant to be mutated.
- Use spread / `Object.freeze` for defensive copies at boundaries.

## Common Pitfalls
- Optional chaining on functions: `fn?.()` — ensure fn is actually optional.
- `enum` vs union types — prefer string unions unless you need runtime values.
- Namespace imports vs named imports — be consistent with project convention.
- `export default` can make refactoring harder — prefer named exports.

## Error Handling
- Never catch and swallow — always log or rethrow.
- Use custom error classes with context.
- Chain errors: `throw new AppError('msg', { cause: originalError })`.
