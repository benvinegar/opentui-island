import { createContext, useContext } from "react";
import type { OpenTuiIslandValue } from "./island.js";

export type OpenTuiBridgePayload = OpenTuiIslandValue;

export interface OpenTuiBridgeEvent<
  TType extends string = string,
  TPayload extends OpenTuiBridgePayload = OpenTuiBridgePayload,
> {
  type: TType;
  payload: TPayload;
}

export interface OpenTuiBridgeWaitOptions {
  timeoutMs?: number;
}

export type OpenTuiBridgeEventHandler = (event: OpenTuiBridgeEvent) => void;

export interface OpenTuiIslandBridge {
  emit(event: OpenTuiBridgeEvent): void;
  onCommand(handler: OpenTuiBridgeEventHandler): () => void;
}

const OpenTuiIslandBridgeContext = createContext<OpenTuiIslandBridge | null>(null);

export const OpenTuiIslandBridgeProvider = OpenTuiIslandBridgeContext.Provider;

/** Access the island bridge inside a Bun-rendered OpenTUI island. */
export function useOpenTuiIslandBridge() {
  const bridge = useContext(OpenTuiIslandBridgeContext);
  if (!bridge) {
    throw new Error(
      "useOpenTuiIslandBridge() must be used inside an opentui-island sidecar mount.",
    );
  }

  return bridge;
}
