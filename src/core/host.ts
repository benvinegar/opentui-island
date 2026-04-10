import type {
  OpenTuiBridgeEvent,
  OpenTuiBridgeEventOfType,
  OpenTuiBridgePayload,
  OpenTuiBridgeWaitOptions,
} from "./bridge.js";
import type { OpenTuiIslandProps, OpenTuiIslandSource } from "./island.js";
import type { HostFrame, HostKeyInput, HostMouseInput, HostSize } from "./types.js";

/** Common contract for any runtime bridge that can host an OpenTUI island. */
export interface OpenTuiHost {
  mount(island: OpenTuiIslandSource): Promise<void>;
  updateProps(props?: OpenTuiIslandProps): Promise<void>;
  onEvent(handler: (event: OpenTuiBridgeEvent) => void): () => void;
  onEventType<TType extends string, TPayload extends OpenTuiBridgePayload = OpenTuiBridgePayload>(
    type: TType,
    handler: (event: OpenTuiBridgeEventOfType<TType, TPayload>) => void,
  ): () => void;
  sendCommand(event: OpenTuiBridgeEvent): Promise<void>;
  waitForEvent<TEvent extends OpenTuiBridgeEvent = OpenTuiBridgeEvent>(
    match: (event: OpenTuiBridgeEvent) => event is TEvent,
    options?: OpenTuiBridgeWaitOptions,
  ): Promise<TEvent>;
  waitForEventType<
    TType extends string,
    TPayload extends OpenTuiBridgePayload = OpenTuiBridgePayload,
  >(
    type: TType,
    options?: OpenTuiBridgeWaitOptions,
  ): Promise<OpenTuiBridgeEventOfType<TType, TPayload>>;
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
