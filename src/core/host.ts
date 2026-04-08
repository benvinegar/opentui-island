import type { ReactNode } from "react";
import type { HostFrame, HostKeyInput, HostMouseInput, HostSize } from "./types.js";

/** Framework-specific tree value mounted into the embedded OpenTUI renderer. */
export type HostTree = ReactNode;

/** Common contract for any runtime that can host an OpenTUI subtree offscreen. */
export interface OpenTuiHost {
  mount(tree: HostTree): void;
  resize(size: HostSize): void;
  focus(): void;
  blur(): void;
  sendKey(input: HostKeyInput): Promise<void>;
  sendMouse(input: HostMouseInput): Promise<void>;
  renderFrame(): Promise<HostFrame>;
  destroy(): Promise<void>;
}

/** Factory signature for creating one host instance for a specific runtime adapter. */
export type OpenTuiHostFactory = (size: HostSize) => Promise<OpenTuiHost>;

/** Options for the first offscreen OpenTUI host implementation. */
export interface CreateOffscreenOpenTuiHostOptions {
  size: HostSize;
  kittyKeyboard?: boolean;
  otherModifiersMode?: boolean;
}
