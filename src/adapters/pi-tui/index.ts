import {
  TUI,
  truncateToWidth,
  type Component,
  type Focusable,
  type Terminal,
} from "@mariozechner/pi-tui";
import { hostFrameToAnsiLines, hostLineToAnsi } from "../../core/ansi.js";
import type {
  OpenTuiBridgeEvent,
  OpenTuiBridgeEventOfType,
  OpenTuiBridgePayload,
  OpenTuiBridgeWaitOptions,
} from "../../core/bridge.js";
import { diffHostFrames } from "../../core/frame-diff.js";
import type { CreateOpenTuiHostOptions, OpenTuiHost } from "../../core/host.js";
import {
  resolveOpenTuiIslandSource,
  type OpenTuiIslandProps,
  type OpenTuiIslandSource,
  type ResolvedOpenTuiIslandSource,
} from "../../core/island.js";
import { OpenTuiReadyTracker, type OpenTuiReadyCallbacks } from "../../core/ready.js";
import {
  DISABLE_SGR_MOUSE_MODE,
  ENABLE_SGR_MOUSE_MODE,
  parseSgrMouseInput,
} from "../../core/terminal-mouse.js";
import { createOpenTuiSidecarHost } from "../../sidecar/client.js";
import type { HostFrame, HostMouseInput } from "../../core/types.js";

export interface CreatePiTuiOpenTuiSurfaceOptions
  extends Omit<CreateOpenTuiHostOptions, "size">, OpenTuiReadyCallbacks {
  height: number;
  island: OpenTuiIslandSource;
  requestRender?: () => void;
  initialWidth?: number;
  host?: OpenTuiHost;
}

export interface CreatePiTuiOpenTuiModalOptions extends Omit<
  CreatePiTuiOpenTuiSurfaceOptions,
  "requestRender" | "initialWidth"
> {
  tui: Pick<TUI, "addInputListener" | "requestRender" | "setFocus" | "terminal">;
  closeOn: readonly string[];
  enableMouse?: boolean;
  focusOnOpen?: boolean;
  closeWaitOptions?: OpenTuiBridgeWaitOptions;
}

export interface PiTuiOpenTuiModal<TEvent extends OpenTuiBridgeEvent = OpenTuiBridgeEvent> {
  surface: PiTuiOpenTuiSurface;
  result: Promise<TEvent>;
  focus(): void;
  waitForResult(): Promise<TEvent>;
  sync(): Promise<void>;
  destroy(): Promise<void>;
}

export interface PiTuiScreenBounds {
  row: number;
  col: number;
  width?: number;
  height?: number;
}

interface ResolvedPiTuiScreenBounds {
  row: number;
  col: number;
  width: number;
  height: number;
}

function resolveBounds(
  bounds: PiTuiScreenBounds | null | undefined,
  width: number,
  height: number,
) {
  if (!bounds) {
    return undefined;
  }

  return {
    row: bounds.row,
    col: bounds.col,
    width: bounds.width ?? width,
    height: bounds.height ?? height,
  } satisfies ResolvedPiTuiScreenBounds;
}

function eventInsideBounds(event: { x: number; y: number }, bounds: ResolvedPiTuiScreenBounds) {
  return (
    event.x >= bounds.col &&
    event.x < bounds.col + bounds.width &&
    event.y >= bounds.row &&
    event.y < bounds.row + bounds.height
  );
}

function blankLines(width: number, height: number) {
  const line = " ".repeat(Math.max(1, width));
  return Array.from({ length: height }, () => line);
}

function normalizeLines(lines: string[], width: number, height: number) {
  const normalizedWidth = Math.max(1, width);
  const visible = lines
    .slice(0, height)
    .map((line) => truncateToWidth(line, normalizedWidth, "...", true));

  while (visible.length < height) {
    visible.push(" ".repeat(normalizedWidth));
  }

  return visible;
}

function hasSameIslandTarget(
  currentIsland: ResolvedOpenTuiIslandSource | null,
  nextIsland: ResolvedOpenTuiIslandSource,
) {
  return (
    currentIsland?.module === nextIsland.module &&
    currentIsland.exportName === nextIsland.exportName
  );
}

