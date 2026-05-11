# C Review Guide

## Pointer & Buffer Safety
- Always check buffer bounds before `memcpy`, `strcpy`, `strcat`.
- Use `strncpy` / `snprintf` instead of `strcpy` / `sprintf`.
- Validate `malloc` return — don't assume allocation succeeds.
- Free allocated memory in the same scope that allocates it when possible.
- Use `sizeof(variable)` not `sizeof(type)` to avoid type/variable mismatch.

## Undefined Behavior
- Signed integer overflow is UB — use unsigned types for wraparound arithmetic.
- Null pointer dereference: always check pointers from external sources.
- Use-after-free: set pointers to NULL after `free`.
- Double-free: use a clear ownership model.
- Stack buffer overflow: prefer heap allocation for large/bounded-unknown sizes.

## Memory Management
- Consistent allocation/deallocation strategy (who allocates, who frees).
- Use `calloc` instead of `malloc + memset` for zeroed memory.
- Consider arena/region allocators for frequent same-lifetime allocations.
- Check for memory leaks in error paths (early returns before `free`).

## Error Handling
- Check return values of every system call and library function.
- Use `errno` immediately after the failing call — it can be overwritten.
- Prefer returning error codes over modifying output parameters on error.
- Document preconditions and postconditions in header comments.

## Common Pitfalls
- Off-by-one in loops: `<=` vs `<` on array bounds.
- Missing `break` in `switch` — use fallthrough comments intentionally.
- Comparing floats with `==` — use epsilon comparison.
- Macro side effects: `MAX(x++, y++)` increments twice.
- Token pasting and stringification in macros — prefer inline functions.

## Threading
- POSIX threads: always check `pthread_create` return value.
- Use `pthread_mutex_destroy` for every `pthread_mutex_init`.
- Deadlock prevention: always acquire locks in same order.
- Use `volatile` for variables shared with signal handlers, not for threading (use atomics).

## Code Style
- Avoid magic numbers — use `#define` or `enum`.
- Prefer `static` functions for file-scoped visibility.
- Use `const` for read-only parameters and variables.
- Keep functions < 50 LOC, files < 500 LOC as guidelines.
