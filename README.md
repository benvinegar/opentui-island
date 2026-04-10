# opentui-island

Embed OpenTUI islands inside Node terminal UIs such as `pi-tui` and Ink.

[![npm version](https://img.shields.io/npm/v/opentui-island?style=for-the-badge)](https://www.npmjs.com/package/opentui-island)
[![CI](https://img.shields.io/github/actions/workflow/status/benvinegar/opentui-island/ci.yml?branch=main&style=for-the-badge&label=CI)](https://github.com/benvinegar/opentui-island/actions/workflows/ci.yml)
[![Runtime Node host + Bun sidecar](https://img.shields.io/badge/runtime-node%20host%20%2B%20bun%20sidecar-111827?style=for-the-badge)](https://bun.sh)

- Keep the host app in Node.
- Render the embedded OpenTUI island in a local Bun sidecar.
- Forward resize, focus, keyboard, and mouse input across the process boundary.
- Reuse one island module across `pi-tui`, Ink, and lower-level hosts.

## Install

Requirements:

- Node 18+
- Bun 1.3+
- React
- one host runtime: `@mariozechner/pi-tui` or `ink`

For `pi-tui`:

```bash
npm i opentui-island react @opentui/core @opentui/react @mariozechner/pi-tui
```

For Ink:

```bash
npm i opentui-island react @opentui/core @opentui/react ink
```

## Quick start

Write an island module that Bun can import:

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

Mount it in `pi-tui`:

```tsx
import { matchesKey, ProcessTerminal, TUI } from "@mariozechner/pi-tui";
import { createPiTuiOpenTuiSurface } from "opentui-island/pi-tui";

const terminal = new ProcessTerminal();
const tui = new TUI(terminal);

const surface = await createPiTuiOpenTuiSurface({
  height: 4,
  initialWidth: terminal.columns,
  requestRender: () => tui.requestRender(),
  island: {
    module: new URL("./counter.island.tsx", import.meta.url),
    props: { label: "alpha" },
  },
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
await surface.waitUntilReady();
```

Mount it in Ink:

```tsx
/** @jsxImportSource react */

import { render } from "ink";
import { InkOpenTuiSurface } from "opentui-island/ink";

render(
  <InkOpenTuiSurface
    height={3}
    width={24}
    island={{
      module: new URL("./counter.island.tsx", import.meta.url),
      props: { label: "alpha" },
    }}
    onReady={() => {
      console.log("island ready");
    }}
  />,
);
```

## Notes

- In `pi-tui`, calling `surface.setIsland(...)` again with the same module and new props updates the mounted island without a remount.
- `pi-tui` surfaces expose `ready`, `readyState`, `readyError`, and `waitUntilReady()`.
- Ink surfaces expose `onReady`, `onError`, and `onReadyStateChange` callbacks.
- Ink also forwards mouse input in interactive TTY sessions.

## Result bridge

Islands can emit structured events back to the host with `useOpenTuiIslandBridge()`.

Lifecycle semantics:

- Bridge events are a live stream. They are delivered only to listeners and waiters that are already attached when the island emits them.
- Events emitted before `onEvent(...)` or `waitForEvent(...)` is attached are not replayed later.
- `onEvent(...)` and `waitForEvent(...)` are independent. One event can notify listeners and also resolve every matching waiter.
- Matching waiters resolve from future events only. `waitForEvent(...)` does not inspect past events.
- Pending `waitForEvent(...)` calls reject when `destroy()` closes the host.
- Event order matches the order the host receives them from the sidecar.

Command buffering semantics:

- `sendCommand(...)` is different from events: commands sent immediately after `mount(...)` are buffered until the island registers its first `onCommand(...)` handler.
- That buffering is only for host -> island commands. Island -> host events are not queued or replayed.
- For result-style flows, attach your host listener or waiter before the user can trigger the island event.

Inside the island:

```tsx
import { useOpenTuiIslandBridge } from "opentui-island";

const bridge = useOpenTuiIslandBridge();

bridge.emit({
  type: "save",
  payload: { art: exportedArt },
});
```

In a `pi-tui` host:

```ts
const result = await surface.waitForEvent(
  (event): event is { type: "save"; payload: { art: string } } => event.type === "save",
);

await ctx.ui.pasteToEditor(result.payload.art);
```

Low-level hosts also support `onEvent(...)`, `waitForEvent(...)`, and `sendCommand(...)`.

## Demos

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

- `smoke:pi-tui` and `smoke:ink` run the host app under Node.
- Pi extension examples live in [`examples/pi/`](examples/pi/README.md).

## Development

```bash
bun run check
bun test
bun run test:node-integration
bun run test:tty-smoke
```

## Support

- Bugs and feature requests: [GitHub issues](https://github.com/benvinegar/opentui-island/issues)
- Pi extension examples: [`examples/pi/README.md`](examples/pi/README.md)
- Repo examples: [`examples/`](examples)

## Security

Use the [GitHub Security](https://github.com/benvinegar/opentui-island/security) tab for sensitive reports.

## License

[MIT](LICENSE)
