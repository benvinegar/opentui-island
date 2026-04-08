import type { OpenTuiIslandSource } from "./island.js";
import type { HostFrame, HostKeyInput, HostMouseInput, HostSize } from "./types.js";

/** Common contract for any runtime bridge that can host an OpenTUI island. */
export interface OpenTuiHost {
  mount(island: OpenTuiIslandSource): Promise<void>;
  resize(size: HostSize): Promise<void>;
  focus(): Promise<void>;
  blur(): Promise<void>;
  sendKey(input: HostKeyInput): Promise<void>;
  sendMouse(input: HostMouseInput): Promise<void>;
  renderFrame(): Promise<HostFrame>;
  destroy(): Promise<void>;
}

/** Factory signature for creating one host instance for a specific runtime adapter. */
export type OpenTuiHostFactory = (options: CreateOpenTuiHostOptions) => Promise<OpenTuiHost>;

/** Shared options for creating one OpenTUI host bridge. */
export interface CreateOpenTuiHostOptions {
  size: HostSize;
  kittyKeyboard?: boolean;
  otherModifiersMode?: boolean;
}
