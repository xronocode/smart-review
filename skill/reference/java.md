# Java Review Guide

## Java 17/21 Features
- Pattern matching for `instanceof`: `if (obj instanceof String s) { ... }`.
- Sealed classes for controlled hierarchies: `sealed interface Result permits Success, Failure {}`.
- Records for immutable data: `record Point(int x, int y) {}`.
- Text blocks for multi-line strings: `"""..."""`.
- Switch expressions: `return switch (x) { case A -> 1; case B -> 2; };`.
- Virtual threads (21): `Thread.ofVirtual().start(runnable)` for I/O-bound concurrency.

## Spring Boot 3
- Constructor injection over field injection.
- Use `@Transactional(readOnly = true)` for read operations.
- Prefer `ResponseEntity` for explicit HTTP responses.
- Use `@Validated` with DTOs for input validation.

## Error Handling
- Use specific exception types — avoid throwing generic `Exception`.
- Custom exceptions with error codes and actionable messages.
- `Optional<T>` instead of returning null — never return null for "not found" without Optional.
- Try-with-resources for `AutoCloseable` — never leave streams/connections open.

## Concurrency
- Prefer `CompletableFuture` / virtual threads over raw `Thread`.
- Use `ConcurrentHashMap` over synchronized `HashMap`.
- Immutable objects for shared state.
- Avoid `synchronized` on String constants (interned).

## Stream API
- Prefer streams for transformations, loops for side effects.
- Avoid stateful lambda predicates.
- Use `Optional` terminal operations: `findFirst()`, `findAny()`.
- Don't over-negotiate streams — sometimes a for-loop is clearer.

## Testing
- JUnit 5 + Mockito for unit tests.
- `@SpringBootTest` for integration — minimize usage (slow).
- Test exception paths: `assertThrows(ExpectedException.class, ...)`.

## Code Style
- Avoid magic numbers/strings — extract to constants or enums.
- Use `final` for immutable references.
- Prefer composition over inheritance.
- Keep methods < 30 LOC, classes < 300 LOC as guidelines.
