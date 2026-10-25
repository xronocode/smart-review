# Rust Review Guide

## Ownership & Borrowing
- Prefer borrowing (`&T`) over ownership transfer unless you need to consume.
- Use `Clone` explicitly — don't hide expensive clones.
- Lifetime annotations: elide when obvious, annotate when ambiguous.
- Avoid `&String` — use `&str`. Avoid `&Vec<T>` — use `&[T]`.

## Error Handling
- Use `Result<T, E>` everywhere — never panic in library code.
- Use `thiserror` for library error types, `anyhow` for applications.
- Chain errors with `source`: `Err(MyError::Network { source: io_err })`.
- Use `?` operator — avoid nested `match` on Results.

## Unsafe
- Minimize `unsafe` blocks. Document safety invariants in a `// SAFETY:` comment.
- Audit raw pointer dereferences, transmutes, and FFI boundaries.
- Prefer safe abstractions over raw unsafe.

## Async
- Prefer `tokio` runtime. Use `async fn` for I/O-bound work.
- Don't hold locks across `.await` points — use `tokio::sync::Mutex` for async.
- Use `spawn` for concurrent tasks, `join!` for concurrent futures.
- Be aware of `Send` bounds — `!Send` types can't cross `.await`.

## Performance
- Prefer iterators over manual loops (often auto-vectorizes).
- Use `Cow<str>` for functions that sometimes allocate.
- Check for unnecessary allocations in hot paths.
- Use `#[inline]` sparingly — let the compiler decide.

## Common Pitfalls
- Integer overflow: use `checked_add`, `saturating_add`, or `wrapping_add` explicitly.
- Deadlocks: avoid acquiring multiple locks. If needed, always in same order.
- `unwrap()` in production — use `expect("context")` at minimum, prefer proper error handling.
