import { Box, render, Text, useApp, useInput, useStdin } from "ink";
import React from "react";
import { Readable } from "node:stream";
import { InkOpenTuiSurface } from "../dist/adapters/ink/index.js";

class DemoInputStream extends Readable {
  constructor() {
    super();
    this.isTTY = true;
  }

  _read() {}

  ref() {
    return this;
  }

  setRawMode() {
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

  return React.createElement(
    Box,
    { flexDirection: "column" },
    React.createElement(Text, null, "opentui-island Ink demo"),
    React.createElement(
      Text,
      null,
      "The Ink app is running under Node while the embedded island renders in a Bun sidecar. Inside the island: Up/Down move, A increments, click selects, wheel scroll changes panels. App keys: q or Escape quit.",
    ),
    React.createElement(InkOpenTuiSurface, {
      height: 10,
      island: { module: new URL("./islands/playground.island.tsx", import.meta.url) },
    }),
  );
}

const app = render(React.createElement(DemoApp), {
  stdin: process.stdin.isTTY ? process.stdin : new DemoInputStream(),
  exitOnCtrlC: false,
});

const autoExitMs = Number.parseInt(process.env.INK_DEMO_AUTO_EXIT_MS ?? "", 10);
if (!Number.isNaN(autoExitMs) && autoExitMs >= 0) {
  setTimeout(() => {
    app.unmount();
    process.exit(0);
  }, autoExitMs);
}
