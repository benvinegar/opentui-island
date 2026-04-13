# opentui-island

Embed OpenTUI islands inside Node terminal UIs such as `pi-tui` and Ink.

[![npm version](https://img.shields.io/npm/v/opentui-island?style=for-the-badge)](https://www.npmjs.com/package/opentui-island)
[![CI](https://img.shields.io/github/actions/workflow/status/benvinegar/opentui-island/ci.yml?branch=main&style=for-the-badge&label=CI)](https://github.com/benvinegar/opentui-island/actions/workflows/ci.yml)

## Why

- Keep your host app in Node.
- Render the embedded OpenTUI island in a local Bun sidecar.
- Reuse one island module across `pi-tui`, Ink, and lower-level hosts.

## Install

Requirements:

- Node 18+
- Bun 1.3+
- React

Install with `pi-tui`:

```bash
npm i opentui-island react @opentui/core @opentui/react @mariozechner/pi-tui
```

Install with Ink:

```bash
npm i opentui-island react @opentui/core @opentui/react ink
```

## Quick start

Create one island module:

```tsx
/** @jsxImportSource @opentui/react */

import { useKeyboard } from "@opentui/react";
import { useState } from "react";

export default function CounterIsland() {
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
      <text fg="#00ff88">{`count:${count}`}</text>
    </box>
  );
}
```

Create a controller and bind it to `pi-tui`:

```tsx
import { matchesKey, ProcessTerminal, TUI } from "@mariozechner/pi-tui";
import { createIslandController } from "opentui-island";
import { createPiTuiSurface } from "opentui-island/pi-tui";

const terminal = new ProcessTerminal();
const tui = new TUI(terminal);

const controller = await createIslandController({
  size: { width: terminal.columns, height: 4 },
  island: {
    module: new URL("./counter.island.tsx", import.meta.url),
  },
});

const surface = await createPiTuiSurface({
  controller,
  height: 4,
  initialWidth: terminal.columns,
  requestRender: () => tui.requestRender(),
  island: controller.island!,
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

Press `a` inside the island to increment the counter. Press `q` to quit.

The same controller API works directly with lower-level hosts and can also be passed into Ink.

## Docs

- API and advanced usage: [`docs/api.md`](docs/api.md)
- Pi extension examples: [`examples/pi/README.md`](examples/pi/README.md)
- Repo examples: [`examples/`](examples)
- Release history: [GitHub releases](https://github.com/benvinegar/opentui-island/releases)

## Development

```bash
bun install
bun run check
bun test
bun run test:node-integration
```

## Contributing

- Bugs and feature requests: [GitHub issues](https://github.com/benvinegar/opentui-island/issues)
- Local agent and repo guidance: [`AGENTS.md`](AGENTS.md)

## Security

Use the [GitHub Security](https://github.com/benvinegar/opentui-island/security) tab for sensitive reports.

## License

[MIT](LICENSE)
