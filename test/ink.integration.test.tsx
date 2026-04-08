/** @jsxImportSource react */

import { describe, expect, test } from "bun:test";
import { createElement } from "react";
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

  test("updates island props without resetting hosted state", async () => {
    const islandModule = new URL("./fixtures/updatable-counter.island.tsx", import.meta.url);
    const app = render(
      <InkOpenTuiSurface
        island={{ module: islandModule, props: { label: "alpha" } }}
        height={2}
        width={32}
      />,
    );

    try {
      expect(await waitForFrameContains(app, "label:alpha count:0")).toContain(
        "label:alpha count:0",
      );

      app.stdin.write("a");
      expect(await waitForFrameContains(app, "label:alpha count:1")).toContain(
        "label:alpha count:1",
      );

      app.rerender(
        createElement(InkOpenTuiSurface, {
          island: { module: islandModule, props: { label: "beta" } },
          height: 2,
          width: 32,
        }),
      );

      expect(await waitForFrameContains(app, "label:beta count:1")).toContain("label:beta count:1");
    } finally {
      app.unmount();
      app.cleanup();
    }
  });

  test("reports ready and error state through callbacks", async () => {
    const snapshots: string[] = [];
    let readyCount = 0;
    let seenError: Error | null = null;

    const readyApp = render(
      <InkOpenTuiSurface
        island={{ module: new URL("./fixtures/counter.island.tsx", import.meta.url) }}
        height={2}
        width={24}
        onReady={() => {
          readyCount += 1;
        }}
        onReadyStateChange={(snapshot) => {
          snapshots.push(snapshot.state);
        }}
      />,
    );

    try {
      expect(await waitForFrameContains(readyApp, "count:0")).toContain("count:0");
      expect(readyCount).toBe(1);
      expect(snapshots).toContain("ready");
    } finally {
      readyApp.unmount();
      readyApp.cleanup();
    }

    const errorApp = render(
      <InkOpenTuiSurface
        island={{
          module: new URL("./fixtures/counter.island.tsx", import.meta.url),
          exportName: "MissingExport",
        }}
        height={2}
        width={24}
        onError={(error) => {
          seenError = error;
        }}
      />,
    );

    try {
      expect(await waitForFrameContains(errorApp, "MissingExport")).toContain("MissingExport");
      expect(seenError?.message).toContain("MissingExport");
    } finally {
      errorApp.unmount();
      errorApp.cleanup();
    }
  });
});
