import type { HostMouseButton, HostMouseInput } from "./types.js";

export const ENABLE_SGR_MOUSE_MODE = "\u001B[?1000h\u001B[?1002h\u001B[?1006h";
export const DISABLE_SGR_MOUSE_MODE = "\u001B[?1000l\u001B[?1002l\u001B[?1006l";

const ESCAPE = String.fromCharCode(27);
const SGR_MOUSE_SEQUENCE_PATTERN = new RegExp(`^${ESCAPE}\\[<(\\d+);(\\d+);(\\d+)([Mm])$`);

function parseMouseButton(code: number): HostMouseButton {
  const button = code & 3;
  if (button === 0 || button === 1 || button === 2) {
    return button;
  }

  return 0;
}

export type ParsedTerminalMouseInput = HostMouseInput & {
  x: number;
  y: number;
};

/** Parse one SGR mouse sequence into a zero-based host mouse event. */
export function parseSgrMouseInput(data: string): ParsedTerminalMouseInput | undefined {
  const match = data.match(SGR_MOUSE_SEQUENCE_PATTERN);
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
