import type { HostCursor, HostFrame, HostLine, HostSpan } from "./types.js";

/** One changed row that the host should repaint. */
export interface HostLinePatch {
  row: number;
  line: HostLine;
}

/** Diff result for repainting one embedded OpenTUI surface efficiently. */
export interface HostFrameDiff {
  fullRepaint: boolean;
  width: number;
  height: number;
  linePatches: HostLinePatch[];
  cursor?: HostCursor;
  cursorChanged: boolean;
}

function spansEqual(left: HostSpan, right: HostSpan) {
  return (
    left.text === right.text &&
    left.width === right.width &&
    left.fg === right.fg &&
    left.bg === right.bg &&
    left.bold === right.bold &&
    left.italic === right.italic &&
    left.underline === right.underline
  );
}

function linesEqual(left: HostLine | undefined, right: HostLine | undefined) {
  if (!left || !right) {
    return false;
  }

  if (left.spans.length !== right.spans.length) {
    return false;
  }

  for (let index = 0; index < left.spans.length; index += 1) {
    const leftSpan = left.spans[index];
    const rightSpan = right.spans[index];
    if (!leftSpan || !rightSpan || !spansEqual(leftSpan, rightSpan)) {
      return false;
    }
  }

  return true;
}

function cursorsEqual(left: HostCursor | undefined, right: HostCursor | undefined) {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.x === right.x && left.y === right.y && left.visible === right.visible;
}

/** Compare two captured frames and return only the rows that need repainting. */
export function diffHostFrames(
  previous: HostFrame | null | undefined,
  next: HostFrame,
): HostFrameDiff {
  const fullRepaint =
    !previous ||
    previous.width !== next.width ||
    previous.height !== next.height ||
    previous.lines.length !== next.lines.length;

  if (fullRepaint) {
    return {
      fullRepaint: true,
      width: next.width,
      height: next.height,
      linePatches: next.lines.map((line, row) => ({ row, line })),
      cursor: next.cursor,
      cursorChanged: !cursorsEqual(previous?.cursor, next.cursor),
    };
  }

  const linePatches: HostLinePatch[] = [];
  for (let row = 0; row < next.lines.length; row += 1) {
    const previousLine = previous.lines[row];
    const nextLine = next.lines[row];
    if (!linesEqual(previousLine, nextLine) && nextLine) {
      linePatches.push({ row, line: nextLine });
    }
  }

  return {
    fullRepaint: false,
    width: next.width,
    height: next.height,
    linePatches,
    cursor: next.cursor,
    cursorChanged: !cursorsEqual(previous.cursor, next.cursor),
  };
}
