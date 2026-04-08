/** @jsxImportSource react */

import { Box, Text, useInput, useStdin, useWindowSize } from "ink";
import type { Key } from "ink";
import { useEffect, useRef, useState } from "react";
import { hostFrameToAnsiLines } from "../../core/ansi.js";
import type { CreateOpenTuiHostOptions, OpenTuiHost } from "../../core/host.js";
import type { OpenTuiIslandSource } from "../../core/island.js";
import { createOpenTuiSidecarHost } from "../../sidecar/client.js";

export interface InkOpenTuiSurfaceProps extends Omit<CreateOpenTuiHostOptions, "size"> {
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

/** Render an offscreen OpenTUI island inside an Ink layout region. */
export function InkOpenTuiSurface({
  island,
  width,
  height,
  isActive = true,
  fallback = "Loading OpenTUI island...",
  kittyKeyboard,
  otherModifiersMode,
}: InkOpenTuiSurfaceProps) {
  const windowSize = useWindowSize();
  const { isRawModeSupported } = useStdin();
  const resolvedWidth = Math.max(1, width ?? windowSize.columns);
  const inputActive = isActive && isRawModeSupported;
  const hostRef = useRef<OpenTuiHost | null>(null);
  const [lines, setLines] = useState<string[]>(() =>
    normalizeLines([fallback], resolvedWidth, height),
  );

  const sync = async () => {
    if (!hostRef.current) return;

    await hostRef.current.resize({ width: resolvedWidth, height });
    const frame = await hostRef.current.renderFrame();
    setLines(normalizeLines(hostFrameToAnsiLines(frame), resolvedWidth, height));
  };

  useEffect(() => {
    let cancelled = false;

    const ensureHost = async () => {
      if (!hostRef.current) {
        hostRef.current = await createOpenTuiSidecarHost({
          size: { width: resolvedWidth, height },
          kittyKeyboard,
          otherModifiersMode,
        });
      }

      if (cancelled || !hostRef.current) return;

      await hostRef.current.mount(island);
      if (isActive) await hostRef.current.focus();
      else await hostRef.current.blur();
      await sync();
    };

    void ensureHost().catch((error) => {
      if (cancelled) {
        return;
      }

      const message = error instanceof Error ? error.message : "Failed to load OpenTUI island.";
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
