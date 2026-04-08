import { createOpenTuiSidecarHost, hostFrameToAnsiLines } from "../dist/index.js";

const host = await createOpenTuiSidecarHost({
  size: {
    width: 24,
    height: 4,
  },
});

try {
  await host.mount({ module: new URL("./islands/counter.island.tsx", import.meta.url) });

  const frame = await host.renderFrame();
  const lines = hostFrameToAnsiLines(frame);

  for (const line of lines) {
    console.log(line);
  }
} finally {
  await host.destroy();
}
