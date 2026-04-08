import {
  TUI,
  truncateToWidth,
  type Component,
  type Focusable,
  type Terminal,
} from "@mariozechner/pi-tui";
import { hostFrameToAnsiLines, hostLineToAnsi } from "../../core/ansi.js";
import { diffHostFrames } from "../../core/frame-diff.js";
import type { CreateOpenTuiHostOptions, OpenTuiHost } from "../../core/host.js";
import {
  resolveOpenTuiIslandSource,
  type OpenTuiIslandProps,
  type OpenTuiIslandSource,
  type ResolvedOpenTuiIslandSource,
} from "../../core/island.js";
import { createOpenTuiSidecarHost } from "../../sidecar/client.js";
import type { HostFrame, HostMouseButton, HostMouseInput } from "../../core/types.js";

export interface CreatePiTuiOpenTuiSurfaceOptions extends Omit<CreateOpenTuiHostOptions, "size"> {
  height: number;
  island: OpenTuiIslandSource;
  requestRender?: () => void;
  initialWidth?: number;
  host?: OpenTuiHost;
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

const ENABLE_PI_TUI_MOUSE_MODE = "\u001B[?1000h\u001B[?1002h\u001B[?1006h";
const DISABLE_PI_TUI_MOUSE_MODE = "\u001B[?1000l\u001B[?1002l\u001B[?1006l";
const ESCAPE = String.fromCharCode(27);
const PI_TUI_MOUSE_SEQUENCE_PATTERN = new RegExp(`^${ESCAPE}\\[<(\\d+);(\\d+);(\\d+)([Mm])$`);

function parseMouseButton(code: number): HostMouseButton {
  const button = code & 3;
  if (button === 0 || button === 1 || button === 2) {
    return button;
  }

  return 0;
}

function parsePiTuiMouseInput(
  data: string,
): (HostMouseInput & { x: number; y: number }) | undefined {
  const match = data.match(PI_TUI_MOUSE_SEQUENCE_PATTERN);
  if (!match) {
    return undefined;
  }

  const code = Number.parseInt(match[1], 10);
  const x = Number.parseInt(match[2], 10) - 1;
  const y = Number.parseInt(match[3], 10) - 1;
  const suffix = match[4];
  const shift = (code & 4) !== 0;
  const alt = (code & 8) !== 0;
  const ctrl = (code & 16) !== 0;
  const motion = (code & 32) !== 0;

  if ((code & 64) !== 0) {
    const directionCode = code & 3;
    const direction =
      directionCode === 0
        ? "up"
        : directionCode === 1
          ? "down"
          : directionCode === 2
            ? "left"
            : "right";
    return {
      type: "scroll",
      x,
      y,
      button: (64 + directionCode) as HostMouseButton,
      direction,
      shift,
      alt,
      ctrl,
    };
  }

  if (motion) {
    return {
      type: (code & 3) === 3 ? "move" : "drag",
      x,
      y,
      button: parseMouseButton(code),
      shift,
      alt,
      ctrl,
    };
  }

  return {
    type: suffix === "M" ? "down" : "up",
    x,
    y,
    button: parseMouseButton(code),
    shift,
    alt,
    ctrl,
  };
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
  private screenBounds: PiTuiScreenBounds | null = null;

  constructor(params: {
    host: OpenTuiHost;
    height: number;
    initialWidth: number;
    requestRender?: () => void;
  }) {
    this.host = params.host;
    this.height = params.height;
    this.lastWidth = Math.max(1, params.initialWidth);
    this.cachedLines = blankLines(this.lastWidth, this.height);
    this.requestRender = params.requestRender ?? (() => {});
    void this.host.blur();
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

  set focused(value: boolean) {
    this._focused = value;
    if (value) {
      void this.host.focus();
    } else {
      void this.host.blur();
    }
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

    await this.syncPromise;
  }

  /** Replace the hosted island and refresh the cached pi-tui output. */
  async setIsland(island: OpenTuiIslandSource) {
    const resolvedIsland = resolveOpenTuiIslandSource(island);
    if (hasSameIslandTarget(this.currentIsland, resolvedIsland)) {
      await this.updateProps(resolvedIsland.props);
      return;
    }

    await this.host.mount(resolvedIsland);
    this.currentIsland = resolvedIsland;
    this.cachedFrame = undefined;
    await this.sync(this.lastWidth);
  }

  /** Update the mounted island props without swapping to a different module export. */
  async updateProps(props?: OpenTuiIslandProps) {
    if (!this.currentIsland) {
      throw new Error("OpenTUI island has not been mounted yet.");
    }

    await this.host.updateProps(props);
    this.currentIsland = {
      ...this.currentIsland,
      props,
    };
    this.cachedFrame = undefined;
    await this.sync(this.lastWidth);
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
    const event = parsePiTuiMouseInput(data);
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
    const mouseEvent = parsePiTuiMouseInput(data);
    if (mouseEvent) {
      void this.dispatchMouseEvent(mouseEvent);
      return;
    }

    void this.sendInput(data);
  }

  invalidate() {
    this.cachedFrame = undefined;
    this.cachedLines = blankLines(this.lastWidth, this.height);
    void this.sync(this.lastWidth);
  }

  render(width: number) {
    const normalizedWidth = Math.max(1, width);
    if (normalizedWidth !== this.lastWidth || !this.cachedFrame) {
      void this.sync(normalizedWidth);
    }

    return normalizeLines(this.cachedLines, normalizedWidth, this.height);
  }

  async destroy() {
    await this.host.destroy();
  }
}

export function enablePiTuiMouseMode(terminal: Pick<Terminal, "write">) {
  terminal.write(ENABLE_PI_TUI_MOUSE_MODE);
}

export function disablePiTuiMouseMode(terminal: Pick<Terminal, "write">) {
  terminal.write(DISABLE_PI_TUI_MOUSE_MODE);
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
  });
  await surface.setIsland(options.island);
  return surface;
}
