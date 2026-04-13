import { describe, expect, test } from "bun:test";
import { TUI, type Terminal } from "@mariozechner/pi-tui";
import { createPiTuiSurface } from "../src/adapters/pi-tui/index.js";

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

describe("pi-tui ready state", () => {
  test("exposes ready state and reports mount errors", async () => {
    const terminal = new NullTerminal(24, 4);
    const tui = new TUI(terminal);
    let readyCount = 0;
    let seenError: Error | null = null;

    const surface = await createPiTuiSurface({
      height: 2,
      initialWidth: 24,
      requestRender: () => {
        tui.requestRender();
      },
      island: { module: new URL("./fixtures/counter.island.tsx", import.meta.url) },
      onReady: () => {
        readyCount += 1;
      },
      onError: (error) => {
        seenError = error;
      },
    });

    try {
      await surface.waitUntilReady();
      expect(surface.ready).toBe(true);
      expect(surface.readyState).toBe("ready");
      expect(surface.readyError).toBeNull();
      expect(readyCount).toBe(1);

      let rejected = false;
      try {
        await surface.setIsland({
          module: new URL("./fixtures/counter.island.tsx", import.meta.url),
          exportName: "MissingExport",
        });
      } catch {
        rejected = true;
      }

      expect(rejected).toBe(true);
      expect(surface.ready).toBe(false);
      expect(surface.readyState).toBe("error");
      expect(surface.readyError?.message).toContain("MissingExport");
      expect(seenError?.message).toContain("MissingExport");

      let waitRejected = false;
      try {
        await surface.waitUntilReady();
      } catch {
        waitRejected = true;
      }

      expect(waitRejected).toBe(true);
    } finally {
      await surface.destroy();
    }
  });
});
