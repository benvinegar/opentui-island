/** @jsxImportSource react */

import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { TUI, type Terminal } from "@mariozechner/pi-tui";
import { render } from "ink-testing-library";
import {
  createOpenTuiSidecarHost,
  type HostFrame,
  type HostKeyInput,
  type HostMouseInput,
  type HostSize,
  type OpenTuiBridgeEvent,
  type OpenTuiBridgeWaitOptions,
  type OpenTuiHost,
  type OpenTuiIslandProps,
  type OpenTuiIslandSource,
} from "../src/index.js";
import { InkOpenTuiSurface } from "../src/adapters/ink/index.js";
import {
  createPiTuiOpenTuiModal,
  createPiTuiOpenTuiSurface,
} from "../src/adapters/pi-tui/index.js";

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

class FakeModalHost implements OpenTuiHost {
  private readonly eventListeners = new Set<(event: OpenTuiBridgeEvent) => void>();
  private readonly pendingWaits = new Set<{
    match: (event: OpenTuiBridgeEvent) => boolean;
    resolve: (event: OpenTuiBridgeEvent) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout> | null;
  }>();
  private closed = false;
  private size: HostSize;

  constructor(size: HostSize) {
    this.size = size;
  }

  private emit(event: OpenTuiBridgeEvent) {
    for (const listener of this.eventListeners) {
      listener(event);
    }

    const matchingWaits = [] as Array<{
      match: (event: OpenTuiBridgeEvent) => boolean;
      resolve: (event: OpenTuiBridgeEvent) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout> | null;
    }>;
    for (const pending of this.pendingWaits) {
      if (!pending.match(event)) {
        continue;
      }

      matchingWaits.push(pending);
    }

    for (const pending of matchingWaits) {
      this.pendingWaits.delete(pending);
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.resolve(event);
    }
  }

  private ensureOpen() {
    if (this.closed) {
      throw new Error("OpenTUI sidecar has already been closed.");
    }
  }

  async mount(_island: OpenTuiIslandSource) {
    this.ensureOpen();
  }

  async updateProps(_props?: OpenTuiIslandProps) {
    this.ensureOpen();
  }

  onEvent(handler: (event: OpenTuiBridgeEvent) => void) {
    this.ensureOpen();
    this.eventListeners.add(handler);
    return () => {
      this.eventListeners.delete(handler);
    };
  }

  async sendCommand(event: OpenTuiBridgeEvent) {
    this.ensureOpen();
    if (event.type === "close" && typeof event.payload === "string") {
      this.emit({
        type: "save",
        payload: { text: event.payload },
      });
    }
  }

  waitForEvent<TEvent extends OpenTuiBridgeEvent = OpenTuiBridgeEvent>(
    match: (event: OpenTuiBridgeEvent) => event is TEvent,
    options: OpenTuiBridgeWaitOptions = {},
  ) {
    this.ensureOpen();
    const timeoutMs = options.timeoutMs ?? 0;
    return new Promise<TEvent>((resolve, reject) => {
      const pending = {
        match,
        resolve: (event: OpenTuiBridgeEvent) => {
          resolve(event as TEvent);
        },
        reject,
        timeout:
          timeoutMs > 0
            ? setTimeout(() => {
                this.pendingWaits.delete(pending);
                reject(new Error(`OpenTUI sidecar event wait timed out after ${timeoutMs}ms.`));
              }, timeoutMs)
            : null,
      };
      this.pendingWaits.add(pending);
    });
  }

  async resize(size: HostSize) {
    this.ensureOpen();
    this.size = size;
  }

  async focus() {
    this.ensureOpen();
  }

  async blur() {
    this.ensureOpen();
  }

  async sendKey(_input: HostKeyInput) {
    this.ensureOpen();
  }

  async sendMouse(_input: HostMouseInput) {
    this.ensureOpen();
  }

  async renderFrame(): Promise<HostFrame> {
    this.ensureOpen();
    return {
      width: this.size.width,
      height: this.size.height,
      lines: Array.from({ length: this.size.height }, () => ({ spans: [] })),
    };
  }

  async destroy() {
    if (this.closed) {
      return;
    }

    this.closed = true;
    const error = new Error("OpenTUI sidecar has already been closed.");
    for (const pending of this.pendingWaits) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.reject(error);
    }
    this.pendingWaits.clear();
    this.eventListeners.clear();
  }
}

