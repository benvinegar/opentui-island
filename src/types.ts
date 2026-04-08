/** One styled terminal cell captured from an embedded OpenTUI surface. */
export interface HostCell {
  char: string;
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
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
  rows: HostCell[][];
  cursor?: HostCursor;
}

/** Host-facing key event that can be forwarded into an embedded renderer. */
export interface HostKeyInput {
  sequence: string;
}

/** Host-facing mouse event with coordinates local to the embedded surface. */
export interface HostMouseInput {
  x: number;
  y: number;
  button?: number;
  scrollY?: number;
  shift?: boolean;
  alt?: boolean;
  ctrl?: boolean;
}

/** Initial dimensions for an embedded OpenTUI surface. */
export interface HostSize {
  width: number;
  height: number;
}
