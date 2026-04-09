import { createInterface } from "node:readline";

const reader = createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

reader.on("line", (line) => {
  const request = JSON.parse(line);
  if (request.method === "create") {
    process.stdout.write(`${JSON.stringify({ id: request.id, ok: true })}\n`);
  }
});

process.stdin.resume();
setInterval(() => {}, 1_000);
