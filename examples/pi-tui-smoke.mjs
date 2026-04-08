import assert from "node:assert/strict";
import { TUI } from "@mariozechner/pi-tui";
import { createPiTuiOpenTuiSurface } from "../dist/adapters/pi-tui/index.js";

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
