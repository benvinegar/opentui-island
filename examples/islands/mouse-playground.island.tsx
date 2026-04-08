/** @jsxImportSource @opentui/react */

import { useState } from "react";

type ButtonProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

function MouseButton({ label, active, onClick }: ButtonProps) {
  return (
    <box
      style={{
        width: 18,
        height: 3,
        marginRight: 2,
        paddingLeft: 1,
        justifyContent: "center",
        backgroundColor: active ? "#1d4ed8" : "#1f2937",
      }}
      onMouseDown={() => onClick()}
    >
      <text fg="#f8fafc">{label}</text>
    </box>
  );
}

export default function MousePlaygroundIsland() {
  const [selected, setSelected] = useState<"stacked" | "split">("stacked");
  const [clicks, setClicks] = useState(0);
  const [scrollY, setScrollY] = useState(0);

  return (
    <box
      style={{
        width: "100%",
        height: "100%",
        flexDirection: "column",
        paddingLeft: 1,
      }}
      onMouseScroll={(event) => {
        const delta = event.scroll?.direction === "down" ? 1 : -1;
        setScrollY((value) => value + delta);
      }}
    >
      <text fg="#00ff88">Mouse events are reaching OpenTUI</text>
      <text fg="#cbd5e1">Clicked layout: {selected}</text>
      <text fg="#cbd5e1">Button clicks: {clicks}</text>
      <text fg="#cbd5e1">Scroll delta: {scrollY}</text>
      <box style={{ flexDirection: "row", marginTop: 1 }}>
        <MouseButton
          label="stacked"
          active={selected === "stacked"}
          onClick={() => {
            setSelected("stacked");
            setClicks((value) => value + 1);
          }}
        />
        <MouseButton
          label="split"
          active={selected === "split"}
          onClick={() => {
            setSelected("split");
            setClicks((value) => value + 1);
          }}
        />
      </box>
      <text fg="#94a3b8">Click a button or use the mouse wheel inside the island.</text>
    </box>
  );
}
