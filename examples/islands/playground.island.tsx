/** @jsxImportSource @opentui/react */

import { useKeyboard } from "@opentui/react";
import { useState } from "react";

const panels = [
  {
    title: "Overview",
    body: "This OpenTUI tree is rendered offscreen in Bun, converted to ANSI rows, then painted back into the host runtime.",
  },
  {
    title: "Input",
    body: "Arrow keys and letter keys are forwarded from the host runtime into OpenTUI state updates through the sidecar.",
  },
  {
    title: "Mouse",
    body: "The pi-tui bridge also forwards click and wheel input when the host provides explicit island bounds.",
  },
  {
    title: "Goal",
    body: "This keeps host apps on Node while OpenTUI keeps using Bun behind a small process boundary.",
  },
] as const;

export default function PlaygroundIsland() {
  const [selected, setSelected] = useState(0);
  const [count, setCount] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [lastInput, setLastInput] = useState("none");

  useKeyboard(
    (event) => {
      if (event.eventType === "release") {
        return;
      }

      setLastInput(`key:${event.name}`);

      if (event.name === "up") {
        setSelected((value) => (value === 0 ? panels.length - 1 : value - 1));
        return;
      }

      if (event.name === "down") {
        setSelected((value) => (value + 1) % panels.length);
        return;
      }

      if (event.name === "space" || event.name === "return") {
        setExpanded((value) => !value);
        return;
      }

      if (event.name === "a") {
        setCount((value) => value + 1);
      }
    },
    { release: true },
  );

  const panel = panels[selected];
  const stepSelection = (direction: -1 | 1) => {
    setSelected((value) => (value + direction + panels.length) % panels.length);
  };

  return (
    <box
      style={{
        width: "100%",
        height: "100%",
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <box style={{ width: "100%", height: 1 }}>
        <text fg="#d8b4fe">OpenTUI island inside a host runtime</text>
      </box>
      <box style={{ width: "100%", height: 1 }}>
        <text fg="#94a3b8">{`count ${count} | panel ${selected + 1}/${panels.length} | last input ${lastInput}`}</text>
      </box>
      <box style={{ height: 1 }} />
      {panels.map((item, index) => {
        const active = index === selected;
        return (
          <box
            key={item.title}
            style={{ width: "100%", height: 1 }}
            onMouseDown={() => {
              setSelected(index);
              setCount((value) => value + 1);
              setLastInput(`mouse:click:${item.title.toLowerCase()}`);
            }}
          >
            <text fg={active ? "#111827" : "#e5e7eb"} bg={active ? "#fbbf24" : undefined}>
              {`${active ? ">" : " "} ${item.title}`}
            </text>
          </box>
        );
      })}
      <box style={{ height: 1 }} />
      <box
        style={{ width: "100%", flexDirection: "column" }}
        onMouseScroll={(event) => {
          if (event.scroll?.direction === "up") {
            stepSelection(-1);
            setLastInput("mouse:scroll:up");
          }

          if (event.scroll?.direction === "down") {
            stepSelection(1);
            setLastInput("mouse:scroll:down");
          }
        }}
      >
        <text fg="#7dd3fc">
          {expanded ? panel.body : "Press space to hide/show the panel details."}
        </text>
      </box>
    </box>
  );
}
