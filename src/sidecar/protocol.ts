import type { CreateOpenTuiHostOptions } from "../core/host.js";
import type { ResolvedOpenTuiIslandSource } from "../core/island.js";
import type { HostFrame, HostKeyInput, HostMouseInput, HostSize } from "../core/types.js";

export type OpenTuiSidecarRequest =
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
      result?: HostFrame;
    }
  | {
      id: number;
      ok: false;
      error: string;
    };
