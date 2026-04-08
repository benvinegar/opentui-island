/** @jsxImportSource react */

import { describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import { InkOpenTuiSurface } from "../src/adapters/ink/index.js";

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

describe("ink adapter", () => {
  test("forwards keyboard input into the hosted OpenTUI island", async () => {
    const app = render(
      <InkOpenTuiSurface
        island={{ module: new URL("./fixtures/counter.island.tsx", import.meta.url) }}
        height={2}
        width={24}
      />,
    );

    try {
      expect(await waitForFrameContains(app, "count:0")).toContain("count:0");

      app.stdin.write("a");
      expect(await waitForFrameContains(app, "count:1")).toContain("count:1");
    } finally {
      app.unmount();
      app.cleanup();
    }
  });
});
