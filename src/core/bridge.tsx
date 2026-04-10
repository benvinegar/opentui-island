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

export type OpenTuiBridgeEventOfType<
  TType extends string,
  TPayload extends OpenTuiBridgePayload = OpenTuiBridgePayload,
> = OpenTuiBridgeEvent<TType, TPayload>;

export interface OpenTuiBridgeWaitOptions {
  timeoutMs?: number;
}

export type OpenTuiBridgeEventHandler = (event: OpenTuiBridgeEvent) => void;

/** Normalize the shorthand `type, payload` form into a full bridge event object. */
export function toOpenTuiBridgeEvent<TType extends string, TPayload extends OpenTuiBridgePayload>(
  typeOrEvent: TType | OpenTuiBridgeEvent<TType, TPayload>,
  payload?: TPayload,
): OpenTuiBridgeEvent<TType, TPayload> {
  if (typeof typeOrEvent === "string") {
    return {
      type: typeOrEvent,
      payload: payload as TPayload,
    };
  }

  return typeOrEvent;
}

export interface OpenTuiIslandBridge {
  emit(event: OpenTuiBridgeEvent): void;
  emit<TType extends string, TPayload extends OpenTuiBridgePayload>(
    type: TType,
    payload: TPayload,
  ): void;
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
