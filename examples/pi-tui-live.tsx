import { matchesKey, ProcessTerminal, Text, TUI } from "@mariozechner/pi-tui";
import { useKeyboard } from "@opentui/react";
import { useState } from "react";
import { createPiTuiOpenTuiSurface } from "../src/pi-tui.js";

const panels = [
  {
    title: "Overview",
    body: "This OpenTUI tree is rendered offscreen, converted to ANSI rows, then painted back into a pi-tui component.",
  },
  {
    title: "Input",
    body: "Arrow keys and letter keys are forwarded through the pi-tui host into OpenTUI state updates.",
  },
  {
    title: "Repaint",
    body: "The adapter keeps cached ANSI rows and only updates changed lines when a new captured frame arrives.",
  },
  {
    title: "Goal",
    body: "This is the first step toward embedding richer OpenTUI widgets like diff viewers inside Pi apps.",
  },
] as const;

const demoInputs = {
  a: "a",
  down: "\u001B[B",
  enter: "\r",
  left: "\u001B[D",
  right: "\u001B[C",
  space: " ",
  up: "\u001B[A",
} as const;

function createDeferredPromise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function EmbeddedPlayground() {
  const [selected, setSelected] = useState(0);
  const [count, setCount] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [lastKey, setLastKey] = useState("none");

  useKeyboard(
    (event) => {
      if (event.eventType === "release") {
        return;
      }

      setLastKey(event.name);

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

  return (
    <box style={{ width: "100%", height: "100%", flexDirection: "column", paddingLeft: 1, paddingRight: 1 }}>
      <box style={{ width: "100%", height: 1 }}>
        <text fg="#d8b4fe">OpenTUI island inside pi-tui</text>
      </box>
      <box style={{ width: "100%", height: 1 }}>
        <text fg="#94a3b8">{`count ${count} | panel ${selected + 1}/${panels.length} | last key ${lastKey}`}</text>
      </box>
      <box style={{ height: 1 }} />
      {panels.map((item, index) => {
        const active = index === selected;
        return (
          <box key={item.title} style={{ width: "100%", height: 1 }}>
            <text fg={active ? "#111827" : "#e5e7eb"} bg={active ? "#fbbf24" : undefined}>
              {`${active ? ">" : " "} ${item.title}`}
            </text>
          </box>
        );
      })}
      <box style={{ height: 1 }} />
      <box style={{ width: "100%", flexDirection: "column" }}>
        <text fg="#7dd3fc">{expanded ? panel.body : "Press space to hide/show the panel details."}</text>
      </box>
    </box>
  );
}

const terminal = new ProcessTerminal();
const tui = new TUI(terminal);
const header = new Text("opentui-island pi-tui demo", 1, 0);
const help = new Text("Inside the embedded OpenTUI surface: Up/Down move, A increments, Space toggles. App keys: q or Ctrl-C quits.", 1, 0);
const footer = new Text("Focus is pinned to the embedded OpenTUI surface.", 1, 0);

const surface = await createPiTuiOpenTuiSurface({
  height: Math.max(10, Math.min(14, terminal.rows - 4)),
  initialWidth: Math.max(1, terminal.columns),
  requestRender: () => {
    tui.requestRender();
  },
  tree: <EmbeddedPlayground />,
});

tui.addChild(header);
tui.addChild(help);
tui.addChild(surface);
tui.addChild(footer);
tui.setFocus(surface);

let shuttingDown = false;
const finish = createDeferredPromise<void>();

async function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  await surface.destroy();
  tui.stop();
  finish.resolve();
}

tui.addInputListener((data) => {
  if (matchesKey(data, "q") || matchesKey(data, "ctrl+c")) {
    void shutdown();
    return { consume: true };
  }

  return undefined;
});

tui.start();
await surface.sync(Math.max(1, terminal.columns));

const autoInput = process.env.PI_TUI_DEMO_AUTO_INPUT?.split(",")
  .map((token) => token.trim().toLowerCase())
  .filter(Boolean);

if (autoInput && autoInput.length > 0) {
  for (const token of autoInput) {
    const sequence = demoInputs[token as keyof typeof demoInputs] ?? token;
    await surface.sendInput(sequence);
  }
}

const autoExitMs = Number.parseInt(process.env.PI_TUI_DEMO_AUTO_EXIT_MS ?? "", 10);
if (!Number.isNaN(autoExitMs) && autoExitMs >= 0) {
  setTimeout(() => {
    void shutdown();
  }, autoExitMs);
}

await finish.promise;
