import type { HostFrame, HostKeyInput, HostMouseInput, HostSize } from "./types";

/** Framework-specific tree value mounted into the embedded OpenTUI renderer. */
export type HostTree = unknown;

/** Common contract for any runtime that can host an OpenTUI subtree offscreen. */
export interface OpenTuiHost {
  mount(tree: HostTree): void;
  resize(size: HostSize): void;
  focus(): void;
  blur(): void;
  sendKey(input: HostKeyInput): void;
  sendMouse(input: HostMouseInput): void;
  renderFrame(): Promise<HostFrame>;
  destroy(): Promise<void>;
}

/** Factory signature for creating one host instance for a specific runtime adapter. */
export type OpenTuiHostFactory = (size: HostSize) => Promise<OpenTuiHost>;
