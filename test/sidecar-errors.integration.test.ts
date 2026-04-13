import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";
import { createSidecarHost } from "../src/index.js";

describe("sidecar error handling", () => {
  test("reports a clear Bun-not-found error", async () => {
    let error: Error | null = null;

    try {
      await createSidecarHost({
        bunCommand: "/definitely-missing-bun-command",
        size: { width: 24, height: 2 },
      });
    } catch (caught) {
      error = caught as Error;
    }

    expect(error).not.toBeNull();
    expect(error?.message).toContain("was not found");
  });

  test("times out when the sidecar never finishes startup", async () => {
    let error: Error | null = null;

    try {
      await createSidecarHost({
        bunCommand: "bun",
        sidecarPath: fileURLToPath(new URL("./fixtures/hanging-sidecar.mjs", import.meta.url)),
        size: { width: 24, height: 2 },
        startupTimeoutMs: 50,
      });
    } catch (caught) {
      error = caught as Error;
    }

    expect(error).not.toBeNull();
    expect(error?.message).toContain("handshake timed out");
  });

  test("rejects protocol mismatches during startup", async () => {
    let error: Error | null = null;

    try {
      await createSidecarHost({
        bunCommand: "bun",
        sidecarPath: fileURLToPath(new URL("./fixtures/mismatched-sidecar.mjs", import.meta.url)),
        size: { width: 24, height: 2 },
      });
    } catch (caught) {
      error = caught as Error;
    }

    expect(error).not.toBeNull();
    expect(error?.message).toContain("protocol mismatch");
  });

  test("times out stalled requests after startup", async () => {
    let error: Error | null = null;
    const host = await createSidecarHost({
      bunCommand: "bun",
      sidecarPath: fileURLToPath(new URL("./fixtures/stalled-sidecar.mjs", import.meta.url)),
      size: { width: 24, height: 2 },
      requestTimeoutMs: 50,
    });

    try {
      await host.mount({ module: new URL("./fixtures/counter.island.tsx", import.meta.url) });
    } catch (caught) {
      error = caught as Error;
    } finally {
      await host.destroy();
    }

    expect(error).not.toBeNull();
    expect(error?.message).toContain("mount timed out");
  });

  test("includes the request method in sidecar response errors", async () => {
    const host = await createSidecarHost({
      size: { width: 24, height: 2 },
    });

    try {
      let error: Error | null = null;
      try {
        await host.mount({
          module: new URL("./fixtures/counter.island.tsx", import.meta.url),
          exportName: "MissingExport",
        });
      } catch (caught) {
        error = caught as Error;
      }

      expect(error).not.toBeNull();
      expect(error?.message).toContain("OpenTUI sidecar mount failed:");
      expect(error?.message).toContain("MissingExport");
    } finally {
      await host.destroy();
    }
  });
});
