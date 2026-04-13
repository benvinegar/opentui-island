import { matchesKey, ProcessTerminal, Text, TUI } from "@mariozechner/pi-tui";
import { attachPiTuiMouseSupport, createPiTuiSurface } from "../dist/adapters/pi-tui/index.js";

const demoInputs = {
  a: "a",
  down: "\u001B[B",
  enter: "\r",
  left: "\u001B[D",
  right: "\u001B[C",
  space: " ",
  up: "\u001B[A",
};

function createDeferredPromise() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

const terminal = new ProcessTerminal();
const tui = new TUI(terminal);
const header = new Text("opentui-island pi-tui demo", 1, 0);
const help = new Text(
  "Inside the embedded OpenTUI island: Up/Down move, A increments, Space toggles, click selects, wheel scroll changes panels. App keys: q or Ctrl-C quit.",
  1,
  0,
);
const footer = new Text(
  "The pi-tui app is running under Node while the embedded island renders inside a Bun sidecar.",
  1,
  0,
);

const surface = await createPiTuiSurface({
  height: Math.max(10, Math.min(14, terminal.rows - 4)),
  initialWidth: Math.max(1, terminal.columns),
  requestRender: () => {
    tui.requestRender();
  },
  island: { module: new URL("./islands/playground.island.tsx", import.meta.url) },
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
const finish = createDeferredPromise();

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
    const sequence = demoInputs[token] ?? token;
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
