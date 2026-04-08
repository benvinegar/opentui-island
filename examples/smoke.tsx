import { createOffscreenOpenTuiHost, hostFrameToAnsiLines } from "../src/index.js";

const host = await createOffscreenOpenTuiHost({
  size: {
    width: 24,
    height: 4,
  },
});

host.mount(
  <box style={{ width: "100%", height: "100%", paddingLeft: 1 }}>
    <text fg="#ff00ff">host ok</text>
  </box>,
);

const frame = await host.renderFrame();
const lines = hostFrameToAnsiLines(frame);

for (const line of lines) {
  console.log(line);
}

await host.destroy();
