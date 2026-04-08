/** @jsxImportSource @opentui/react */

import { useKeyboard } from "@opentui/react";
import { useState } from "react";

interface UpdatableCounterIslandProps {
  label?: string;
}

export default function UpdatableCounterIsland({ label = "default" }: UpdatableCounterIslandProps) {
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
      <text>{`label:${label} count:${count}`}</text>
    </box>
  );
}
