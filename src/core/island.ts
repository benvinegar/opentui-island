import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type OpenTuiIslandValue =
  | null
  | boolean
  | number
  | string
  | OpenTuiIslandValue[]
  | { [key: string]: OpenTuiIslandValue };

/** Serializable props passed into a sidecar-loaded island component. */
export interface OpenTuiIslandProps {
  [key: string]: OpenTuiIslandValue;
}

/** Public description of one OpenTUI island module that Bun can import. */
export interface OpenTuiIslandSource {
  module: string | URL;
  exportName?: string;
  props?: OpenTuiIslandProps;
}

/** Fully resolved island descriptor sent over the sidecar protocol. */
export interface ResolvedOpenTuiIslandSource {
  module: string;
  exportName: string;
  props?: OpenTuiIslandProps;
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
export function resolveOpenTuiIslandSource(
  source: OpenTuiIslandSource,
): ResolvedOpenTuiIslandSource {
  return {
    module: resolveIslandModule(source.module),
    exportName: source.exportName ?? "default",
    props: source.props,
  };
}