function isSaveEvent(event: {
  type: string;
  payload: unknown;
}): event is { type: "save"; payload: { text: string } } {
  return event.type === "save";
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
      const saveWait = host.waitForEvent<"save", { text: string }>("save");
      await host.sendCommand({ type: "setText", payload: "hello" });
      await host.renderFrame();
      await host.sendKey({ sequence: "s" });

      const result = await saveWait;
      expect(result.payload.text).toBe("hello");

      const cancelWait = host.waitForEvent<"cancel", null>("cancel");
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
      const saveWait = surface.waitForEvent<"save", { text: string }>("save");
      await surface.sendCommand({ type: "setText", payload: "from-pi" });
      await surface.sync(32);
      await surface.sendInput("s");

      const result = await saveWait;
      expect(result.payload.text).toBe("from-pi");
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
      expect(await waitForFrameContains(app, "text:initial-text")).toContain("text:initial-text");

      app.stdin.write("s");
      await Bun.sleep(50);
      expect(events.some((event) => event.type === "save")).toBe(true);
      expect(events.find((event) => event.type === "save")).toEqual({
        type: "save",
        payload: { text: "initial-text" },
      });
    } finally {
      app.unmount();
      app.cleanup();
    }
  });

  test("rejects pending event waits when the host is destroyed", async () => {
    const host = await createOpenTuiSidecarHost({
      size: { width: 32, height: 3 },
    });

    try {
      await host.mount({ module: new URL("./fixtures/bridge.island.tsx", import.meta.url) });
      const pending = host.waitForEvent(isSaveEvent);
      await host.destroy();

      let error: Error | null = null;
      try {
        await pending;
      } catch (caught) {
        error = caught as Error;
      }

      expect(error).not.toBeNull();
      expect(error?.message).toContain("already been closed");
    } finally {
      await host.destroy();
    }
  });

  test("isolates throwing event listeners and matchers", async () => {
    const host = await createOpenTuiSidecarHost({
      size: { width: 32, height: 3 },
    });

    try {
      await host.mount({ module: new URL("./fixtures/bridge.island.tsx", import.meta.url) });

      host.onEvent(() => {
        throw new Error("listener boom");
      });

      const goodWait = host.waitForEvent(isSaveEvent);
      const badWait = host
        .waitForEvent(() => {
          throw new Error("matcher boom");
        })
        .catch((error) => error as Error);

      await host.sendKey({ sequence: "s" });

      const goodResult = await goodWait;
      expect(goodResult.payload.text).toBe("initial-text");

      const matcherError = await badWait;
      expect(matcherError).toBeInstanceOf(Error);
      expect(matcherError.message).toContain("matcher boom");
    } finally {
      await host.destroy();
    }
  });

  test("buffers commands sent before island command handlers register", async () => {
    const host = await createOpenTuiSidecarHost({
      size: { width: 32, height: 3 },
    });

    try {
      await host.mount({ module: new URL("./fixtures/bridge.island.tsx", import.meta.url) });
      await host.sendCommand({ type: "setText", payload: "queued-text" });
      await host.renderFrame();
      const saveWait = host.waitForEvent(isSaveEvent, { timeoutMs: 1000 });
      await host.sendKey({ sequence: "s" });

      const result = await saveWait;
      expect(result.payload.text).toBe("queued-text");
    } finally {
      await host.destroy();
    }
  });

  test("provides a pi-tui modal helper for close-on-event flows", async () => {
    const terminal = new NullTerminal(40, 10);
    const tui = new TUI(terminal);
    const host = new FakeModalHost({ width: 40, height: 3 });
    const modal = await createPiTuiOpenTuiModal<"save", { text: string }>({
      tui,
      host,
      height: 3,
      closeOn: ["save"],
      enableMouse: false,
      island: { module: new URL("./fixtures/bridge.island.tsx", import.meta.url) },
    });

    try {
      tui.addChild(modal.surface);
      modal.focus();
      await modal.sync();
      await modal.surface.sendCommand({ type: "close", payload: "from-modal" });

      const result = await modal.waitForResult();
      expect(result.payload.text).toBe("from-modal");

      let error: Error | null = null;
      try {
        await modal.surface.sendCommand({ type: "setText", payload: "after-close" });
      } catch (caught) {
        error = caught as Error;
      }

      expect(error).not.toBeNull();
      expect(error?.message).toContain("already been closed");
    } finally {
      await modal.destroy();
    }
  });

  test("lets host code subscribe by event type without a custom type guard", async () => {
    const host = await createOpenTuiSidecarHost({
      size: { width: 32, height: 3 },
    });

    try {
      await host.mount({ module: new URL("./fixtures/bridge.island.tsx", import.meta.url) });
      const events: Array<{ text: string }> = [];
      const unsubscribe = host.onEvent<"save", { text: string }>("save", (event) => {
        events.push(event.payload);
      });

      await host.sendCommand({ type: "setText", payload: "typed-save" });
      await host.renderFrame();
      await host.sendKey({ sequence: "s" });
      await Bun.sleep(20);

      expect(events).toEqual([{ text: "typed-save" }]);
      unsubscribe();
    } finally {
      await host.destroy();
    }
  });
});
