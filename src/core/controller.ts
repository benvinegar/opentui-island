import type {
  OpenTuiBridgeEvent,
  OpenTuiBridgeEventOfType,
  OpenTuiBridgePayload,
  OpenTuiBridgeWaitOptions,
} from "./bridge.js";
import type { CreateOpenTuiHostOptions, OpenTuiHost } from "./host.js";
import {
  resolveOpenTuiIslandSource,
  type OpenTuiIslandProps,
  type OpenTuiIslandSource,
  type ResolvedOpenTuiIslandSource,
} from "./island.js";
import { OpenTuiReadyTracker, type OpenTuiReadyCallbacks } from "./ready.js";
import type { HostFrame, HostKeyInput, HostMouseInput, HostSize } from "./types.js";
import { createOpenTuiSidecarHost } from "../sidecar/client.js";

function hasSameIslandTarget(
  currentIsland: ResolvedOpenTuiIslandSource | null,
  nextIsland: ResolvedOpenTuiIslandSource,
) {
  return (
    currentIsland?.module === nextIsland.module &&
    currentIsland.exportName === nextIsland.exportName
  );
}

export interface CreateOpenTuiIslandControllerOptions
  extends Omit<Partial<CreateOpenTuiHostOptions>, "size">, OpenTuiReadyCallbacks {
  island?: OpenTuiIslandSource;
  host?: OpenTuiHost;
  size?: HostSize;
}

/** Shared lifecycle controller used by all host adapters. */
export class OpenTuiIslandController {
  private currentIsland: ResolvedOpenTuiIslandSource | null = null;
  private cachedFrame: HostFrame | null = null;
  private readonly readyTracker: OpenTuiReadyTracker;
  private host: OpenTuiHost | null;
  private readonly hostOptions: Omit<
    CreateOpenTuiIslandControllerOptions,
    "island" | "host" | "onReady" | "onError" | "onReadyStateChange"
  >;

  constructor(
    host: OpenTuiHost | null,
    hostOptions: Omit<
      CreateOpenTuiIslandControllerOptions,
      "island" | "host" | "onReady" | "onError" | "onReadyStateChange"
    >,
    readyCallbacks?: OpenTuiReadyCallbacks,
  ) {
    this.host = host;
    this.hostOptions = hostOptions;
    this.readyTracker = new OpenTuiReadyTracker(readyCallbacks);
  }

  get ready() {
    return this.readyTracker.isReady();
  }

  get readyState() {
    return this.readyTracker.getSnapshot().state;
  }

  get readyError() {
    return this.readyTracker.getSnapshot().error;
  }

  get island() {
    return this.currentIsland;
  }

  get frame() {
    return this.cachedFrame;
  }

  async waitUntilReady() {
    if (this.ready) {
      return;
    }

    await this.readyTracker.waitUntilReady();
  }

  private toReadyError(error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
  }

  private async ensureHost(size?: HostSize) {
    if (this.host) {
      return this.host;
    }

    const resolvedSize = size ?? this.hostOptions.size;
    if (!resolvedSize) {
      throw new Error("OpenTUI island controller needs a size before it can start the sidecar.");
    }

    this.host = await createOpenTuiSidecarHost({
      size: resolvedSize,
      kittyKeyboard: this.hostOptions.kittyKeyboard,
      otherModifiersMode: this.hostOptions.otherModifiersMode,
    });

    if (this.currentIsland) {
      await this.host.mount(this.currentIsland);
    }

    return this.host;
  }

  private markReadyFrame(frame: HostFrame) {
    this.cachedFrame = frame;
    // Ready means "we have rendered a usable frame", not just "mount/updateProps returned".
    if (this.readyState === "loading") {
      this.readyTracker.markReady();
    }
  }

  async setIsland(island: OpenTuiIslandSource) {
    const resolvedIsland = resolveOpenTuiIslandSource(island);
    this.readyTracker.startLoading();
    try {
      if (hasSameIslandTarget(this.currentIsland, resolvedIsland)) {
        // Reusing the same module/export keeps island-local state intact and turns this into a prop update.
        await this.updateProps(resolvedIsland.props);
        return;
      }

      if (!this.host) {
        this.currentIsland = resolvedIsland;
        this.cachedFrame = null;
        return;
      }

      await this.host.mount(resolvedIsland);
      this.currentIsland = resolvedIsland;
      this.cachedFrame = null;
    } catch (error) {
      this.readyTracker.markError(this.toReadyError(error));
      throw error;
    }
  }

  async updateProps(props?: OpenTuiIslandProps) {
    if (!this.currentIsland) {
      throw new Error("OpenTUI island has not been mounted yet.");
    }

    this.readyTracker.startLoading();
    try {
      if (!this.host) {
        this.currentIsland = {
          ...this.currentIsland,
          props,
        };
        this.cachedFrame = null;
        return;
      }

      await this.host.updateProps(props);
      this.currentIsland = {
        ...this.currentIsland,
        props,
      };
      this.cachedFrame = null;
    } catch (error) {
      this.readyTracker.markError(this.toReadyError(error));
      throw error;
    }
  }

