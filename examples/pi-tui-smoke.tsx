import assert from "node:assert/strict";
import { TUI, type Terminal } from "@mariozechner/pi-tui";
import { useKeyboard } from "@opentui/react";
import { useState } from "react";
import { createPiTuiOpenTuiSurface } from "../src/pi-tui.js";

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

function CounterApp() {
  const [count, setCount] = useState(0);

  useKeyboard((event) => {
    if (event.eventType !== "release" && event.name === "a") {
      setCount((value) => value + 1);
    }
  }, { release: true });

  return (
    <box style={{ width: "100%", height: "100%", paddingLeft: 1 }}>
      <text fg="#00ff88">{`count: ${count}`}</text>
    </box>
  );
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
  tree: <CounterApp />,
});

tui.addChild(surface);
tui.setFocus(surface);

await surface.sync(24);
const initialLines = tui.render(24);
assert(initialLines.join("\n").includes("count: 0"));
assert(renderRequests > 0);

await surface.sendInput("a");
const updatedLines = tui.render(24);
assert(updatedLines.join("\n").includes("count: 1"));

console.log("pi-tui adapter smoke ok");
for (const line of updatedLines) {
  console.log(line);
}

await surface.destroy();
