# Qt Review Guide

## Object Model
- QObject-derived classes: no copy constructor / copy assignment.
- Parent-child ownership: parent deletes children. Use consistently.
- Prefer stack allocation for QObjects with parent — avoid `new` when possible.
- Use `std::make_unique` / `std::unique_ptr` for heap QObjects without parent.

## Signals & Slots
- New syntax: `connect(sender, &Sender::signal, receiver, &Receiver::slot)`.
- Avoid `SIGNAL()` / `SLOT()` macros — no compile-time checking.
- Don't modify the sender object in a slot connected to its signal.
- Be careful with signal-slot connections across threads: `Qt::QueuedConnection`.

## Memory Management
- QObjects with parent: parent handles deletion.
- Widgets added to layout: layout handles deletion.
- `QScopedPointer` for RAII in non-QObject classes.
- `QSharedPointer` only when shared ownership is needed — prefer unique.

## Thread Safety
- GUI operations must run on the main thread.
- Use `QMetaObject::invokeMethod` with `Qt::QueuedConnection` for cross-thread calls.
- `QFuture` + `QtConcurrent` for CPU-bound parallel work.
- `QThread`: prefer worker object pattern over subclassing.

## Performance
- Use `QPixmap` for display, `QImage` for pixel manipulation.
- `QVector` / `QList` (Qt 6): contiguous memory, cache-friendly.
- Avoid frequent `QObject::property()` lookups — use direct accessors.
- `QElapsedTimer` for profiling, not `QTime::currentTime()`.

## Common Pitfalls
- Dangling pointers to deleted QObjects — use `QPointer<T>` for weak references.
- Signal recursion: signal A → slot B → emits signal A → infinite loop.
- Blocking the main thread: use `QCoreApplication::processEvents()` sparingly.
- `deleteLater()` vs `delete`: use `deleteLater()` in signal handlers.
