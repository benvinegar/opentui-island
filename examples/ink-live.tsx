/** @jsxImportSource react */

import { Box, render, Text, useApp, useInput } from "ink";
import { useKeyboard } from "@opentui/react";
import { createElement, useEffect, useState } from "react";
import { OpenTuiInkSurface } from "../src/adapters/ink/index.js";

const panels = ["Overview", "Input", "Repaint", "Goal"] as const;

function EmbeddedPlayground() {
  const [selected, setSelected] = useState(0);
  const [count, setCount] = useState(0);
  const [lastInput, setLastInput] = useState("none");

  useKeyboard(
    (event) => {
      if (event.eventType === "release") return;

      setLastInput(event.name);

      if (event.name === "up") {
        setSelected((value) => (value === 0 ? panels.length - 1 : value - 1));
        return;
      }

      if (event.name === "down") {
        setSelected((value) => (value + 1) % panels.length);
        return;
      }

      if (event.name === "a") {
        setCount((value) => value + 1);
      }
    },
    { release: true },
  );

  return createElement(
    "box",
    {
      style: {
        width: "100%",
        height: "100%",
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      },
    },
    createElement(
      "box",
      { style: { width: "100%", height: 1 } },
      createElement("text", { fg: "#d8b4fe" }, "OpenTUI island inside Ink"),
    ),
    createElement(
      "box",
      { style: { width: "100%", height: 1 } },
      createElement(
        "text",
        { fg: "#94a3b8" },
        `count ${count} | panel ${selected + 1}/${panels.length} | last input ${lastInput}`,
      ),
    ),
    createElement("box", { style: { height: 1 } }),
    ...panels.map((panel, index) => {
      const active = index === selected;
      return createElement(
        "box",
        { key: panel, style: { width: "100%", height: 1 } },
        createElement(
          "text",
          { fg: active ? "#111827" : "#e5e7eb", bg: active ? "#fbbf24" : undefined },
          `${active ? ">" : " "} ${panel}`,
        ),
      );
    }),
  );
}

function DemoApp() {
  const { exit } = useApp();

  useEffect(() => {
    const autoExitMs = Number.parseInt(process.env.INK_DEMO_AUTO_EXIT_MS ?? "", 10);
    if (Number.isNaN(autoExitMs) || autoExitMs < 0) {
      return;
    }

    const timeout = setTimeout(() => {
      exit();
    }, autoExitMs);

    return () => {
      clearTimeout(timeout);
    };
  }, [exit]);

  useInput((input, key) => {
    if (input === "q" || key.escape) {
      exit();
    }
  });

  return (
    <Box flexDirection="column">
      <Text>opentui-island Ink demo</Text>
      <Text>
        Inside the embedded OpenTUI surface: Up/Down move, A increments. App keys: q or Escape
        quits.
      </Text>
      <OpenTuiInkSurface height={10} tree={<EmbeddedPlayground />} />
    </Box>
  );
}

render(<DemoApp />);
