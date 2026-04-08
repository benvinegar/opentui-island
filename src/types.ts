/** One styled terminal text span captured from an embedded OpenTUI surface. */
export interface HostSpan {
  text: string;
  width: number;
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/** One rendered line in the embedded terminal surface. */
export interface HostLine {
  spans: HostSpan[];
}

/** Cursor state reported by the embedded renderer. */
export interface HostCursor {
  x: number;
  y: number;
  visible: boolean;
}

/** One rectangular terminal frame produced by the embedded renderer. */
export interface HostFrame {
  width: number;
  height: number;
  lines: HostLine[];
  cursor?: HostCursor;
}

/** Host-facing key event that can be forwarded into an embedded renderer. */
export interface HostKeyInput {
  sequence: string;
}

export type HostMouseEventType = "down" | "up" | "move" | "drag" | "scroll";
export type HostMouseScrollDirection = "up" | "down" | "left" | "right";
export type HostMouseButton = 0 | 1 | 2 | 64 | 65 | 66 | 67;

/** Host-facing mouse event with coordinates local to the embedded surface. */
export interface HostMouseInput {
  type: HostMouseEventType;
  x: number;
  y: number;
  button?: HostMouseButton;
  direction?: HostMouseScrollDirection;
  shift?: boolean;
  alt?: boolean;
  ctrl?: boolean;
}

/** Initial dimensions for an embedded OpenTUI surface. */
export interface HostSize {
  width: number;
  height: number;
}
