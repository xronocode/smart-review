# Python Review Guide

## Common Pitfalls
- Mutable default arguments: `def foo(items=[])` → use `None` + `items = items or []`.
- Class attributes shared across instances — use instance attributes in `__init__`.
- Late binding closures in loops — capture with default arg: `lambda x=x: ...`.

## Type Hints
- Use type hints everywhere (params + returns).
- Prefer `from __future__ import annotations` for forward references.
- Use `Optional[T]` only for legitimate "no value", NOT for errors.
- Use `TypedDict` / `dataclass` / Pydantic for structured data, not raw dicts.

## Error Handling
- Never silently swallow exceptions.
- Never return `None`, `[]`, `{}`, or `-1` on error — raise with context.
- Use custom exceptions: `class AppError(Exception): ...` with actionable messages.
- Exception chaining: `raise AppError("context") from original_error`.

## Code Style
- Avoid magic numbers/strings — use constants or enums.
- Prefer `match` over long `if/elif` chains when it improves readability.
- Prefer dataclasses or structured models over dicts for return values.
- Use `pathlib.Path` instead of `os.path`.
- Use `|` union syntax (3.10+): `str | None` instead of `Optional[str]`.

## Async
- Use `asyncio` for I/O-bound, not CPU-bound work.
- Prefer `asyncio.TaskGroup` (3.11+) over `gather` for structured concurrency.
- Always handle `CancelledError` in long-running tasks.

## Testing
- Use `pytest` with fixtures. Avoid class-based tests unless sharing expensive setup.
- Parametrize tests for edge cases.
- Test error paths explicitly — verify the right exception is raised.
