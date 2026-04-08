/** @jsxImportSource react */

import { describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import { useKeyboard } from "@opentui/react";
import { createElement, useState } from "react";
import { OpenTuiInkSurface } from "../src/adapters/ink/index.js";

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

describe("ink adapter", () => {
  test("forwards keyboard input into the hosted OpenTUI subtree", async () => {
    const app = render(<OpenTuiInkSurface tree={<CounterApp />} height={2} width={24} />);

    try {
      await Bun.sleep(30);
      expect(app.lastFrame()).toContain("count:0");

      app.stdin.write("a");
      await Bun.sleep(30);
      expect(app.lastFrame()).toContain("count:1");
    } finally {
      app.unmount();
      app.cleanup();
    }
  });
});
