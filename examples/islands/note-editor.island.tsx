/** @jsxImportSource @opentui/react */

import { useKeyboard } from "@opentui/react";
import { useIslandBridge } from "../../src/index.js";
import { useState } from "react";

const FALLBACK_TEXT = "Draw a terminal postcard.";
const MAX_VISIBLE_LINES = 5;

const punctuationByKeyName: Record<string, string> = {
  comma: ",",
  minus: "-",
  period: ".",
  slash: "/",
};

type NoteEditorIslandProps = {
  initialText?: string;
};

/** Map OpenTUI key names onto the small set of characters this demo editor accepts. */
function getInsertedText(keyName: string) {
  if (keyName === "space") return " ";
  if (keyName === "return") return "\n";
  if (keyName.length === 1) return keyName;
  return punctuationByKeyName[keyName];
}

export default function NoteEditorIsland({ initialText = FALLBACK_TEXT }: NoteEditorIslandProps) {
  const bridge = useIslandBridge();
  const [text, setText] = useState(initialText);

  useKeyboard(
    (event) => {
      if (event.eventType === "release") {
        return;
      }

      if (event.name === "tab") {
        bridge.emit({
          type: "save",
          payload: { text },
        });
        return;
      }

      if (event.name === "escape") {
        bridge.emit({
          type: "cancel",
          payload: null,
        });
        return;
      }

      if (event.name === "backspace") {
        setText((value) => value.slice(0, -1));
        return;
      }

      const insertedText = getInsertedText(event.name);
      if (!insertedText) {
        return;
      }

      setText((value) => value + insertedText);
    },
    { release: true },
  );

  const visibleLines = text.split("\n").slice(-MAX_VISIBLE_LINES);

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
        <text fg="#f9a8d4">Hosted note editor</text>
      </box>
      <box style={{ width: "100%", height: 1 }}>
        <text fg="#94a3b8">Tab saves. Esc cancels. Enter adds a line.</text>
      </box>
      <box style={{ height: 1 }} />
      {visibleLines.map((line, index) => (
        <box key={`${index}:${line}`} style={{ width: "100%", height: 1 }}>
          <text fg="#e5e7eb">{line.length > 0 ? line : " "}</text>
        </box>
      ))}
      <box style={{ height: 1 }} />
      <box style={{ width: "100%", height: 1 }}>
        <text fg="#7dd3fc">{`${text.length} chars returned to the host on save`}</text>
      </box>
    </box>
  );
}