/** A fixed-height pi-tui component that hosts one OpenTUI island. */
export class PiTuiOpenTuiSurface implements Component, Focusable {
  wantsKeyRelease = true;

  private readonly host: OpenTuiHost;
  private readonly height: number;
  private readonly requestRender: () => void;
  private lastWidth: number;
  private cachedFrame: HostFrame | undefined;
  private cachedLines: string[];
  private syncPromise: Promise<void> | null = null;
  private pendingWidth: number | null = null;
  private _focused = false;
  private currentIsland: ResolvedOpenTuiIslandSource | null = null;
  private readonly readyTracker: OpenTuiReadyTracker;
  private screenBounds: PiTuiScreenBounds | null = null;

  constructor(params: {
    host: OpenTuiHost;
    height: number;
    initialWidth: number;
    requestRender?: () => void;
    readyCallbacks?: OpenTuiReadyCallbacks;
  }) {
    this.host = params.host;
    this.height = params.height;
    this.lastWidth = Math.max(1, params.initialWidth);
    this.cachedLines = blankLines(this.lastWidth, this.height);
    this.requestRender = params.requestRender ?? (() => {});
    this.readyTracker = new OpenTuiReadyTracker(params.readyCallbacks);
    this.runInBackground(this.host.blur());
  }

  setScreenBounds(bounds: PiTuiScreenBounds | null) {
    this.screenBounds = bounds;
  }

  getScreenBounds() {
    return resolveBounds(this.screenBounds, this.lastWidth, this.height) ?? null;
  }

