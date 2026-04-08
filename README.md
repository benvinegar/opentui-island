# opentui-island

Embed OpenTUI islands inside Node host terminal UIs such as `pi-tui` and Ink.

[![GitHub stars](https://img.shields.io/github/stars/benvinegar/opentui-island?style=for-the-badge)](https://github.com/benvinegar/opentui-island/stargazers)
[![Runtime Node + Bun sidecar](https://img.shields.io/badge/runtime-node%20host%20%2B%20bun%20sidecar-111827?style=for-the-badge)](https://bun.sh)
[![Adapters pi-tui + ink](https://img.shields.io/badge/adapters-pi--tui%20%2B%20ink-0ea5e9?style=for-the-badge)](https://github.com/benvinegar/opentui-island/tree/main/src/adapters)
[![Status experimental](https://img.shields.io/badge/status-experimental-f59e0b?style=for-the-badge)](https://github.com/benvinegar/opentui-island)

`opentui-island` solves the runtime split between Bun-only OpenTUI rendering and Node-oriented host TUIs:

- your host app stays in `pi-tui` or Ink
- OpenTUI renders in a local Bun sidecar
- the adapter bridges frames, resize, focus, keyboard, and mouse input

## Why opentui-island

- Let the host TUI own outer layout while OpenTUI owns the embedded widget.
- Reuse the same island module across multiple host runtimes.
- Keep OpenTUI's Bun dependency out of the host process.
- Paint captured OpenTUI frames back into a Node-compatible terminal UI.

## Runtime model

- Host app: Node-compatible runtime such as `pi-tui` or Ink
- Renderer: local Bun sidecar spawned by `opentui-island`
- Island: separate module that Bun can import, such as `.ts`, `.tsx`, `.js`, or `.jsx`

## Install

1. Install Bun 1.3+ on the machine running the host app.
2. Install `opentui-island`, React, OpenTUI, and your host runtime.

For `pi-tui`:

```bash
npm i opentui-island react @opentui/core @opentui/react @mariozechner/pi-tui
```

For Ink:

```bash
npm i opentui-island react @opentui/core @opentui/react ink
```

`@mariozechner/pi-tui` and `ink` are optional peers. Install the host runtime you plan to use.

## Write an island

An island is a separate module that the Bun sidecar can import:

```tsx
/** @jsxImportSource @opentui/react */

import { useKeyboard } from "@opentui/react";
import { useState } from "react";

export default function CounterIsland({ label = "default" }: { label?: string }) {
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
      <text fg="#00ff88">{`label:${label} count:${count}`}</text>
    </box>
  );
}
```

## Use in pi-tui

```tsx
import { matchesKey, ProcessTerminal, TUI } from "@mariozechner/pi-tui";
import { createPiTuiOpenTuiSurface } from "opentui-island/pi-tui";

const terminal = new ProcessTerminal();
const tui = new TUI(terminal);

const surface = await createPiTuiOpenTuiSurface({
  height: 4,
  initialWidth: terminal.columns,
  requestRender: () => tui.requestRender(),
  island: { module: new URL("./counter.island.tsx", import.meta.url), props: { label: "alpha" } },
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

await surface.updateProps({ label: "beta" });
```

For mouse input in `pi-tui`, also call `attachPiTuiMouseSupport(tui, surface)` and set explicit island bounds with `surface.setScreenBounds(...)`. See [`examples/pi-tui-live.mjs`](examples/pi-tui-live.mjs).

## Use in Ink

```tsx
/** @jsxImportSource react */

import { render } from "ink";
import { InkOpenTuiSurface } from "opentui-island/ink";

render(
  <InkOpenTuiSurface
    height={3}
    width={24}
    island={{ module: new URL("./counter.island.tsx", import.meta.url), props: { label: "alpha" } }}
  />,
);
```

## Update props

Low-level hosts can update props after mount without swapping to a different island module:

```ts
const host = await createOpenTuiSidecarHost({
  size: { width: 24, height: 4 },
});

await host.mount({
  module: new URL("./counter.island.tsx", import.meta.url),
  props: { label: "alpha" },
});

await host.updateProps({ label: "beta" });
```

## Try the demos

```bash
git clone https://github.com/benvinegar/opentui-island.git
cd opentui-island
bun install

bun run smoke
bun run smoke:pi-tui
bun run smoke:ink

bun run demo:pi-tui
bun run demo:ink
```

- `smoke` exercises the low-level sidecar client directly.
- `smoke:pi-tui` and `smoke:ink` run the host app under Node and verify the adapters end to end.
- `demo:pi-tui` launches a live `ProcessTerminal` app under Node with keyboard, click, and wheel input inside the embedded island.
- `demo:ink` launches a live Ink app under Node with keyboard input forwarded into the embedded island.

## Package entrypoints

- `opentui-island` - `createOpenTuiSidecarHost(...)`, shared types, ANSI helpers, frame diffing
- `opentui-island/pi-tui` - `createPiTuiOpenTuiSurface(...)` and `attachPiTuiMouseSupport(...)`
- `opentui-island/ink` - `InkOpenTuiSurface`

## Status

Experimental, but working.

Current constraints:

- Bun is still required locally for the renderer sidecar
- island modules must be loadable by Bun
- `pi-tui` mouse support needs explicit island bounds
- Ink forwards keyboard input; mouse bridging is not implemented yet

## Development

```bash
bun run check
bun run build
bun run check:node-imports
bun test
bun run test:node-integration

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

## License

[MIT](LICENSE)
