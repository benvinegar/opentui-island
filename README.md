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

Take an OpenTUI component:

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

Embed that component in Ink:

```tsx
import { render } from "ink";
import { createIslandController } from "opentui-island";
import { InkSurface } from "opentui-island/ink";

const controller = await createIslandController({
  island: {
    module: new URL("./counter.island.tsx", import.meta.url),
  },
});

render(<InkSurface controller={controller} width={24} height={4} />);
```

Or embed it in a Pi extension (pi-tui):

```tsx
import { matchesKey, ProcessTerminal, TUI } from "@mariozechner/pi-tui";
import { createIslandController } from "opentui-island";
import { createPiTuiSurface } from "opentui-island/pi-tui";

const terminal = new ProcessTerminal();
const tui = new TUI(terminal);

const controller = await createIslandController({
  island: {
    module: new URL("./counter.island.tsx", import.meta.url),
  },
});

const surface = await createPiTuiSurface({
  controller,
  height: 4,
  initialWidth: terminal.columns,
  requestRender: () => tui.requestRender(),
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

Press `a` inside the island to increment the counter. Press `q` to quit in `pi-tui`.

## How does it work?

- Your app stays in Node. `opentui-island` starts a local Bun sidecar for the embedded OpenTUI tree.
- The host adapter forwards size, focus, key, and mouse input to that sidecar.
- The sidecar renders the island offscreen and sends the current frame back to the host, which draws it inside the surrounding app.
- Use `props` to pass host state into the island.
- Use `events` to send notifications from the island back to the host.
- Use `commands` from the host to trigger imperative actions inside the island.

## Docs

- API and advanced usage: [`docs/api.md`](docs/api.md)
- Pi extension examples: [`examples/pi/README.md`](examples/pi/README.md)
- Repo examples: [`examples/`](examples)
- Release history: [GitHub releases](https://github.com/benvinegar/opentui-island/releases)

## Performance

Rough local measurements on the repo's example island:

| Operation                                            |      Avg |      p95 |
| ---------------------------------------------------- | -------: | -------: |
| Cold start to first frame (`createIslandController`) | 121.65ms | 134.92ms |
| Warm frame sync (`syncFrame`)                        |   1.30ms |   2.08ms |
| Key round-trip (`sendKey` + `syncFrame`)             |   1.76ms |   2.97ms |
| Prop update round-trip (`updateProps` + `syncFrame`) |   1.73ms |   3.16ms |

- Startup cost comes from launching the Bun sidecar.
- Steady-state interaction overhead is low on a local machine.
- These are rough local measurements, not CI or low-end hardware benchmarks.

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

- Treat islands like trusted application code, similar to npm dependencies or local plugins.
- The Bun sidecar provides runtime separation for rendering and compatibility. It is not a sandbox.
- Do not mount untrusted or user-supplied island modules.
- If an island renders untrusted text from users or remote systems, sanitize or escape terminal control sequences before displaying it.
- Use the [GitHub Security](https://github.com/benvinegar/opentui-island/security) tab for sensitive reports.

## License

[MIT](LICENSE)