  get focused() {
    return this._focused;
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

  set focused(value: boolean) {
    this._focused = value;
    if (value) {
      this.runInBackground(this.host.focus());
    } else {
      this.runInBackground(this.host.blur());
    }
  }

  /** Resolve once the current load cycle has produced a ready frame. */
  async waitUntilReady() {
    if (this.ready) {
      return;
    }

    await this.readyTracker.waitUntilReady();
  }

  private toReadyError(error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
  }

  private runInBackground(operation: Promise<unknown>) {
    void operation.catch((error) => {
      this.readyTracker.markError(this.toReadyError(error));
    });
  }

  private applyFrame(frame: HostFrame, width: number) {
    const diff = diffHostFrames(this.cachedFrame, frame);
    if (diff.fullRepaint || this.cachedLines.length !== this.height) {
      this.cachedLines = normalizeLines(hostFrameToAnsiLines(frame), width, this.height);
    } else {
      const nextLines = [...this.cachedLines];
      for (const patch of diff.linePatches) {
        nextLines[patch.row] = truncateToWidth(hostLineToAnsi(patch.line), width, "...", true);
      }
      this.cachedLines = normalizeLines(nextLines, width, this.height);
    }

    this.cachedFrame = frame;
    if (diff.fullRepaint || diff.linePatches.length > 0 || diff.cursorChanged) {
      this.requestRender();
    }
  }

  private async runSyncLoop() {
    while (this.pendingWidth !== null) {
      const width = this.pendingWidth;
      this.pendingWidth = null;
      this.lastWidth = width;
      await this.host.resize({ width, height: this.height });
      const frame = await this.host.renderFrame();
      this.applyFrame(frame, width);
    }
  }

  /** Ensure the cached pi-tui lines reflect the current OpenTUI frame at this width. */
  async sync(width = this.lastWidth) {
    const normalizedWidth = Math.max(1, width);
    this.pendingWidth = normalizedWidth;

    if (!this.syncPromise) {
      this.syncPromise = this.runSyncLoop().finally(() => {
        this.syncPromise = null;
      });
    }

    try {
      await this.syncPromise;
      if (this.readyState === "loading") {
        this.readyTracker.markReady();
      }
    } catch (error) {
      this.readyTracker.markError(this.toReadyError(error));
      throw error;
    }
  }

  /** Replace the hosted island and refresh the cached pi-tui output. */
  async setIsland(island: OpenTuiIslandSource) {
    const resolvedIsland = resolveOpenTuiIslandSource(island);
    this.readyTracker.startLoading();
    try {
      if (hasSameIslandTarget(this.currentIsland, resolvedIsland)) {
        await this.updateProps(resolvedIsland.props);
        return;
      }

      await this.host.mount(resolvedIsland);
      this.currentIsland = resolvedIsland;
      this.cachedFrame = undefined;
      await this.sync(this.lastWidth);
    } catch (error) {
      this.readyTracker.markError(this.toReadyError(error));
      throw error;
    }
  }

  /** Update the mounted island props without swapping to a different module export. */
  async updateProps(props?: OpenTuiIslandProps) {
    if (!this.currentIsland) {
      throw new Error("OpenTUI island has not been mounted yet.");
    }

    this.readyTracker.startLoading();
    try {
      await this.host.updateProps(props);
      this.currentIsland = {
        ...this.currentIsland,
        props,
      };
      this.cachedFrame = undefined;
      await this.sync(this.lastWidth);
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
    const handler =
      typeof typeOrHandler === "string"
        ? (event: OpenTuiBridgeEvent) => {
            if (event.type !== typeOrHandler) {
              return;
            }

            maybeHandler?.(event as OpenTuiBridgeEventOfType<TType, TPayload>);
          }
        : typeOrHandler;

    return this.host.onEvent((event) => {
      if (!this.currentIsland) {
        return;
      }

      handler(event);
    });
  }

  async sendCommand(event: OpenTuiBridgeEvent) {
    if (!this.currentIsland) {
      throw new Error("OpenTUI island has not been mounted yet.");
    }

    await this.host.sendCommand(event);
    this.cachedFrame = undefined;
    await this.sync(this.lastWidth);
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
    if (!this.currentIsland) {
      throw new Error("OpenTUI island has not been mounted yet.");
    }

    return this.host.waitForEvent(
      typeOrMatch as TType & ((event: OpenTuiBridgeEvent) => event is TEvent),
      options,
    );
  }

  /** Forward one raw pi-tui input sequence into the hosted OpenTUI island. */
  async sendInput(data: string) {
    if (!this.focused) {
      return;
    }

    await this.host.sendKey({ sequence: data });
    await this.sync(this.lastWidth);
  }

  /** Forward one translated mouse event into the hosted OpenTUI island. */
  async sendMouse(input: HostMouseInput) {
    if (!this.focused) {
      return;
    }

    await this.host.sendMouse(input);
    await this.sync(this.lastWidth);
  }

  private async dispatchMouseEvent(
    event: HostMouseInput & { x: number; y: number },
    focus?: () => void,
  ) {
    const bounds = this.getScreenBounds();
    if (!bounds || !eventInsideBounds(event, bounds)) {
      return false;
    }

    focus?.();
    await this.sendMouse({
      ...event,
      x: event.x - bounds.col,
      y: event.y - bounds.row,
    });
    return true;
  }

  handleTerminalInput(data: string, options?: { focus?: () => void }) {
    const event = parseSgrMouseInput(data);
    if (!event) {
      return undefined;
    }

    void this.dispatchMouseEvent(event, options?.focus);
    if (this.getScreenBounds() && eventInsideBounds(event, this.getScreenBounds()!)) {
      return { consume: true };
    }

    return undefined;
  }

  handleInput(data: string) {
    const mouseEvent = parseSgrMouseInput(data);
    if (mouseEvent) {
      void this.dispatchMouseEvent(mouseEvent);
      return;
    }

    void this.sendInput(data);
  }

  invalidate() {
    this.cachedFrame = undefined;
    this.cachedLines = blankLines(this.lastWidth, this.height);
    this.runInBackground(this.sync(this.lastWidth));
  }

  render(width: number) {
    const normalizedWidth = Math.max(1, width);
    if (normalizedWidth !== this.lastWidth || !this.cachedFrame) {
      this.runInBackground(this.sync(normalizedWidth));
    }

    return normalizeLines(this.cachedLines, normalizedWidth, this.height);
  }

  async destroy() {
    await this.host.destroy();
  }
}

export function enablePiTuiMouseMode(terminal: Pick<Terminal, "write">) {
  terminal.write(ENABLE_SGR_MOUSE_MODE);
}

export function disablePiTuiMouseMode(terminal: Pick<Terminal, "write">) {
  terminal.write(DISABLE_SGR_MOUSE_MODE);
}

export function attachPiTuiMouseSupport(
  tui: Pick<TUI, "addInputListener" | "setFocus" | "terminal">,
  surface: PiTuiOpenTuiSurface,
) {
  enablePiTuiMouseMode(tui.terminal);
  const detach = tui.addInputListener((data) =>
    surface.handleTerminalInput(data, {
      focus: () => {
        tui.setFocus(surface);
      },
    }),
  );

  return () => {
    detach();
    disablePiTuiMouseMode(tui.terminal);
  };
}

/**
 * Create a modal-style pi-tui helper that owns surface focus, optional mouse support,
 * close-on-event waiting, and teardown around one hosted island.
 */
export async function createPiTuiOpenTuiModal<
  TType extends string,
  TPayload extends OpenTuiBridgePayload = OpenTuiBridgePayload,
>(
  options: CreatePiTuiOpenTuiModalOptions,
): Promise<PiTuiOpenTuiModal<OpenTuiBridgeEvent<TType, TPayload>>> {
  const surface = await createPiTuiOpenTuiSurface({
    ...options,
    requestRender: () => options.tui.requestRender(),
    initialWidth: Math.max(1, options.tui.terminal.columns),
  });

  const focus = () => {
    surface.focused = true;
    options.tui.setFocus(surface);
  };

  if (options.focusOnOpen ?? true) {
    focus();
  }

  const detachMouseSupport =
    options.enableMouse === false ? () => {} : attachPiTuiMouseSupport(options.tui, surface);
  let destroyed = false;
  let settled = false;
  let resolveResult!: (event: OpenTuiBridgeEvent<TType, TPayload>) => void;
  let rejectResult!: (error: Error) => void;
  const closeTimeoutMs = options.closeWaitOptions?.timeoutMs ?? 0;
  const closeOn = new Set(options.closeOn);
  const result = new Promise<OpenTuiBridgeEvent<TType, TPayload>>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  const closeTimeout =
    closeTimeoutMs > 0
      ? setTimeout(() => {
          if (settled) {
            return;
          }

          settled = true;
          rejectResult(
            new Error(`OpenTUI sidecar event wait timed out after ${closeTimeoutMs}ms.`),
          );
        }, closeTimeoutMs)
      : null;
  const detachCloseListener = surface.onEvent((event) => {
    if (settled || !closeOn.has(event.type)) {
      return;
    }

    settled = true;
    if (closeTimeout) {
      clearTimeout(closeTimeout);
    }
    resolveResult(event as OpenTuiBridgeEvent<TType, TPayload>);
  });

  const destroy = async () => {
    if (destroyed) {
      return;
    }

    destroyed = true;
    detachCloseListener();
    detachMouseSupport();
    try {
      await surface.destroy();
    } finally {
      if (!settled) {
        settled = true;
        if (closeTimeout) {
          clearTimeout(closeTimeout);
        }
        rejectResult(new Error("OpenTUI sidecar has already been closed."));
      }
    }
  };

  return {
    surface,
    result,
    focus,
    waitForResult: async () => {
      try {
        return await result;
      } finally {
        await destroy();
      }
    },
    sync: () => surface.sync(options.tui.terminal.columns),
    destroy,
  };
}

/** Create a pi-tui component that renders a hosted OpenTUI island. */
export async function createPiTuiOpenTuiSurface(options: CreatePiTuiOpenTuiSurfaceOptions) {
  const initialWidth = Math.max(1, options.initialWidth ?? 1);
  const host =
    options.host ??
    (await createOpenTuiSidecarHost({
      size: {
        width: initialWidth,
        height: options.height,
      },
      kittyKeyboard: options.kittyKeyboard,
      otherModifiersMode: options.otherModifiersMode,
    }));

  const surface = new PiTuiOpenTuiSurface({
    host,
    height: options.height,
    initialWidth,
    requestRender: options.requestRender,
    readyCallbacks: {
      onReady: options.onReady,
      onError: options.onError,
      onReadyStateChange: options.onReadyStateChange,
    },
  });
  try {
    await surface.setIsland(options.island);
    return surface;
  } catch (error) {
    await surface.destroy();
    throw error;
  }
}
