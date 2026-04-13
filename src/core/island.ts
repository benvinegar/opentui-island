import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type IslandValue =
  | null
  | boolean
  | number
  | string
  | IslandValue[]
  | { [key: string]: IslandValue };

/** Serializable props passed into a sidecar-loaded island component. */
export interface IslandProps {
  [key: string]: IslandValue;
}

/** Public description of one OpenTUI island module that Bun can import. */
export interface IslandSource {
  module: string | URL;
  exportName?: string;
  props?: IslandProps;
}

/** Fully resolved island descriptor sent over the sidecar protocol. */
export interface ResolvedIslandSource {
  module: string;
  exportName: string;
  props?: IslandProps;
}

function resolveIslandModule(module: string | URL) {
  if (module instanceof URL) {
    return module.href;
  }

  if (module.startsWith("file:")) {
    return module;
  }

  if (isAbsolute(module) || module.startsWith(".")) {
    return pathToFileURL(resolve(module)).href;
  }

  return module;
}

/** Normalize path-like island descriptors before sending them to the sidecar. */
export function resolveIslandSource(source: IslandSource): ResolvedIslandSource {
  return {
    module: resolveIslandModule(source.module),
    exportName: source.exportName ?? "default",
    props: source.props,
  };
}

// Backward-compatible aliases for the pre-rename public API.
export type OpenTuiIslandValue = IslandValue;
export type OpenTuiIslandProps = IslandProps;
export type OpenTuiIslandSource = IslandSource;
export type ResolvedOpenTuiIslandSource = ResolvedIslandSource;
export const resolveOpenTuiIslandSource = resolveIslandSource;
