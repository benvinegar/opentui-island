import type { OpenTuiBridgeEvent } from "../core/bridge.js";
import type { CreateOpenTuiHostOptions } from "../core/host.js";
import type { OpenTuiIslandProps, ResolvedOpenTuiIslandSource } from "../core/island.js";
import type { HostFrame, HostKeyInput, HostMouseInput, HostSize } from "../core/types.js";

export const OPENTUI_SIDECAR_PROTOCOL = "opentui-island";
export const OPENTUI_SIDECAR_PROTOCOL_VERSION = 1;

export interface OpenTuiSidecarHandshake {
  protocol: typeof OPENTUI_SIDECAR_PROTOCOL;
  version: typeof OPENTUI_SIDECAR_PROTOCOL_VERSION;
}

export type OpenTuiSidecarRequest =
  | {
      id: number;
      method: "handshake";
      params: OpenTuiSidecarHandshake;
    }
  | {
      id: number;
      method: "create";
      params: CreateOpenTuiHostOptions;
    }
  | {
      id: number;
      method: "mount";
      params: { island: ResolvedOpenTuiIslandSource };
    }
  | {
      id: number;
      method: "sendCommand";
      params: { command: OpenTuiBridgeEvent };
    }
  | {
      id: number;
      method: "updateProps";
      params: { props?: OpenTuiIslandProps };
    }
  | {
      id: number;
      method: "resize";
      params: HostSize;
    }
  | {
      id: number;
      method: "focus";
    }
  | {
      id: number;
      method: "blur";
    }
  | {
      id: number;
      method: "sendKey";
      params: HostKeyInput;
    }
  | {
      id: number;
      method: "sendMouse";
      params: HostMouseInput;
    }
  | {
      id: number;
      method: "renderFrame";
    }
  | {
      id: number;
      method: "destroy";
    };

export type OpenTuiSidecarResponse =
  | {
      id: number;
      ok: true;
      result?: HostFrame | OpenTuiSidecarHandshake;
    }
  | {
      id: number;
      ok: false;
      error: string;
    };

export interface OpenTuiSidecarEventMessage {
  event: OpenTuiBridgeEvent;
}

export function isOpenTuiSidecarEventMessage(value: unknown): value is OpenTuiSidecarEventMessage {
  return typeof value === "object" && value !== null && "event" in value;
}
