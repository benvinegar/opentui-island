import { describe, expect, test } from "bun:test";
import { TUI, type Terminal } from "@mariozechner/pi-tui";
import {
  attachPiTuiMouseSupport,
  createPiTuiOpenTuiSurface,
} from "../src/adapters/pi-tui/index.js";

class TestTerminal implements Terminal {
  private inputHandler?: (data: string) => void;
  private resizeHandler?: () => void;
  readonly writes: string[] = [];

  constructor(
    readonly columns: number,
    readonly rows: number,
  ) {}

  get kittyProtocolActive() {
    return false;
  }

  start(onInput: (data: string) => void, onResize: () => void) {
    this.inputHandler = onInput;
    this.resizeHandler = onResize;
  }

  stop() {}

  async drainInput() {}

  write(data: string) {
    this.writes.push(data);
  }

  moveBy(_lines: number) {}

  hideCursor() {}

  showCursor() {}

  clearLine() {}

  clearFromCursor() {}

  clearScreen() {}

  setTitle(_title: string) {}

  emitInput(data: string) {
    this.inputHandler?.(data);
  }

  emitResize() {
    this.resizeHandler?.();
  }
}

function createMouseSequence(type: "down" | "up" | "scroll", x: number, y: number, button = 0) {
  const ansiX = x + 1;
  const ansiY = y + 1;
  const suffix = type === "down" || type === "scroll" ? "M" : "m";
  return `\u001B[<${button};${ansiX};${ansiY}${suffix}`;
}

async function settle(
  surface: Awaited<ReturnType<typeof createPiTuiOpenTuiSurface>>,
  width: number,
) {
  await Bun.sleep(0);
  await surface.sync(width);
  await Bun.sleep(0);
  await surface.sync(width);
}

describe("pi-tui mouse adapter", () => {
  test("routes click and scroll events through explicit island bounds", async () => {
    const terminal = new TestTerminal(24, 8);
    const tui = new TUI(terminal);
    const surface = await createPiTuiOpenTuiSurface({
      height: 4,
      initialWidth: 20,
      requestRender: () => {
        tui.requestRender();
      },
      island: { module: new URL("./fixtures/mouse.island.tsx", import.meta.url) },
    });

    surface.setScreenBounds({ row: 2, col: 4, width: 20 });
    tui.addChild(surface);
    const detachMouseSupport = attachPiTuiMouseSupport(tui, surface);
    tui.start();

    try {
      await settle(surface, 20);
      expect(tui.render(20).join("\n")).toContain("clicks:0");
      expect(tui.render(20).join("\n")).toContain("scroll:none");
      expect(terminal.writes.join("")).toContain("\u001B[?1006h");

      terminal.emitInput(createMouseSequence("down", 1, 1, 0));
      await settle(surface, 20);
      expect(tui.render(20).join("\n")).toContain("clicks:0");
      expect(surface.focused).toBe(false);

      terminal.emitInput(createMouseSequence("down", 5, 2, 0));
      await settle(surface, 20);
      expect(tui.render(20).join("\n")).toContain("clicks:1");
      expect(surface.focused).toBe(true);

      terminal.emitInput(createMouseSequence("scroll", 6, 3, 65));
      await settle(surface, 20);
      expect(tui.render(20).join("\n")).toContain("scroll:down");
    } finally {
      detachMouseSupport();
      await surface.destroy();
      tui.stop();
    }

    expect(terminal.writes.join("")).toContain("\u001B[?1006l");
  });
});
