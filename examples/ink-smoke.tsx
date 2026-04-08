/** @jsxImportSource react */

import { render } from "ink-testing-library";
import { InkOpenTuiSurface } from "../src/adapters/ink/index.js";

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForFrameContains(app: ReturnType<typeof render>, text: string, timeoutMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const frame = app.lastFrame() ?? "";
    if (frame.includes(text)) {
      return frame;
    }

    await wait(20);
  }

  throw new Error(
    `Timed out waiting for frame to contain '${text}'. Last frame:\n${app.lastFrame()}`,
  );
}

const app = render(
  <InkOpenTuiSurface
    island={{ module: new URL("./islands/counter.island.tsx", import.meta.url) }}
    height={2}
    width={24}
  />,
);

try {
  await waitForFrameContains(app, "count:0");

  app.stdin.write("a");
  const frame = await waitForFrameContains(app, "count:1");

  console.log("ink adapter smoke ok");
  console.log(frame);
} finally {
  app.unmount();
  app.cleanup();
}
