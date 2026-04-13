import { describe, expect, test } from "bun:test";
import { createSidecarHost, hostFrameToAnsiLines } from "../src/index.js";

describe("sidecar host props", () => {
  test("updates island props without resetting island state", async () => {
    const host = await createSidecarHost({
      size: {
        width: 32,
        height: 3,
      },
    });

    try {
      await host.mount({
        module: new URL("./fixtures/updatable-counter.island.tsx", import.meta.url),
        props: { label: "alpha" },
      });
      expect(hostFrameToAnsiLines(await host.renderFrame()).join("\n")).toContain(
        "label:alpha count:0",
      );

      await host.sendKey({ sequence: "a" });
      expect(hostFrameToAnsiLines(await host.renderFrame()).join("\n")).toContain(
        "label:alpha count:1",
      );

      await host.updateProps({ label: "beta" });
      expect(hostFrameToAnsiLines(await host.renderFrame()).join("\n")).toContain(
        "label:beta count:1",
      );
    } finally {
      await host.destroy();
    }
  });
});
