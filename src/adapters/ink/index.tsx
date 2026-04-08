/** @jsxImportSource react */

import { Box, Text, useInput, useStdin, useWindowSize } from "ink";
import type { Key } from "ink";
import { useEffect, useRef, useState } from "react";
import { hostFrameToAnsiLines } from "../../core/ansi.js";
import type { CreateOpenTuiHostOptions, OpenTuiHost } from "../../core/host.js";
import {
  resolveOpenTuiIslandSource,
  type OpenTuiIslandSource,
  type ResolvedOpenTuiIslandSource,
} from "../../core/island.js";
import { OpenTuiReadyTracker, type OpenTuiReadyCallbacks } from "../../core/ready.js";
import { createOpenTuiSidecarHost } from "../../sidecar/client.js";

function samePropsJson(
  left: ResolvedOpenTuiIslandSource["props"],
  right: ResolvedOpenTuiIslandSource["props"],
) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export interface InkOpenTuiSurfaceProps
  extends Omit<CreateOpenTuiHostOptions, "size">, OpenTuiReadyCallbacks {
  island: OpenTuiIslandSource;
  width?: number;
  height: number;
  isActive?: boolean;
  fallback?: string;
}

function normalizeLines(lines: string[], width: number, height: number) {
  const normalizedWidth = Math.max(1, width);
  const visible = lines.slice(0, height);

  while (visible.length < height) {
    visible.push(" ".repeat(normalizedWidth));
  }

  return visible;
}

function inputToSequence(input: string, key: Key) {
  if (key.upArrow) return "\u001B[A";
  if (key.downArrow) return "\u001B[B";
  if (key.leftArrow) return "\u001B[D";
  if (key.rightArrow) return "\u001B[C";
  if (key.return) return "\r";
  if (key.escape) return "\u001B";
  if (key.tab) return "\t";
  if (key.backspace) return "\u007F";
  if (key.delete) return "\u001B[3~";
  if (key.home) return "\u001B[H";
  if (key.end) return "\u001B[F";
  if (key.pageUp) return "\u001B[5~";
  if (key.pageDown) return "\u001B[6~";
  return input.length > 0 ? input : undefined;
}

function hasSameIslandTarget(
  currentIsland: ResolvedOpenTuiIslandSource | null,
  nextIsland: ResolvedOpenTuiIslandSource,
) {
  return (
    currentIsland?.module === nextIsland.module &&
    currentIsland.exportName === nextIsland.exportName
  );
}

/** Render an offscreen OpenTUI island inside an Ink layout region. */
export function InkOpenTuiSurface({
  island,
  width,
  height,
  isActive = true,
  fallback = "Loading OpenTUI island...",
  onReady,
  onError,
  onReadyStateChange,
  kittyKeyboard,
  otherModifiersMode,
}: InkOpenTuiSurfaceProps) {
  const windowSize = useWindowSize();
  const { isRawModeSupported } = useStdin();
  const resolvedWidth = Math.max(1, width ?? windowSize.columns);
  const inputActive = isActive && isRawModeSupported;
  const hostRef = useRef<OpenTuiHost | null>(null);
  const mountedIslandRef = useRef<ResolvedOpenTuiIslandSource | null>(null);
  const readyTrackerRef = useRef(new OpenTuiReadyTracker());
  const [lines, setLines] = useState<string[]>(() =>
    normalizeLines([fallback], resolvedWidth, height),
  );
  readyTrackerRef.current.updateCallbacks({ onReady, onError, onReadyStateChange });

  const toReadyError = (error: unknown) =>
    error instanceof Error ? error : new Error(String(error));

  const sync = async () => {
    if (!hostRef.current) return;

    try {
      await hostRef.current.resize({ width: resolvedWidth, height });
      const frame = await hostRef.current.renderFrame();
      setLines(normalizeLines(hostFrameToAnsiLines(frame), resolvedWidth, height));
      if (readyTrackerRef.current.getSnapshot().state === "loading") {
        readyTrackerRef.current.markReady();
      }
    } catch (error) {
      readyTrackerRef.current.markError(toReadyError(error));
      throw error;
    }
  };

  useEffect(() => {
    let cancelled = false;
    const resolvedIsland = resolveOpenTuiIslandSource(island);

    const ensureHost = async () => {
      const previousIsland = mountedIslandRef.current;
      const sameTarget = hasSameIslandTarget(previousIsland, resolvedIsland);
      const shouldUpdateProps =
        sameTarget && !samePropsJson(previousIsland?.props, resolvedIsland.props);
      const shouldMount = !sameTarget;

      if (!previousIsland || shouldMount || shouldUpdateProps) {
        readyTrackerRef.current.startLoading();
      }

      if (!hostRef.current) {
        hostRef.current = await createOpenTuiSidecarHost({
          size: { width: resolvedWidth, height },
          kittyKeyboard,
          otherModifiersMode,
        });
      }

      if (cancelled || !hostRef.current) return;

      if (shouldUpdateProps) {
        await hostRef.current.updateProps(resolvedIsland.props);
      } else if (shouldMount) {
        await hostRef.current.mount(resolvedIsland);
      }

      mountedIslandRef.current = resolvedIsland;
      if (isActive) await hostRef.current.focus();
      else await hostRef.current.blur();
      await sync();
    };

    void ensureHost().catch((error) => {
      if (cancelled) {
        return;
      }

      const readyError = toReadyError(error);
      readyTrackerRef.current.markError(readyError);
      const message = readyError.message || "Failed to load OpenTUI island.";
      setLines(normalizeLines([message], resolvedWidth, height));
    });

    return () => {
      cancelled = true;
    };
  }, [island, resolvedWidth, height, kittyKeyboard, otherModifiersMode, isActive]);

  useEffect(() => {
    return () => {
      const host = hostRef.current;
      hostRef.current = null;
      mountedIslandRef.current = null;
      if (host) {
        void host.destroy();
      }
    };
  }, []);

  useInput(
    (input, key) => {
      if (!inputActive || !hostRef.current) return;

      const sequence = inputToSequence(input, key);
      if (!sequence) return;

      void (async () => {
        await hostRef.current?.sendKey({ sequence });
        await sync();
      })();
    },
    { isActive: inputActive },
  );

  return (
    <Box flexDirection="column" width={resolvedWidth} minHeight={height}>
      {lines.map((line, index) => (
        <Text key={`line-${index}`}>{line}</Text>
      ))}
    </Box>
  );
}
