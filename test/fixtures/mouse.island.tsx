/** @jsxImportSource @opentui/react */

import { useState } from "react";

export default function MouseIsland() {
  const [clicks, setClicks] = useState(0);
  const [scrollDirection, setScrollDirection] = useState("none");

  return (
    <box style={{ width: "100%", height: "100%", flexDirection: "column" }}>
      <box style={{ width: "100%", height: 1 }} onMouseDown={() => setClicks((value) => value + 1)}>
        <text>{`clicks:${clicks}`}</text>
      </box>
      <box
        style={{ width: "100%", height: 1 }}
        onMouseScroll={(event) => setScrollDirection(event.scroll?.direction ?? "none")}
      >
        <text>{`scroll:${scrollDirection}`}</text>
      </box>
    </box>
  );
}
