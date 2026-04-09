import assert from "node:assert/strict";
import React from "react";
import { TUI } from "@mariozechner/pi-tui";
import { render } from "ink-testing-library";
import { createOpenTuiSidecarHost, hostFrameToAnsiLines } from "../dist/index.js";
import { InkOpenTuiSurface } from "../dist/adapters/ink/index.js";
import { createPiTuiOpenTuiSurface } from "../dist/adapters/pi-tui/index.js";

const islandModule = new URL("./fixtures/updatable-counter.island.tsx", import.meta.url);
const mouseIslandModule = new URL("./fixtures/mouse.island.tsx", import.meta.url);
const bridgeIslandModule = new URL("./fixtures/bridge-built.island.mjs", import.meta.url);

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForFrameContains(app, text, timeoutMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const frame = app.lastFrame() ?? "";
    if (frame.includes(text)) {
      return frame;
    }

    await wait(20);
  }

  throw new Error(
    `Timed out waiting for frame to contain '${text}'. Last frame:\n${app.lastFrame()}`,
  );
}

function createMouseSequence(type, x, y, button = 0) {
  const ansiX = x + 1;
  const ansiY = y + 1;
  const suffix = type === "down" || type === "scroll" ? "M" : "m";
  return `\u001B[<${button};${ansiX};${ansiY}${suffix}`;
}

class NullTerminal {
  constructor(columns, rows) {
    this.columns = columns;
    this.rows = rows;
  }

  get kittyProtocolActive() {
    return false;
  }

  start() {}
  stop() {}
  async drainInput() {}
  write() {}
  moveBy() {}
  hideCursor() {}
  showCursor() {}
  clearLine() {}
  clearFromCursor() {}
  clearScreen() {}
  setTitle() {}
}

async function testNodeSidecarHost() {
  const host = await createOpenTuiSidecarHost({
    size: {
      width: 32,
      height: 3,
    },
  });

  try {
    await host.mount({ module: islandModule, props: { label: "alpha" } });
    assert(
      hostFrameToAnsiLines(await host.renderFrame())
        .join("\n")
        .includes("label:alpha count:0"),
    );

    await host.sendKey({ sequence: "a" });
    assert(
      hostFrameToAnsiLines(await host.renderFrame())
        .join("\n")
        .includes("label:alpha count:1"),
    );

    await host.updateProps({ label: "beta" });
    assert(
      hostFrameToAnsiLines(await host.renderFrame())
        .join("\n")
        .includes("label:beta count:1"),
    );
  } finally {
    await host.destroy();
  }
}

async function testNodePiTuiHost() {
  const terminal = new NullTerminal(32, 4);
  const tui = new TUI(terminal);
  const surface = await createPiTuiOpenTuiSurface({
    height: 3,
    initialWidth: 32,
    requestRender: () => {
      tui.requestRender();
    },
    island: { module: islandModule, props: { label: "alpha" } },
  });

  try {
    tui.addChild(surface);
    tui.setFocus(surface);

    await surface.sync(32);
    assert(tui.render(32).join("\n").includes("label:alpha count:0"));

    await surface.sendInput("a");
    assert(tui.render(32).join("\n").includes("label:alpha count:1"));

    await surface.updateProps({ label: "beta" });
    assert(tui.render(32).join("\n").includes("label:beta count:1"));
  } finally {
    await surface.destroy();
  }
}

async function testNodeInkHost() {
  const app = render(
    React.createElement(InkOpenTuiSurface, {
      island: { module: islandModule, props: { label: "alpha" } },
      height: 2,
      width: 32,
    }),
  );

  try {
    assert(
      (await waitForFrameContains(app, "label:alpha count:0")).includes("label:alpha count:0"),
    );

    app.stdin.write("a");
    assert(
      (await waitForFrameContains(app, "label:alpha count:1")).includes("label:alpha count:1"),
    );

    app.rerender(
      React.createElement(InkOpenTuiSurface, {
        island: { module: islandModule, props: { label: "beta" } },
        height: 2,
        width: 32,
      }),
    );

    assert((await waitForFrameContains(app, "label:beta count:1")).includes("label:beta count:1"));
  } finally {
    app.unmount();
    app.cleanup();
  }
}

async function testNodeInkMouseHost() {
  const app = render(
    React.createElement(InkOpenTuiSurface, {
      island: { module: mouseIslandModule },
      height: 2,
      width: 24,
    }),
  );

  try {
    assert((await waitForFrameContains(app, "clicks:0")).includes("clicks:0"));
    assert((app.lastFrame() ?? "").includes("scroll:none"));

    app.stdin.write(createMouseSequence("down", 0, 0, 0));
    assert((await waitForFrameContains(app, "clicks:1")).includes("clicks:1"));

    app.stdin.write(createMouseSequence("scroll", 0, 1, 65));
    assert((await waitForFrameContains(app, "scroll:down")).includes("scroll:down"));
  } finally {
    app.unmount();
    app.cleanup();
  }
}

function isSaveEvent(event) {
  return event.type === "save";
}

async function testNodeBridgeHost() {
  const host = await createOpenTuiSidecarHost({
    size: {
      width: 32,
      height: 3,
    },
  });

  try {
    await host.mount({ module: bridgeIslandModule });
    const eventWait = host.waitForEvent(isSaveEvent);
    await host.sendCommand({ type: "setArt", payload: "node-art" });
    await host.renderFrame();
    await host.sendKey({ sequence: "s" });

    const event = await eventWait;
    assert.equal(event.payload.art, "node-art");
  } finally {
    await host.destroy();
  }
}

await testNodeSidecarHost();
await testNodePiTuiHost();
await testNodeInkHost();
await testNodeInkMouseHost();
await testNodeBridgeHost();

console.log("node integration ok");
