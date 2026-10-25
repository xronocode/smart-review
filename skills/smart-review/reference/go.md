# Go Review Guide

## Error Handling
- Always check errors. Never discard `_ = riskyCall()`.
- Wrap errors with context: `fmt.Errorf("reading config: %w", err)`.
- Use `errors.Is()` and `errors.As()` for error inspection.
- Custom error types for domain-specific errors.
- Don't use `panic` for recoverable errors — return `error`.

## Goroutines & Channels
- Launch goroutines only when you have a clear lifecycle plan.
- Always use `context.Context` for cancellation and timeouts.
- Close channels from the sender side, never the receiver.
- Prefer `sync.WaitGroup` over channel-based synchronization for simple fan-out.
- Buffered channels: size should be intentional, not arbitrary.

## Interfaces
- Keep interfaces small — single-method interfaces are idiomatic.
- Define interfaces where they're consumed, not where they're implemented.
- Accept interfaces, return structs.
- Use type assertion carefully — check with `ok` pattern: `v, ok := x.(T)`.

## Concurrency Patterns
- Use `sync.Mutex` for shared state, not channels.
- Avoid `sync.Map` unless high-contention, mostly-read scenario.
- Use `errgroup.Group` for concurrent tasks that can fail.
- Race detector: run tests with `-race` always.

## Common Pitfalls
- Loop variable capture: `for _, v := range slice` — v is reused.
- Slice append can modify underlying array — be careful with subslices.
- `defer` in loops: each iteration adds a deferred call.
- Naked goroutines without recovery: a panic kills the whole process.
- Map concurrent access: Go maps are not thread-safe.

## Testing
- Table-driven tests: `[]struct{ name string; input; expected }`.
- Use `t.Parallel()` for independent test cases.
- Test helpers: `t.Helper()` for better error reporting.
- Golden file testing for complex outputs.

## Code Style
- Don't over-abstract — Go favors simplicity.
- Avoid unnecessary packages — flat structure is fine for small projects.
- Prefer composition over inheritance (embedding).
- Keep the happy path left-aligned, error handling indented.
