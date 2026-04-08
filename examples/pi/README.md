# Pi examples

These examples show how to use `opentui-island` from a Pi extension.

## What this demonstrates

- mount an OpenTUI island inside a Pi overlay
- render a generic diff viewer inside Pi
- translate Pi mouse input into OpenTUI mouse handlers
- replace Pi's inline `edit` result with a custom diff renderer while keeping the built-in edit behavior

## Prerequisites

- Bun 1.3+
- Pi installed locally

Build the library first so the Pi example can import `dist/`:

```bash
bun run build
```

## Run

From the repo root:

```bash
pi -e ./examples/pi/index.ts
```

## Commands

- `/opentui-counter-demo` - simple counter island in a Pi overlay
- `/opentui-diff-demo [path]` - diff viewer from a file path, editor content, or built-in sample
- `/opentui-mouse-demo` - clickable and scrollable mouse playground island
- `/review-last-diff` - reopen the most recent edit diff in the full viewer

## Example diff input

```bash
pi -e ./examples/pi/index.ts
```

Then in Pi:

```text
/opentui-diff-demo ./examples/pi/sample.diff
```

## Inline edit experiment

This example also overrides Pi's built-in `edit` tool rendering.

When Pi performs an edit, the tool result renders an inline diff summary in the transcript. Use `Ctrl+O` to expand the block, or `/review-last-diff` to reopen the same diff in the full OpenTUI viewer.
