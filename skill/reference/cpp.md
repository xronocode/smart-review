# C++ Review Guide

## RAII & Resource Management
- Every resource (memory, file, lock, socket) should be wrapped in a RAII class.
- Use `std::unique_ptr` for exclusive ownership, `std::shared_ptr` for shared.
- Never call `delete` directly — use smart pointers or containers.
- Use `std::lock_guard` / `std::unique_lock` for mutexes, never manual lock/unlock.

## Rule of 0/3/5
- **Rule of 0**: If no custom destructor/copy/move needed, don't declare any.
- **Rule of 3**: If you declare destructor, copy constructor, or copy assignment — declare all 3.
- **Rule of 5**: Also include move constructor and move assignment.

## Lifetime & References
- Never return references to local variables or temporaries.
- Dangling references from iterators after container modification.
- Use `std::string_view` for non-owning string references (C++17).
- Use `std::span` for non-owning contiguous sequences (C++20).

## Move Semantics
- Use `std::move` to transfer ownership, not to "make things faster."
- After `std::move(x)`, x is in valid-but-unspecified state — don't read from it.
- Enable move semantics with noexcept move constructor/assignment.
- Return by value — RVO/NRVO handles the optimization.

## Exception Safety
- Prefer RAII for exception-safe cleanup.
- Use `noexcept` for move constructors and destructors.
- Exception-safe swap: implement `swap` as non-throwing.
- Avoid throwing in destructors.

## Modern C++ (17/20/23)
- `std::optional<T>` for values that may be absent.
- `std::variant<T...>` for type-safe unions.
- Structured bindings: `auto [key, value] = *it;`.
- `[[nodiscard]]` for functions where return value must be used.
- `constexpr` for compile-time evaluation.
- Ranges (C++20): composable, lazy evaluation.

## Common Pitfalls
- Slicing: passing derived by value to base — use references/pointers.
- Iterator invalidation after insert/erase.
- Static initialization order fiasco — use function-local statics.
- `auto` with proxy types (`vector<bool>`) — use `auto&&` or explicit type.
- Undefined behavior: signed overflow, null dereference, out-of-bounds access.

## Testing
- Use Catch2 or GoogleTest.
- Test move semantics, copy semantics, and RAII cleanup explicitly.
- Use AddressSanitizer and UndefinedBehaviorSanitizer in CI.
