import { createInterface } from "node:readline";

const reader = createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

reader.on("line", (line) => {
  const request = JSON.parse(line);
  if (request.method === "handshake") {
    process.stdout.write(
      `${JSON.stringify({
        id: request.id,
        ok: true,
        result: { protocol: "opentui-island", version: 999 },
      })}\n`,
    );
    return;
  }

  process.stdout.write(`${JSON.stringify({ id: request.id, ok: true })}\n`);
});

process.stdin.resume();
