import { truncateToWidth, type Component, type Focusable } from "@mariozechner/pi-tui";
import type { ReactNode } from "react";
import { hostFrameToAnsiLines, hostLineToAnsi } from "./ansi.js";
import { diffHostFrames } from "./frame-diff.js";
import type { CreateOffscreenOpenTuiHostOptions, OpenTuiHost } from "./host.js";
import { createOffscreenOpenTuiHost } from "./offscreen-host.js";
import type { HostFrame } from "./types.js";

export interface CreatePiTuiOpenTuiSurfaceOptions extends Omit<
  CreateOffscreenOpenTuiHostOptions,
  "size"
> {
  height: number;
  tree: ReactNode;
  requestRender?: () => void;
  initialWidth?: number;
  host?: OpenTuiHost;
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

/** A fixed-height pi-tui component that hosts one OpenTUI subtree. */
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

  constructor(params: {
    host: OpenTuiHost;
    height: number;
    initialWidth: number;
    tree: ReactNode;
    requestRender?: () => void;
  }) {
    this.host = params.host;
    this.height = params.height;
    this.lastWidth = Math.max(1, params.initialWidth);
    this.cachedLines = blankLines(this.lastWidth, this.height);
    this.requestRender = params.requestRender ?? (() => {});

    this.host.mount(params.tree);
    this.host.blur();
  }

  get focused() {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
    if (value) {
      this.host.focus();
    } else {
      this.host.blur();
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
      this.host.resize({ width, height: this.height });
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

  /** Replace the hosted OpenTUI tree and refresh the cached pi-tui output. */
  async setTree(tree: ReactNode) {
    this.host.mount(tree);
    this.cachedFrame = undefined;
    await this.sync(this.lastWidth);
  }

  /** Forward one raw pi-tui input sequence into the hosted OpenTUI subtree. */
  async sendInput(data: string) {
    if (!this.focused) {
      return;
    }

    await this.host.sendKey({ sequence: data });
    await this.sync(this.lastWidth);
  }

  handleInput(data: string) {
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

/** Create a pi-tui component that renders a hosted OpenTUI island. */
export async function createPiTuiOpenTuiSurface(options: CreatePiTuiOpenTuiSurfaceOptions) {
  const initialWidth = Math.max(1, options.initialWidth ?? 1);
  const host =
    options.host ??
    (await createOffscreenOpenTuiHost({
      size: {
        width: initialWidth,
        height: options.height,
      },
      kittyKeyboard: options.kittyKeyboard,
      otherModifiersMode: options.otherModifiersMode,
    }));

  return new PiTuiOpenTuiSurface({
    host,
    height: options.height,
    initialWidth,
    tree: options.tree,
    requestRender: options.requestRender,
  });
}
