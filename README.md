# opentui-host-core

Experimental host/runtime primitives for rendering OpenTUI component trees inside other terminal UI systems.

Runtime note: the current implementation is Bun-only because `@opentui/core` depends on `bun:ffi`.

## Goal

Treat an OpenTUI subtree as an embeddable terminal island:

- parent TUI owns the outer layout
- OpenTUI owns its internal rendering and interaction
- the host bridge exchanges rectangular frames, resize events, focus, keys, and mouse input

The first target host is `pi-tui`, but the core package should stay renderer-agnostic enough to support other terminal UI runtimes later.

## Initial shape

- `src/types.ts`: frame, cell, cursor, and input contracts
- `src/host.ts`: host interface and adapter contract
- `src/offscreen-host.ts`: first offscreen host backed by OpenTUI's test renderer
- `src/index.ts`: public exports

## Current implementation

The first concrete host uses OpenTUI's offscreen test renderer to mount a React tree, capture a styled frame, and accept forwarded key and mouse input.

This keeps the first milestone small:

- no custom buffer plumbing yet
- no deep interop with a foreign component tree
- just a rectangular OpenTUI island that another TUI can own and repaint

It also includes ANSI serialization helpers so host runtimes like `pi-tui` can paint captured rows directly:

- `hostSpanToAnsi(...)`
- `hostLineToAnsi(...)`
- `hostFrameToAnsiLines(...)`

## Planned follow-up

1. Add an offscreen OpenTUI renderer implementation that can mount a subtree and capture frames.
2. Add a frame diff layer so hosts can repaint only dirty rows.
3. Add a `pi-tui` adapter package that paints captured frames into a `Component`.

## Smoke test

```bash
bun run smoke
```
