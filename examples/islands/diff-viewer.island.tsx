/** @jsxImportSource @opentui/react */

import { useKeyboard } from "@opentui/react";
import { useMemo, useState } from "react";

type DiffViewerIslandProps = {
  title?: string;
  lines?: string[];
};

const VIEWPORT_ROWS = 10;

function lineStyle(line: string): { fg: string; bg?: string } {
  if (line.startsWith("@@")) return { fg: "#7dd3fc" };
  if (
    line.startsWith("diff --git") ||
    line.startsWith("index ") ||
    line.startsWith("--- ") ||
    line.startsWith("+++ ")
  ) {
    return { fg: "#94a3b8" };
  }
  if (line.startsWith("+")) return { fg: "#bbf7d0", bg: "#052e16" };
  if (line.startsWith("-")) return { fg: "#fecaca", bg: "#450a0a" };
  return { fg: "#e5e7eb" };
}

export default function DiffViewerIsland({
  title = "Diff viewer",
  lines = [],
}: DiffViewerIslandProps) {
  const maxScroll = Math.max(0, lines.length - VIEWPORT_ROWS);
  const [scroll, setScroll] = useState(0);

  useKeyboard(
    (event) => {
      if (event.eventType === "release") return;
      if (event.name === "j" || event.name === "down") {
        setScroll((value) => Math.min(maxScroll, value + 1));
      }
      if (event.name === "k" || event.name === "up") {
        setScroll((value) => Math.max(0, value - 1));
      }
      if (event.name === "pagedown") {
        setScroll((value) => Math.min(maxScroll, value + VIEWPORT_ROWS - 1));
      }
      if (event.name === "pageup") {
        setScroll((value) => Math.max(0, value - (VIEWPORT_ROWS - 1)));
      }
      if (event.name === "g") setScroll(0);
      if (event.name === "G") setScroll(maxScroll);
    },
    { release: true },
  );

  const visibleLines = useMemo(() => lines.slice(scroll, scroll + VIEWPORT_ROWS), [lines, scroll]);
  const rangeEnd = Math.min(lines.length, scroll + VIEWPORT_ROWS);

  return (
    <box
      style={{
        width: "100%",
        height: "100%",
        flexDirection: "column",
        paddingLeft: 1,
      }}
    >
      <text fg="#f8fafc">{title}</text>
      <text fg="#94a3b8">{`showing ${scroll + 1}-${rangeEnd} of ${lines.length}`}</text>
      {visibleLines.map((line, index) => {
        const style = lineStyle(line);
        return (
          <text key={`${scroll + index}:${line}`} fg={style.fg} bg={style.bg}>
            {line}
          </text>
        );
      })}
      <text fg="#94a3b8">j/k or ↑/↓ scroll • PgUp/PgDn page • q closes in Pi</text>
    </box>
  );
}
