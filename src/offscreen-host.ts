import {
  TextAttributes,
  getBaseAttributes,
  type CapturedFrame,
  type CapturedSpan,
} from "@opentui/core";
import { createTestRenderer } from "@opentui/core/testing";
import { createRoot, flushSync, type Root } from "@opentui/react";
import { Readable, Writable } from "node:stream";
import type { CreateOffscreenOpenTuiHostOptions, OpenTuiHost } from "./host.js";
import type { HostCursor, HostFrame, HostLine, HostMouseInput, HostSpan } from "./types.js";

class NullWriteStream extends Writable {
  columns: number;
  rows: number;
  isTTY = true;

  constructor(width: number, height: number) {
    super();
    this.columns = width;
    this.rows = height;
  }

  override _write(
    _chunk: unknown,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    callback();
  }
}

class NullReadStream extends Readable {
  isTTY = true;

  override _read() {}

  setRawMode(_enabled: boolean) {
    return this;
  }
}

function cursorFromRenderer(renderer: {
  getCursorState: () => { x: number; y: number; visible: boolean };
}): HostCursor {
  const cursor = renderer.getCursorState();
  return {
    x: cursor.x,
    y: cursor.y,
    visible: cursor.visible,
  };
}

function colorFromCaptured(color: CapturedSpan["fg"] | CapturedSpan["bg"]) {
  const [r, g, b, a] = color.toInts();
  if (a === 0) {
    return undefined;
  }

  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function spanFromCaptured(span: CapturedSpan): HostSpan {
  const attributes = getBaseAttributes(span.attributes);

  return {
    text: span.text,
    width: span.width,
    fg: colorFromCaptured(span.fg),
    bg: colorFromCaptured(span.bg),
    bold: (attributes & TextAttributes.BOLD) !== 0,
    italic: (attributes & TextAttributes.ITALIC) !== 0,
    underline: (attributes & TextAttributes.UNDERLINE) !== 0,
  };
}

function lineFromCaptured(line: CapturedFrame["lines"][number]): HostLine {
  return {
    spans: line.spans.map(spanFromCaptured),
  };
}

function frameFromCaptured(
  frame: CapturedFrame,
  renderer: { getCursorState: () => { x: number; y: number; visible: boolean } },
): HostFrame {
  return {
    width: frame.cols,
    height: frame.rows,
    lines: frame.lines.map(lineFromCaptured),
    cursor: cursorFromRenderer(renderer),
  };
}

function mouseModifiers(input: HostMouseInput) {
  return {
    shift: input.shift,
    alt: input.alt,
    ctrl: input.ctrl,
  };
}

/** Create an offscreen OpenTUI host backed by the built-in test renderer. */
export async function createOffscreenOpenTuiHost(
  options: CreateOffscreenOpenTuiHostOptions,
): Promise<OpenTuiHost> {
  const stdout = new NullWriteStream(options.size.width, options.size.height);
  const stdin = new NullReadStream();
  const rendererSetup = await createTestRenderer({
    width: options.size.width,
    height: options.size.height,
    stdin: stdin as unknown as NodeJS.ReadStream,
    stdout: stdout as unknown as NodeJS.WriteStream,
    kittyKeyboard: options.kittyKeyboard,
    otherModifiersMode: options.otherModifiersMode,
  });
  const root: Root = createRoot(rendererSetup.renderer);
  let destroyed = false;
  let focused = true;

  const ensureActive = () => {
    if (destroyed) {
      throw new Error("OpenTUI host has already been destroyed.");
    }
  };

  return {
    mount(tree) {
      ensureActive();
      flushSync(() => {
        root.render(tree);
      });
    },
    resize(size) {
      ensureActive();
      stdout.columns = size.width;
      stdout.rows = size.height;
      rendererSetup.resize(size.width, size.height);
    },
    focus() {
      ensureActive();
      focused = true;
    },
    blur() {
      ensureActive();
      focused = false;
    },
    async sendKey(input) {
      ensureActive();
      if (!focused) {
        return;
      }

      rendererSetup.renderer.stdin.emit("data", Buffer.from(input.sequence));
    },
    async sendMouse(input) {
      ensureActive();
      if (!focused) {
        return;
      }

      if (input.type === "scroll") {
        await rendererSetup.mockMouse.scroll(input.x, input.y, input.direction ?? "down", {
          modifiers: mouseModifiers(input),
        });
        return;
      }

      await rendererSetup.mockMouse.emitMouseEvent(input.type, input.x, input.y, input.button, {
        modifiers: mouseModifiers(input),
      });
    },
    async renderFrame() {
      ensureActive();
      await rendererSetup.renderOnce();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await rendererSetup.renderOnce();
      return frameFromCaptured(rendererSetup.captureSpans(), rendererSetup.renderer);
    },
    async destroy() {
      if (destroyed) {
        return;
      }

      destroyed = true;
      flushSync(() => {
        root.unmount();
      });
      rendererSetup.renderer.destroy();
    },
  };
}
