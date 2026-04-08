/** @jsxImportSource react */

import { Box, render, Text, useApp, useInput, useStdin } from "ink";
import { Readable } from "node:stream";
import { InkOpenTuiSurface } from "../src/adapters/ink/index.js";

class DemoInputStream extends Readable {
  isTTY = true;

  override _read() {}

  ref() {
    return this;
  }

  setRawMode(_enabled: boolean) {
    return this;
  }

  unref() {
    return this;
  }
}

function DemoApp() {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();

  useInput(
    (input, key) => {
      if (input === "q" || key.escape) {
        exit();
      }
    },
    { isActive: isRawModeSupported },
  );

  return (
    <Box flexDirection="column">
      <Text>opentui-island Ink demo</Text>
      <Text>
        The Ink app stays on Node-compatible APIs while the embedded island renders in a Bun
        sidecar. Inside the island: Up/Down move, A increments. App keys: q or Escape quit.
      </Text>
      <InkOpenTuiSurface
        height={10}
        island={{ module: new URL("./islands/playground.island.tsx", import.meta.url) }}
      />
    </Box>
  );
}

const app = render(<DemoApp />, {
  stdin: process.stdin.isTTY
    ? process.stdin
    : (new DemoInputStream() as unknown as NodeJS.ReadStream),
  exitOnCtrlC: false,
});

const autoExitMs = Number.parseInt(process.env.INK_DEMO_AUTO_EXIT_MS ?? "", 10);
if (!Number.isNaN(autoExitMs) && autoExitMs >= 0) {
  setTimeout(() => {
    app.unmount();
    process.exit(0);
  }, autoExitMs);
}
