import type { HostFrame, HostLine, HostSpan } from "./types.js";

const ANSI_RESET = "\u001B[0m";

function hexToRgb(hex: string) {
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  if (normalized.length !== 6 && normalized.length !== 8) {
    throw new Error(`Expected a 6-digit hex color, got ${hex}.`);
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function styleCodes(span: HostSpan) {
  const codes: string[] = [];

  if (span.bold) {
    codes.push("1");
  }

  if (span.italic) {
    codes.push("3");
  }

  if (span.underline) {
    codes.push("4");
  }

  if (span.fg) {
    const { r, g, b } = hexToRgb(span.fg);
    codes.push(`38;2;${r};${g};${b}`);
  }

  if (span.bg) {
    const { r, g, b } = hexToRgb(span.bg);
    codes.push(`48;2;${r};${g};${b}`);
  }

  return codes;
}

/** Render one captured host span as ANSI text. */
export function hostSpanToAnsi(span: HostSpan) {
  const codes = styleCodes(span);
  if (codes.length === 0) {
    return span.text;
  }

  return `\u001B[${codes.join(";")}m${span.text}${ANSI_RESET}`;
}

/** Render one captured host line as a single ANSI string. */
export function hostLineToAnsi(line: HostLine) {
  return line.spans.map(hostSpanToAnsi).join("");
}

/** Render a captured host frame into ANSI rows for foreign TUI toolkits. */
export function hostFrameToAnsiLines(frame: HostFrame) {
  return frame.lines.map(hostLineToAnsi);
}
