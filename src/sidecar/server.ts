import {
  createElement,
  isValidElement,
  useState,
  type ComponentType,
  type ReactElement,
} from "react";
import { createInterface } from "node:readline";
import type { OpenTuiIslandProps, ResolvedOpenTuiIslandSource } from "../core/island.js";
import type { OffscreenOpenTuiHost } from "./offscreen-host.js";
import { createOffscreenOpenTuiHost } from "./offscreen-host.js";
import {
  OPENTUI_SIDECAR_PROTOCOL,
  OPENTUI_SIDECAR_PROTOCOL_VERSION,
  type OpenTuiSidecarRequest,
  type OpenTuiSidecarResponse,
} from "./protocol.js";

let host: OffscreenOpenTuiHost | null = null;

interface LoadedIsland {
  acceptsProps: boolean;
  render: () => ReactElement;
  source: ResolvedOpenTuiIslandSource;
  updateProps: (props?: OpenTuiIslandProps) => void;
}

let loadedIsland: LoadedIsland | null = null;

function writeResponse(response: OpenTuiSidecarResponse) {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

async function loadIslandTree(source: ResolvedOpenTuiIslandSource) {
  const loaded = (await import(source.module)) as Record<string, unknown>;
  const exported = loaded[source.exportName];
  if (!exported) {
    throw new Error(`Island export '${source.exportName}' was not found in '${source.module}'.`);
  }

  if (isValidElement(exported)) {
    if (source.props && Object.keys(source.props).length > 0) {
      throw new Error(
        `Island export '${source.exportName}' is a React element and cannot receive props. Export a component to use mount props or updateProps().`,
      );
    }

    return {
      acceptsProps: false,
      render: () => exported,
      source,
      updateProps: (props) => {
        if (props && Object.keys(props).length > 0) {
          throw new Error(
            `Island export '${source.exportName}' does not accept prop updates because it resolves to a React element.`,
          );
        }
      },
    } satisfies LoadedIsland;
  }

  if (typeof exported !== "function") {
    throw new Error(`Island export '${source.exportName}' must be a component or React element.`);
  }

  let setCurrentProps: ((props?: OpenTuiIslandProps) => void) | null = null;
  const Component = exported as ComponentType<Record<string, unknown>>;

  function IslandComponentRoot() {
    const [currentProps, updateCurrentProps] = useState(source.props);
    setCurrentProps = updateCurrentProps;
    return createElement(Component, (currentProps ?? {}) as Record<string, unknown>);
  }

  return {
    acceptsProps: true,
    render: () => createElement(IslandComponentRoot),
    source,
    updateProps: (props) => {
      if (!setCurrentProps) {
        throw new Error("OpenTUI island props are not ready yet.");
      }

      setCurrentProps(props);
    },
  } satisfies LoadedIsland;
}

function ensureHost() {
  if (!host) {
    throw new Error("OpenTUI sidecar has not been created yet.");
  }

  return host;
}

function ensureLoadedIsland() {
  if (!loadedIsland) {
    throw new Error("OpenTUI island has not been mounted yet.");
  }

  return loadedIsland;
}

function renderLoadedIsland() {
  const island = ensureLoadedIsland();
  ensureHost().mount(island.render());
}

async function handleRequest(request: OpenTuiSidecarRequest) {
  switch (request.method) {
    case "handshake": {
      if (
        request.params.protocol !== OPENTUI_SIDECAR_PROTOCOL ||
        request.params.version !== OPENTUI_SIDECAR_PROTOCOL_VERSION
      ) {
        throw new Error(
          `OpenTUI sidecar protocol mismatch. Server supports ${OPENTUI_SIDECAR_PROTOCOL}@${OPENTUI_SIDECAR_PROTOCOL_VERSION}, but the host requested ${request.params.protocol}@${request.params.version}.`,
        );
      }

      return {
        protocol: OPENTUI_SIDECAR_PROTOCOL,
        version: OPENTUI_SIDECAR_PROTOCOL_VERSION,
      } as const;
    }
    case "create": {
      if (host) {
        await host.destroy();
      }

      host = await createOffscreenOpenTuiHost(request.params);
      loadedIsland = null;
      return undefined;
    }
    case "mount": {
      loadedIsland = await loadIslandTree(request.params.island);
      renderLoadedIsland();
      return undefined;
    }
    case "updateProps": {
      const island = ensureLoadedIsland();
      island.updateProps(request.params.props);
      loadedIsland = {
        ...island,
        source: {
          ...island.source,
          props: request.params.props,
        },
      };
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

      loadedIsland = null;

      return undefined;
    }
  }

  throw new Error(`Unknown sidecar method '${(request as { method: string }).method}'.`);
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
  loadedIsland = null;
  process.exit(0);
});
