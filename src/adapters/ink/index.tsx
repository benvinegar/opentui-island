/** @jsxImportSource react */

import { Box, Text, useInput, useWindowSize } from "ink";
import type { Key } from "ink";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { hostFrameToAnsiLines } from "../../core/ansi.js";
import type { CreateOffscreenOpenTuiHostOptions, OpenTuiHost } from "../../core/host.js";
import { createOffscreenOpenTuiHost } from "../../core/offscreen-host.js";

export interface InkOpenTuiSurfaceProps extends Omit<CreateOffscreenOpenTuiHostOptions, "size"> {
  tree: ReactNode;
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

/** Render an offscreen OpenTUI subtree inside an Ink layout region. */
export function InkOpenTuiSurface({
  tree,
  width,
  height,
  isActive = true,
  fallback = "Loading OpenTUI island...",
  kittyKeyboard,
  otherModifiersMode,
}: InkOpenTuiSurfaceProps) {
  const windowSize = useWindowSize();
  const resolvedWidth = Math.max(1, width ?? windowSize.columns);
  const hostRef = useRef<OpenTuiHost | null>(null);
  const [lines, setLines] = useState<string[]>(() =>
    normalizeLines([fallback], resolvedWidth, height),
  );

  const sync = async () => {
    if (!hostRef.current) return;

    hostRef.current.resize({ width: resolvedWidth, height });
    const frame = await hostRef.current.renderFrame();
    setLines(normalizeLines(hostFrameToAnsiLines(frame), resolvedWidth, height));
  };

  useEffect(() => {
    let cancelled = false;

    const ensureHost = async () => {
      if (!hostRef.current) {
        hostRef.current = await createOffscreenOpenTuiHost({
          size: { width: resolvedWidth, height },
          kittyKeyboard,
          otherModifiersMode,
        });
      }

      if (cancelled || !hostRef.current) return;

      hostRef.current.mount(tree);
      if (isActive) hostRef.current.focus();
      else hostRef.current.blur();
      await sync();
    };

    void ensureHost();

    return () => {
      cancelled = true;
    };
  }, [tree, resolvedWidth, height, kittyKeyboard, otherModifiersMode, isActive]);

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
      if (!isActive || !hostRef.current) return;

      const sequence = inputToSequence(input, key);
      if (!sequence) return;

      void (async () => {
        await hostRef.current?.sendKey({ sequence });
        await sync();
      })();
    },
    { isActive },
  );

  return (
    <Box flexDirection="column" width={resolvedWidth} minHeight={height}>
      {lines.map((line, index) => (
        <Text key={`line-${index}`}>{line}</Text>
      ))}
    </Box>
  );
}
