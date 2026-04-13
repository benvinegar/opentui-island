export type {
  HostCursor,
  HostFrame,
  HostKeyInput,
  HostLine,
  HostMouseButton,
  HostMouseInput,
  HostMouseEventType,
  HostMouseScrollDirection,
  HostSize,
  HostSpan,
} from "./core/types.js";

export type { CreateIslandHostOptions, IslandHost, IslandHostFactory } from "./core/host.js";

export type {
  BridgeEvent,
  BridgeEventHandler,
  BridgeEventOfType,
  BridgePayload,
  BridgeWaitOptions,
  IslandBridge,
} from "./core/bridge.js";

export type {
  IslandProps,
  IslandSource,
  IslandValue,
  ResolvedIslandSource,
} from "./core/island.js";

export type { IslandReadyCallbacks, IslandReadySnapshot, IslandReadyState } from "./core/ready.js";

export type { CreateIslandControllerOptions, IslandController } from "./core/controller.js";

export type { CreateSidecarHostOptions } from "./sidecar/client.js";

export type { HostFrameDiff, HostLinePatch } from "./core/frame-diff.js";

export { hostFrameToAnsiLines, hostLineToAnsi, hostSpanToAnsi } from "./core/ansi.js";
export { diffHostFrames } from "./core/frame-diff.js";
export { toBridgeEvent, useIslandBridge } from "./core/bridge.js";
export { createIslandController } from "./core/controller.js";
export { resolveIslandSource } from "./core/island.js";
export { createSidecarHost } from "./sidecar/client.js";

// Backward-compatible aliases for the pre-rename public API.
export type { CreateOpenTuiHostOptions, OpenTuiHost, OpenTuiHostFactory } from "./core/host.js";
export type {
  OpenTuiBridgeEvent,
  OpenTuiBridgeEventHandler,
  OpenTuiBridgeEventOfType,
  OpenTuiBridgePayload,
  OpenTuiBridgeWaitOptions,
  OpenTuiIslandBridge,
} from "./core/bridge.js";
export type {
  OpenTuiIslandProps,
  OpenTuiIslandSource,
  OpenTuiIslandValue,
  ResolvedOpenTuiIslandSource,
} from "./core/island.js";
export type {
  OpenTuiReadyCallbacks,
  OpenTuiReadySnapshot,
  OpenTuiReadyState,
} from "./core/ready.js";
export type {
  CreateOpenTuiIslandControllerOptions,
  OpenTuiIslandController,
} from "./core/controller.js";
export type { CreateOpenTuiSidecarHostOptions } from "./sidecar/client.js";
export { toOpenTuiBridgeEvent, useOpenTuiIslandBridge } from "./core/bridge.js";
export { createOpenTuiIslandController } from "./core/controller.js";
export { resolveOpenTuiIslandSource } from "./core/island.js";
export { createOpenTuiSidecarHost } from "./sidecar/client.js";
