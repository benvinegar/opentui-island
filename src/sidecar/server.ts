import { createElement, isValidElement, type ComponentType } from "react";
import { createInterface } from "node:readline";
import type { OffscreenOpenTuiHost } from "./offscreen-host.js";
import { createOffscreenOpenTuiHost } from "./offscreen-host.js";
import type { OpenTuiSidecarRequest, OpenTuiSidecarResponse } from "./protocol.js";

let host: OffscreenOpenTuiHost | null = null;

function writeResponse(response: OpenTuiSidecarResponse) {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

async function loadIslandTree(
  moduleSpecifier: string,
  exportName: string,
  props?: Record<string, unknown>,
) {
  const loaded = (await import(moduleSpecifier)) as Record<string, unknown>;
  const exported = loaded[exportName];
  if (!exported) {
    throw new Error(`Island export '${exportName}' was not found in '${moduleSpecifier}'.`);
  }

  if (isValidElement(exported)) {
    return exported;
  }

  if (typeof exported !== "function") {
    throw new Error(`Island export '${exportName}' must be a component or React element.`);
  }

  return createElement(exported as ComponentType<Record<string, unknown>>, props ?? {});
}

function ensureHost() {
  if (!host) {
    throw new Error("OpenTUI sidecar has not been created yet.");
  }

  return host;
}

async function handleRequest(request: OpenTuiSidecarRequest) {
  switch (request.method) {
    case "create": {
      if (host) {
        await host.destroy();
      }

      host = await createOffscreenOpenTuiHost(request.params);
      return undefined;
    }
    case "mount": {
      const tree = await loadIslandTree(
        request.params.island.module,
        request.params.island.exportName,
        request.params.island.props,
      );
      ensureHost().mount(tree);
      return undefined;
    }
    case "resize": {
      ensureHost().resize(request.params);
      return undefined;
    }
    case "focus": {
      ensureHost().focus();
      return undefined;
    }
    case "blur": {
      ensureHost().blur();
      return undefined;
    }
    case "sendKey": {
      await ensureHost().sendKey(request.params);
      return undefined;
    }
    case "sendMouse": {
      await ensureHost().sendMouse(request.params);
      return undefined;
    }
    case "renderFrame": {
      return await ensureHost().renderFrame();
    }
    case "destroy": {
      if (host) {
        await host.destroy();
        host = null;
      }

      return undefined;
    }
  }
}

const reader = createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

let requestChain = Promise.resolve();
reader.on("line", (line) => {
  requestChain = requestChain.then(async () => {
    if (line.trim().length === 0) {
      return;
    }

    let request: OpenTuiSidecarRequest;
    try {
      request = JSON.parse(line) as OpenTuiSidecarRequest;
    } catch {
      writeResponse({ id: -1, ok: false, error: `Invalid JSON request: ${line}` });
      return;
    }

    try {
      const result = await handleRequest(request);
      writeResponse({ id: request.id, ok: true, ...(result ? { result } : {}) });

      if (request.method === "destroy") {
        process.exit(0);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeResponse({ id: request.id, ok: false, error: message });
    }
  });
});

process.stdin.on("end", async () => {
  if (host) {
    await host.destroy();
  }
  process.exit(0);
});
