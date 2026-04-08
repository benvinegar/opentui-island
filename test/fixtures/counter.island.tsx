/** @jsxImportSource @opentui/react */

import { useKeyboard } from "@opentui/react";
import { useState } from "react";

export default function CounterIsland() {
  const [count, setCount] = useState(0);

  useKeyboard(
    (event) => {
      if (event.eventType !== "release" && event.name === "a") {
        setCount((value) => value + 1);
      }
    },
    { release: true },
  );

  return (
    <box style={{ width: "100%", height: "100%", paddingLeft: 1 }}>
      <text fg="#00ff88">{`count:${count}`}</text>
    </box>
  );
}
