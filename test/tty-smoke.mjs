import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const tuistoryBin = fileURLToPath(new URL("../node_modules/.bin/tuistory", import.meta.url));
const shouldRunInkStory = process.env.OPENTUI_TTY_SMOKE_INK !== "0";

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runTuistory(args, options = {}) {
  try {
    const result = await execFileAsync(tuistoryBin, args, {
      cwd: repoRoot,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 30_000,
      ...options,
    });
    return result.stdout.trimEnd();
  } catch (error) {
    const stdout = typeof error.stdout === "string" ? error.stdout.trim() : "";
    const stderr = typeof error.stderr === "string" ? error.stderr.trim() : "";
    const detail = [stdout, stderr].filter(Boolean).join("\n");
    const suffix = detail.length > 0 ? `\n${detail}` : "";
    throw new Error(`tuistory ${args.join(" ")} failed.${suffix}`);
  }
}

async function safeCloseSession(session) {
  await runTuistory(["close", "-s", session]).catch(() => undefined);
}

async function snapshot(session) {
  return runTuistory(["snapshot", "-s", session, "--trim"]);
}

async function launch(session, command) {
  await safeCloseSession(session);
  await runTuistory([
    "launch",
    command,
    "-s",
    session,
    "--cwd",
    repoRoot,
    "--cols",
    "100",
    "--rows",
    "24",
    "--timeout",
    "10000",
  ]);
}

async function waitFor(session, pattern, timeout = 10_000) {
  await runTuistory(["wait", pattern, "-s", session, "--timeout", String(timeout)]);
}

async function typeInto(session, text) {
  await runTuistory(["type", text, "-s", session]);
}

async function clickAt(session, x, y) {
  await runTuistory(["click-at", String(x), String(y), "-s", session]);
}

async function runPiTuiStory() {
  const session = "opentui-island-pi";
  await launch(session, "node ./examples/pi-tui-live.mjs");

  try {
    await waitFor(session, "opentui-island pi-tui demo");
    await typeInto(session, "a");
    await clickAt(session, 2, 8);

    const frame = await snapshot(session);
    assert(frame.includes("opentui-island pi-tui demo"));
    assert(frame.includes("count 2 | panel 3/4 | last input mouse:click:mouse"));
    assert(frame.includes("> Mouse"));
  } finally {
    await safeCloseSession(session);
  }
}

async function runInkStory() {
  const session = "opentui-island-ink";
  await launch(session, "node ./examples/ink-live.mjs");

  try {
    await waitFor(session, "opentui-island Ink demo");
    await runTuistory(["wait-idle", "-s", session, "--timeout", "2000"]);
    await wait(500);
    await typeInto(session, "a");

    const frame = await snapshot(session);
    assert(frame.includes("opentui-island Ink demo"));
    assert(frame.includes("count 1 | panel 1/4 | last input key:a"));
    assert(frame.includes("This OpenTUI tree is rendered offscreen in Bun"));
  } finally {
    await safeCloseSession(session);
  }
}

await runPiTuiStory();
if (shouldRunInkStory) {
  await runInkStory();
}

console.log("tty smoke ok");
