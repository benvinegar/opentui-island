import assert from "node:assert/strict";
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

const terminal = new NullTerminal(24, 4);
const tui = new TUI(terminal);
let renderRequests = 0;

const surface = await createPiTuiOpenTuiSurface({
  height: 4,
  initialWidth: 24,
  requestRender: () => {
    renderRequests += 1;
  },
  island: { module: new URL("./islands/counter.island.tsx", import.meta.url) },
});

try {
  tui.addChild(surface);
  tui.setFocus(surface);

  await surface.sync(24);
  const initialLines = tui.render(24);
  assert(initialLines.join("\n").includes("count:0"));
  assert(renderRequests > 0);

  await surface.sendInput("a");
  const updatedLines = tui.render(24);
  assert(updatedLines.join("\n").includes("count:1"));

  console.log("pi-tui adapter smoke ok");
  for (const line of updatedLines) {
    console.log(line);
  }
} finally {
  await surface.destroy();
}