  onEvent(handler: (event: OpenTuiBridgeEvent) => void): () => void;
  onEvent<TType extends string, TPayload extends OpenTuiBridgePayload = OpenTuiBridgePayload>(
    type: TType,
    handler: (event: OpenTuiBridgeEventOfType<TType, TPayload>) => void,
  ): () => void;
  onEvent<TType extends string, TPayload extends OpenTuiBridgePayload = OpenTuiBridgePayload>(
    typeOrHandler: TType | ((event: OpenTuiBridgeEvent) => void),
    maybeHandler?: (event: OpenTuiBridgeEventOfType<TType, TPayload>) => void,
  ) {
    if (typeof typeOrHandler === "string") {
      if (!this.host) {
        throw new Error("OpenTUI island controller must be mounted before subscribing to events.");
      }

      return this.host.onEvent(typeOrHandler, maybeHandler ?? (() => {}));
    }

    if (!this.host) {
      throw new Error("OpenTUI island controller must be mounted before subscribing to events.");
    }

    return this.host.onEvent(typeOrHandler);
  }

  async sendCommand(event: OpenTuiBridgeEvent) {
    if (!this.currentIsland) {
      throw new Error("OpenTUI island has not been mounted yet.");
    }

    const host = await this.ensureHost();
    await host.sendCommand(event);
    this.cachedFrame = null;
  }

  waitForEvent<TType extends string, TPayload extends OpenTuiBridgePayload = OpenTuiBridgePayload>(
    type: TType,
    options?: OpenTuiBridgeWaitOptions,
  ): Promise<OpenTuiBridgeEventOfType<TType, TPayload>>;
  waitForEvent<TEvent extends OpenTuiBridgeEvent = OpenTuiBridgeEvent>(
    match: (event: OpenTuiBridgeEvent) => event is TEvent,
    options?: OpenTuiBridgeWaitOptions,
  ): Promise<TEvent>;
  waitForEvent<TType extends string, TEvent extends OpenTuiBridgeEvent = OpenTuiBridgeEvent>(
    typeOrMatch: TType | ((event: OpenTuiBridgeEvent) => event is TEvent),
    options?: OpenTuiBridgeWaitOptions,
  ) {
    if (!this.host) {
      throw new Error("OpenTUI island controller must be mounted before waiting for events.");
    }

    return this.host.waitForEvent(
      typeOrMatch as TType & ((event: OpenTuiBridgeEvent) => event is TEvent),
      options,
    );
  }

  async resize(size: HostSize) {
    const host = await this.ensureHost(size);
    await host.resize(size);
    this.cachedFrame = null;
  }

  async syncFrame(size?: HostSize) {
    try {
      const host = await this.ensureHost(size);
      if (size) {
        // The controller treats size and frame fetch as one operation so adapters can ask for "the next frame at this size".
        await host.resize(size);
      }
      const frame = await host.renderFrame();
      this.markReadyFrame(frame);
      return frame;
    } catch (error) {
      this.readyTracker.markError(this.toReadyError(error));
      throw error;
    }
  }

  async focus() {
    if (!this.host) {
      return;
    }

    await this.host.focus();
  }

  async blur() {
    if (!this.host) {
      return;
    }

    await this.host.blur();
  }

  async sendKey(input: HostKeyInput) {
    const host = await this.ensureHost();
    await host.sendKey(input);
    this.cachedFrame = null;
  }

  async sendMouse(input: HostMouseInput) {
    const host = await this.ensureHost();
    await host.sendMouse(input);
    this.cachedFrame = null;
  }

  async destroy() {
    await this.host?.destroy();
  }
}

export async function createOpenTuiIslandController(options: CreateOpenTuiIslandControllerOptions) {
  const host =
    options.host ??
    (options.size
      ? await createOpenTuiSidecarHost({
          size: options.size,
          kittyKeyboard: options.kittyKeyboard,
          otherModifiersMode: options.otherModifiersMode,
        })
      : null);
  const controller = new OpenTuiIslandController(
    host,
    {
      size: options.size,
      kittyKeyboard: options.kittyKeyboard,
      otherModifiersMode: options.otherModifiersMode,
    },
    {
      onReady: options.onReady,
      onError: options.onError,
      onReadyStateChange: options.onReadyStateChange,
    },
  );

  if (options.island) {
    try {
      await controller.setIsland(options.island);
      if (options.size) {
        await controller.syncFrame(options.size);
      }
    } catch (error) {
      await controller.destroy();
      throw error;
    }
  }

  return controller;
}

export type CreateIslandControllerOptions = CreateOpenTuiIslandControllerOptions;
export type IslandController = OpenTuiIslandController;
export const createIslandController = createOpenTuiIslandController;
