# API guide

Reference for host adapters, bridge usage, event flow, and the included demo commands.

## Start with the controller

The shared piece is `createOpenTuiIslandController(...)`.

It owns:

- which island is mounted
- current props
- ready state
- bridge events and commands
- frame sync

Use it directly if you want the lowest-level integration:

```ts
import { createOpenTuiIslandController, hostFrameToAnsiLines } from "opentui-island";

const controller = await createOpenTuiIslandController({
  island: {
    module: new URL("./counter.island.tsx", import.meta.url),
  },
  size: { width: 32, height: 3 },
});

await controller.sendKey({ sequence: "a" });
const frame = await controller.syncFrame();

console.log(hostFrameToAnsiLines(frame).join("\n"));
```

## Pick a host binding

`opentui-island` has four host entry points:

- `createPiTuiOpenTuiSurface(...)` for `pi-tui`
- `createPiTuiOpenTuiModal(...)` for modal-style `pi-tui` flows
- `InkOpenTuiSurface` for Ink
- `createOpenTuiSidecarHost(...)` for lower-level Node hosts

All of them run the island in a Bun sidecar and forward host input into that process. The `pi-tui` and Ink bindings can either create their own controller or use one you pass in.

## Ink example

```tsx
/** @jsxImportSource react */

import { render } from "ink";
import { createOpenTuiIslandController } from "opentui-island";
import { InkOpenTuiSurface } from "opentui-island/ink";

const controller = await createOpenTuiIslandController({
  island: {
    module: new URL("./counter.island.tsx", import.meta.url),
    props: { label: "alpha" },
  },
  size: { width: 24, height: 3 },
});

render(
  <InkOpenTuiSurface
    controller={controller}
    height={3}
    width={24}
    island={controller.island!}
    onReady={() => {
      console.log("island ready");
    }}
  />,
);
```

## pi-tui modal flow

```ts
import { createPiTuiOpenTuiModal } from "opentui-island/pi-tui";

const modal = await createPiTuiOpenTuiModal<"save" | "cancel", { text: string } | null>({
  tui,
  height: terminal.rows - 2,
  island: {
    module: new URL("./editor.island.tsx", import.meta.url),
  },
  closeOn: ["save", "cancel"],
});

tui.addChild(modal.surface);
modal.focus();
const result = await modal.waitForResult();

if (result.type === "save") {
  await ctx.ui.pasteToEditor(result.payload.text);
}
```

## Props vs events vs commands

There are three ways to coordinate between the Node host and the Bun-rendered island:

- `props` for declarative state the host owns
- bridge `events` for island-originated notifications or results
- `commands` for imperative host-originated actions

Use `props` when the host owns the value and it should still be true after a remount.

- initial document text
- selected item id
- current title, filters, or view mode
- host-driven updates via `updateProps(...)` or `setIsland(...)`

Use bridge `events` when the island needs to report something back.

- modal `save` or `cancel` results
- export completed
- selection submitted
- validation failed and the host should react

Use `commands` when the host needs the island to do something right now.

- reset local island state
- focus a panel or input
- trigger an export or reload
- ask the island to reveal or scroll to something

Short version:

- If the value should still be true after a remount, make it a prop.
- If the island is reporting an outcome back to the host, emit an event.
- If the host is requesting an action, send a command.
- Prefer props for normal state flow and commands for exceptional or imperative coordination.
- Prefer an event for a command result rather than trying to model request/response through props.

## Using the bridge

Use `useOpenTuiIslandBridge()` inside the island when you need to emit an event back to the host.

Inside the island:

```tsx
import { useOpenTuiIslandBridge } from "opentui-island";

const bridge = useOpenTuiIslandBridge();

bridge.emit("save", { text: exportedText });
```

In a `pi-tui` host:

```ts
const result = await surface.waitForEvent<"save", { text: string }>("save");

await ctx.ui.pasteToEditor(result.payload.text);
```

The low-level host API supports the same pattern through `onEvent(...)`, `waitForEvent(...)`, and `sendCommand(...)`.

## How bridge events behave

- Events are live. If you attach a listener or waiter after the island already emitted something, you will not get that past event.
- `onEvent(...)` and `waitForEvent(...)` are independent. The same event can notify listeners and resolve matching waiters.
- `waitForEvent(...)` only matches future events.
- Pending waits reject when `destroy()` closes the host.
- Events arrive in host receive order.

Host commands behave a little differently:

- Commands sent right after `mount(...)` are buffered until the island registers its first `onCommand(...)` handler.
- That buffering is only for host-to-island commands. Island-to-host events are not queued or replayed.
- For save/cancel-style flows, attach your host listener or waiter before the user can trigger the event.

## Adapter notes

- `createOpenTuiIslandController(...)` is the shared lifecycle API across runtimes.
- In `pi-tui`, calling `surface.setIsland(...)` again with the same module and new props updates the mounted island without a remount.
- `pi-tui` surfaces expose `ready`, `readyState`, `readyError`, and `waitUntilReady()`.
- Ink surfaces expose `onReady`, `onError`, and `onReadyStateChange` callbacks.
- Ink also forwards mouse input in interactive TTY sessions.

## Running the demos

```bash
git clone https://github.com/benvinegar/opentui-island.git
cd opentui-island
bun install

bun run smoke
bun run smoke:pi-tui
bun run smoke:ink

bun run demo:pi-tui
bun run demo:ink
```

- `smoke:pi-tui` and `smoke:ink` run the host app under Node.
- Pi extension examples live in [`../examples/pi/`](../examples/pi/README.md).
