/** @jsxImportSource @opentui/react */

import { useKeyboard } from "@opentui/react";
import { useEffect, useState } from "react";
import { useOpenTuiIslandBridge } from "../../src/index.js";

export default function BridgeIsland() {
  const bridge = useOpenTuiIslandBridge();
  const [text, setText] = useState("initial-text");

  useEffect(() => {
    return bridge.onCommand((event) => {
      if (event.type === "setText" && typeof event.payload === "string") {
        setText(event.payload);
      }
    });
  }, [bridge]);

  useKeyboard(
    (event) => {
      if (event.eventType === "release") {
        return;
      }

      if (event.name === "s") {
        bridge.emit("save", { text });
        return;
      }

      if (event.name === "c") {
        bridge.emit("cancel", null);
      }
    },
    { release: true },
  );

  return (
    <box style={{ width: "100%", height: "100%", paddingLeft: 1 }}>
      <text>{`text:${text}`}</text>
    </box>
  );
}
