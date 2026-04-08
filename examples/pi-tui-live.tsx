import { matchesKey, ProcessTerminal, Text, TUI } from "@mariozechner/pi-tui";
import { useKeyboard } from "@opentui/react";
import { useState } from "react";
import {
  attachPiTuiMouseSupport,
  createPiTuiOpenTuiSurface,
} from "../src/adapters/pi-tui/index.js";

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
        <text fg="#d8b4fe">OpenTUI island inside pi-tui</text>
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

const terminal = new ProcessTerminal();
const tui = new TUI(terminal);
const header = new Text("opentui-island pi-tui demo", 1, 0);
const help = new Text(
  "Inside the embedded OpenTUI surface: Up/Down move, A increments, Space toggles, click selects, wheel scroll changes panels. App keys: q or Ctrl-C quits.",
  1,
  0,
);
const footer = new Text(
  "Mouse support is routed through explicit island bounds plus a pi-tui input listener.",
  1,
  0,
);

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
const detachMouseSupport = attachPiTuiMouseSupport(tui, surface);

function syncSurfaceBounds() {
  const width = Math.max(1, terminal.columns);
  surface.setScreenBounds({
    row: header.render(width).length + help.render(width).length,
    col: 0,
    width,
  });
}

process.stdout.on("resize", syncSurfaceBounds);

let shuttingDown = false;
const finish = createDeferredPromise<void>();

async function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  detachMouseSupport();
  process.stdout.off("resize", syncSurfaceBounds);
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
syncSurfaceBounds();

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
