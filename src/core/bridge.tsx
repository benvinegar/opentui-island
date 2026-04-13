import { createContext, useContext } from "react";
import type { IslandValue } from "./island.js";

export type BridgePayload = IslandValue;

export interface BridgeEvent<
  TType extends string = string,
  TPayload extends BridgePayload = BridgePayload,
> {
  type: TType;
  payload: TPayload;
}

export type BridgeEventOfType<
  TType extends string,
  TPayload extends BridgePayload = BridgePayload,
> = BridgeEvent<TType, TPayload>;

export interface BridgeWaitOptions {
  timeoutMs?: number;
}

export type BridgeEventHandler = (event: BridgeEvent) => void;

/** Normalize the shorthand `type, payload` form into a full bridge event object. */
export function toBridgeEvent<TType extends string, TPayload extends BridgePayload>(
  typeOrEvent: TType | BridgeEvent<TType, TPayload>,
  payload?: TPayload,
): BridgeEvent<TType, TPayload> {
  if (typeof typeOrEvent === "string") {
    return {
      type: typeOrEvent,
      payload: payload as TPayload,
    };
  }

  return typeOrEvent;
}

export interface IslandBridge {
  emit(event: BridgeEvent): void;
  emit<TType extends string, TPayload extends BridgePayload>(type: TType, payload: TPayload): void;
  onCommand(handler: BridgeEventHandler): () => void;
}

const IslandBridgeContext = createContext<IslandBridge | null>(null);

export const IslandBridgeProvider = IslandBridgeContext.Provider;

/** Access the island bridge inside a Bun-rendered OpenTUI island. */
export function useIslandBridge() {
  const bridge = useContext(IslandBridgeContext);
  if (!bridge) {
    throw new Error("useIslandBridge() must be used inside an opentui-island sidecar mount.");
  }

  return bridge;
}

// Backward-compatible aliases for the pre-rename public API.
export type OpenTuiBridgePayload = BridgePayload;
export type OpenTuiBridgeEvent<
  TType extends string = string,
  TPayload extends BridgePayload = BridgePayload,
> = BridgeEvent<TType, TPayload>;
export type OpenTuiBridgeEventOfType<
  TType extends string,
  TPayload extends BridgePayload = BridgePayload,
> = BridgeEventOfType<TType, TPayload>;
export type OpenTuiBridgeWaitOptions = BridgeWaitOptions;
export type OpenTuiBridgeEventHandler = BridgeEventHandler;
export type OpenTuiIslandBridge = IslandBridge;
export const OpenTuiIslandBridgeProvider = IslandBridgeProvider;
export const toOpenTuiBridgeEvent = toBridgeEvent;
export const useOpenTuiIslandBridge = useIslandBridge;
