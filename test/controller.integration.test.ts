import { describe, expect, test } from "bun:test";
import { TUI, type Terminal } from "@mariozechner/pi-tui";
import { createPiTuiSurface } from "../src/adapters/pi-tui/index.js";
import { createIslandController, hostFrameToAnsiLines } from "../src/index.js";

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

describe("IslandController", () => {
  test("owns mount, props, events, and frame sync directly", async () => {
    const controller = await createIslandController({
      island: {
        module: new URL("./fixtures/updatable-counter.island.tsx", import.meta.url),
        props: { label: "alpha" },
      },
      size: { width: 32, height: 3 },
    });

    try {
      expect(controller.ready).toBe(true);
      expect(hostFrameToAnsiLines(controller.frame!).join("\n")).toContain("label:alpha count:0");

      await controller.sendKey({ sequence: "a" });
      expect(hostFrameToAnsiLines(await controller.syncFrame()).join("\n")).toContain(
        "label:alpha count:1",
      );

      await controller.updateProps({ label: "beta" });
      expect(hostFrameToAnsiLines(await controller.syncFrame()).join("\n")).toContain(
        "label:beta count:1",
      );
    } finally {
      await controller.destroy();
    }
  });

  test("can be bound through the pi-tui surface wrapper", async () => {
    const terminal = new NullTerminal(32, 4);
    const tui = new TUI(terminal);
    const controller = await createIslandController({
      size: { width: 32, height: 3 },
    });

    const surface = await createPiTuiSurface({
      controller,
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

      await controller.sendKey({ sequence: "a" });
      await surface.sync(32);
      expect(tui.render(32).join("\n")).toContain("label:alpha count:1");
    } finally {
      await surface.destroy();
    }
  });
});
