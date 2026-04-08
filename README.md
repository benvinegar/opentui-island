# opentui-island

Embed OpenTUI component trees inside other terminal UI runtimes such as `pi-tui` and Ink.

[![GitHub stars](https://img.shields.io/github/stars/benvinegar/opentui-island?style=for-the-badge)](https://github.com/benvinegar/opentui-island/stargazers)
[![Runtime Bun](https://img.shields.io/badge/runtime-bun-black?style=for-the-badge&logo=bun)](https://bun.sh)
[![Adapters pi-tui + ink](https://img.shields.io/badge/adapters-pi--tui%20%2B%20ink-0ea5e9?style=for-the-badge)](https://github.com/benvinegar/opentui-island/tree/main/src/adapters)
[![Status experimental](https://img.shields.io/badge/status-experimental-f59e0b?style=for-the-badge)](https://github.com/benvinegar/opentui-island)

Runtime note: the current implementation is Bun-only because `@opentui/core` depends on `bun:ffi`.

## Why opentui-island

- Let the parent TUI own outer layout while OpenTUI owns the embedded widget.
- Forward resize, focus, keyboard, and mouse input into an offscreen OpenTUI subtree.
- Capture the subtree as styled terminal rows that another runtime can repaint.
- Reuse the same OpenTUI tree across multiple host runtimes.

## Quick start

Clone the repo and run the examples:

```bash
git clone https://github.com/benvinegar/opentui-island.git
cd opentui-island
bun install

bun run smoke:pi-tui
bun run smoke:ink

bun run demo:pi-tui
bun run demo:ink
```

- `smoke:pi-tui` and `smoke:ink` verify the adapter bridge offscreen.
- `demo:pi-tui` launches a live `ProcessTerminal` app with keyboard, click, and wheel input inside the embedded island.
- `demo:ink` launches a live Ink app with keyboard input forwarded into the embedded island.

## Use in pi-tui

This is the minimal shape of a `pi-tui` host app:

```tsx
import { matchesKey, ProcessTerminal, TUI } from "@mariozechner/pi-tui";
import { useKeyboard } from "@opentui/react";
import { useState } from "react";
import { createPiTuiOpenTuiSurface } from "opentui-island/pi-tui";

function Counter() {
  const [count, setCount] = useState(0);

  useKeyboard(
    (event) => {
      if (event.eventType !== "release" && event.name === "a") {
        setCount((value) => value + 1);
      }
    },
    { release: true },
  );

  return (
    <box style={{ width: "100%", height: "100%", paddingLeft: 1 }}>
      <text fg="#00ff88">{`count: ${count}`}</text>
    </box>
  );
}

const terminal = new ProcessTerminal();
const tui = new TUI(terminal);

const surface = await createPiTuiOpenTuiSurface({
  height: 4,
  initialWidth: terminal.columns,
  requestRender: () => tui.requestRender(),
  tree: <Counter />,
});

tui.addChild(surface);
tui.setFocus(surface);

tui.addInputListener((data) => {
  if (matchesKey(data, "q") || matchesKey(data, "ctrl+c")) {
    void surface.destroy();
    tui.stop();
    return { consume: true };
  }

  return undefined;
});

tui.start();
await surface.sync(terminal.columns);
```

For mouse input in `pi-tui`, also call `attachPiTuiMouseSupport(tui, surface)` and set explicit island bounds with `surface.setScreenBounds(...)`. See [`examples/pi-tui-live.tsx`](examples/pi-tui-live.tsx).

## Use in Ink

This is the minimal shape of an Ink host app:

```tsx
/** @jsxImportSource react */

import { render } from "ink";
import { useKeyboard } from "@opentui/react";
import { createElement, useState } from "react";
import { OpenTuiInkSurface } from "opentui-island/ink";

function Counter() {
  const [count, setCount] = useState(0);

  useKeyboard(
    (event) => {
      if (event.eventType !== "release" && event.name === "a") {
        setCount((value) => value + 1);
      }
    },
    { release: true },
  );

  return createElement(
    "box",
    { style: { width: "100%", height: "100%", paddingLeft: 1 } },
    createElement("text", { fg: "#00ff88" }, `count: ${count}`),
  );
}

render(<OpenTuiInkSurface height={3} width={24} tree={<Counter />} />);
```

The Ink adapter currently forwards keyboard input. Because the surrounding file uses the React JSX runtime, the hosted OpenTUI subtree above uses `createElement(...)` for `box` and `text`.

## How it works

`opentui-island` treats an OpenTUI subtree as an embeddable terminal island:

- the parent runtime owns layout and outer application flow
- OpenTUI renders the hosted subtree offscreen
- the bridge captures a frame, serializes it to terminal lines, and forwards input back in

Current building blocks:

- `createOffscreenOpenTuiHost(...)` mounts an OpenTUI tree and captures frames.
- `hostFrameToAnsiLines(...)` converts a captured frame into ANSI rows.
- `diffHostFrames(...)` reports per-line changes for hosts that want partial repaint logic.
- `createPiTuiOpenTuiSurface(...)` exposes the hosted tree as a fixed-height `pi-tui` component.
- `OpenTuiInkSurface` renders the hosted tree inside an Ink layout region.

## Repo layout

- `src/core/` - host contracts, offscreen host, ANSI serialization, frame diffing
- `src/adapters/pi-tui/` - `pi-tui` surface and mouse bridge
- `src/adapters/ink/` - Ink surface component
- `examples/` - smoke scripts and live demos
- `test/` - adapter integration coverage

## Status

Experimental, but working.

Current constraints:

- Bun-only runtime for now
- `pi-tui` mouse support needs explicit island bounds
- Ink support currently forwards keyboard input, not mouse input

## Development

```bash
bun run check
bun run build
bun test

bun run smoke
bun run smoke:pi-tui
bun run smoke:ink

bun run demo:pi-tui
bun run demo:ink
```

Git installs a `pre-commit` hook via `simple-git-hooks` that runs `bun run check`.

## Support

- Bugs and feature requests: [GitHub issues](https://github.com/benvinegar/opentui-island/issues)
- Reference examples: [`examples/`](examples)
