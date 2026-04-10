# Pi examples

Run `opentui-island` inside a Pi extension.

## Run

Build the package first so the extension can import `dist/`:

```bash
bun run build
pi -e ./examples/pi/index.ts
```

## Commands

- `/opentui-counter-demo` - counter island in a Pi overlay
- `/opentui-diff-demo [path]` - diff viewer from a file, editor text, or the built-in sample diff
- `/opentui-editor-demo` - hosted note editor island that returns `save` or `cancel` back to Pi
- `/opentui-mouse-demo` - clickable and scrollable mouse playground
- `/review-last-diff` - reopen the most recent edit diff in the full viewer

## Example

Inside Pi:

```text
/opentui-diff-demo ./examples/pi/sample.diff

/opentui-editor-demo
```

## Notes

- The example forwards Pi mouse input into OpenTUI islands.
- The editor demo shows a full host <-> island result flow via bridge events.
- It also replaces Pi's inline `edit` diff summary while keeping the built-in edit behavior.
- Use `Ctrl+O` to expand the inline edit block, or `/review-last-diff` to reopen it in the full viewer.
