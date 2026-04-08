/** @jsxImportSource react */

import assert from "node:assert/strict";
import { render } from "ink-testing-library";
import { useKeyboard } from "@opentui/react";
import { createElement, useState } from "react";
import { InkOpenTuiSurface } from "../src/adapters/ink/index.js";

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function CounterApp() {
  const [count, setCount] = useState(0);

  useKeyboard(
    (event) => {
      if (event.eventType !== "release" && event.name === "a") {
        setCount((value) => value + 1);
      }
    },
    { release: true },
  );

  return createElement(
    "box",
    { style: { width: "100%", height: "100%", paddingLeft: 1 } },
    createElement("text", { fg: "#00ff88" }, `count:${count}`),
  );
}

const app = render(<InkOpenTuiSurface tree={<CounterApp />} height={2} width={24} />);

try {
  await wait(30);
  assert(app.lastFrame()?.includes("count:0") ?? false);

  app.stdin.write("a");
  await wait(30);

  const frame = app.lastFrame() ?? "";
  assert(frame.includes("count:1"));

  console.log("ink adapter smoke ok");
  console.log(frame);
} finally {
  app.unmount();
  app.cleanup();
}
