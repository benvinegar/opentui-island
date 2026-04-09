/** @jsxImportSource react */

import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { TUI, type Terminal } from "@mariozechner/pi-tui";
import { render } from "ink-testing-library";
import { createOpenTuiSidecarHost } from "../src/index.js";
import { InkOpenTuiSurface } from "../src/adapters/ink/index.js";
import { createPiTuiOpenTuiSurface } from "../src/adapters/pi-tui/index.js";

class NullTerminal implements Terminal {
  constructor(
    readonly columns: number,
    readonly rows: number,
  ) {}

  get kittyProtocolActive() {
    return false;
  }

  start(_onInput: (data: string) => void, _onResize: () => void) {}
  stop() {}
  async drainInput() {}
  write(_data: string) {}
  moveBy(_lines: number) {}
  hideCursor() {}
  showCursor() {}
  clearLine() {}
  clearFromCursor() {}
  clearScreen() {}
  setTitle(_title: string) {}
}

function isSaveEvent(event: {
  type: string;
  payload: unknown;
}): event is { type: "save"; payload: { art: string } } {
  return event.type === "save";
}

function isCancelEvent(event: {
  type: string;
  payload: unknown;
}): event is { type: "cancel"; payload: null } {
  return event.type === "cancel";
}

async function waitForFrameContains(app: ReturnType<typeof render>, text: string, timeoutMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const frame = app.lastFrame() ?? "";
    if (frame.includes(text)) {
      return frame;
    }

    await Bun.sleep(20);
  }

  throw new Error(
    `Timed out waiting for frame to contain '${text}'. Last frame:\n${app.lastFrame()}`,
  );
}

describe("island event bridge", () => {
  test("lets the low-level sidecar host send commands and await results", async () => {
    const host = await createOpenTuiSidecarHost({
      size: { width: 32, height: 3 },
    });

    try {
      await host.mount({ module: new URL("./fixtures/bridge.island.tsx", import.meta.url) });
      const saveWait = host.waitForEvent(isSaveEvent);
      await host.sendCommand({ type: "setArt", payload: "hello" });
      await host.renderFrame();
      await host.sendKey({ sequence: "s" });

      const result = await saveWait;
      expect(result.payload.art).toBe("hello");

      const cancelWait = host.waitForEvent(isCancelEvent);
      await host.sendKey({ sequence: "c" });
      const cancel = await cancelWait;
      expect(cancel.type).toBe("cancel");
    } finally {
      await host.destroy();
    }
  });

  test("lets the pi-tui surface await save events", async () => {
    const terminal = new NullTerminal(32, 4);
    const tui = new TUI(terminal);
    const surface = await createPiTuiOpenTuiSurface({
      height: 3,
      initialWidth: 32,
      requestRender: () => {
        tui.requestRender();
      },
      island: { module: new URL("./fixtures/bridge.island.tsx", import.meta.url) },
    });

    try {
      tui.addChild(surface);
      tui.setFocus(surface);
      await surface.sync(32);
      const saveWait = surface.waitForEvent(isSaveEvent);
      await surface.sendCommand({ type: "setArt", payload: "from-pi" });
      await surface.sync(32);
      await surface.sendInput("s");

      const result = await saveWait;
      expect(result.payload.art).toBe("from-pi");
    } finally {
      await surface.destroy();
    }
  });

  test("lets the Ink surface forward bridge events through props", async () => {
    const events: Array<{ type: string; payload: unknown }> = [];
    const app = render(
      createElement(InkOpenTuiSurface, {
        island: { module: new URL("./fixtures/bridge.island.tsx", import.meta.url) },
        height: 2,
        width: 32,
        onEvent: (event) => {
          events.push(event);
        },
      }),
    );

    try {
      expect(await waitForFrameContains(app, "art:initial-art")).toContain("art:initial-art");

      app.stdin.write("s");
      await Bun.sleep(50);
      expect(events.some((event) => event.type === "save")).toBe(true);
      expect(events.find((event) => event.type === "save")).toEqual({
        type: "save",
        payload: { art: "initial-art" },
      });
    } finally {
      app.unmount();
      app.cleanup();
    }
  });
});
