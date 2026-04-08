import { describe, expect, test } from "bun:test";
import { TUI, type Terminal } from "@mariozechner/pi-tui";
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

describe("pi-tui surface props", () => {
  test("updates island props without replacing the mounted state", async () => {
    const terminal = new NullTerminal(32, 4);
    const tui = new TUI(terminal);
    const surface = await createPiTuiOpenTuiSurface({
      height: 3,
      initialWidth: 32,
      requestRender: () => {
        tui.requestRender();
      },
      island: {
        module: new URL("./fixtures/updatable-counter.island.tsx", import.meta.url),
        props: { label: "alpha" },
      },
    });

    try {
      tui.addChild(surface);
      tui.setFocus(surface);

      await surface.sync(32);
      expect(tui.render(32).join("\n")).toContain("label:alpha count:0");

      await surface.sendInput("a");
      expect(tui.render(32).join("\n")).toContain("label:alpha count:1");

      await surface.updateProps({ label: "beta" });
      expect(tui.render(32).join("\n")).toContain("label:beta count:1");
    } finally {
      await surface.destroy();
    }
  });
});
