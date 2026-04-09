import { createElement, useEffect, useState } from "react";
import { useKeyboard } from "@opentui/react";
import { useOpenTuiIslandBridge } from "../../dist/index.js";

export default function BridgeBuiltIsland() {
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
      }
    },
    { release: true },
  );

  return createElement(
    "box",
    { style: { width: "100%", height: "100%", paddingLeft: 1 } },
    createElement("text", null, `art:${art}`),
  );
}
