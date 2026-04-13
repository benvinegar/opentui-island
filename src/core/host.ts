import type { BridgeEvent, BridgeEventOfType, BridgePayload, BridgeWaitOptions } from "./bridge.js";
import type { IslandProps, IslandSource } from "./island.js";
import type { HostFrame, HostKeyInput, HostMouseInput, HostSize } from "./types.js";

/** Common contract for any runtime bridge that can host an OpenTUI island. */
export interface IslandHost {
  mount(island: IslandSource): Promise<void>;
  updateProps(props?: IslandProps): Promise<void>;
  onEvent(handler: (event: BridgeEvent) => void): () => void;
  onEvent<TType extends string, TPayload extends BridgePayload = BridgePayload>(
    type: TType,
    handler: (event: BridgeEventOfType<TType, TPayload>) => void,
  ): () => void;
  sendCommand(event: BridgeEvent): Promise<void>;
  waitForEvent<TType extends string, TPayload extends BridgePayload = BridgePayload>(
    type: TType,
    options?: BridgeWaitOptions,
  ): Promise<BridgeEventOfType<TType, TPayload>>;
  waitForEvent<TEvent extends BridgeEvent = BridgeEvent>(
    match: (event: BridgeEvent) => event is TEvent,
    options?: BridgeWaitOptions,
  ): Promise<TEvent>;
  resize(size: HostSize): Promise<void>;
  focus(): Promise<void>;
  blur(): Promise<void>;
  sendKey(input: HostKeyInput): Promise<void>;
  sendMouse(input: HostMouseInput): Promise<void>;
  renderFrame(): Promise<HostFrame>;
  destroy(): Promise<void>;
}

/** Factory signature for creating one host instance for a specific runtime adapter. */
export type IslandHostFactory = (options: CreateIslandHostOptions) => Promise<IslandHost>;

/** Shared options for creating one OpenTUI host bridge. */
export interface CreateIslandHostOptions {
  size: HostSize;
  kittyKeyboard?: boolean;
  otherModifiersMode?: boolean;
}

// Backward-compatible aliases for the pre-rename public API.
export type OpenTuiHost = IslandHost;
export type OpenTuiHostFactory = IslandHostFactory;
export type CreateOpenTuiHostOptions = CreateIslandHostOptions;
