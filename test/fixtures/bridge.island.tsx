/** @jsxImportSource @opentui/react */

import { useKeyboard } from "@opentui/react";
import { useEffect, useState } from "react";
import { useOpenTuiIslandBridge } from "../../src/index.js";

export default function BridgeIsland() {
  const bridge = useOpenTuiIslandBridge();
  const [art, setArt] = useState("initial-art");

  useEffect(() => {
    return bridge.onCommand((event) => {
      if (event.type === "setArt" && typeof event.payload === "string") {
        setArt(event.payload);
      }
    });
  }, [bridge]);

  useKeyboard(
    (event) => {
      if (event.eventType === "release") {
        return;
      }

      if (event.name === "s") {
        bridge.emit({
          type: "save",
          payload: { art },
        });
        return;
      }

      if (event.name === "c") {
        bridge.emit({
          type: "cancel",
          payload: null,
        });
      }
    },
    { release: true },
  );

  return (
    <box style={{ width: "100%", height: "100%", paddingLeft: 1 }}>
      <text>{`art:${art}`}</text>
    </box>
  );
}
