import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import type { CreateOpenTuiHostOptions, OpenTuiHost } from "../core/host.js";
import { resolveOpenTuiIslandSource, type OpenTuiIslandSource } from "../core/island.js";
import type { HostFrame, HostKeyInput, HostMouseInput, HostSize } from "../core/types.js";
import type { OpenTuiSidecarRequest, OpenTuiSidecarResponse } from "./protocol.js";

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

export interface CreateOpenTuiSidecarHostOptions extends CreateOpenTuiHostOptions {
  bunCommand?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  sidecarPath?: string;
}

function describeUnknownError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

class SidecarOpenTuiHost implements OpenTuiHost {
  private readonly pending = new Map<number, PendingRequest<HostFrame | undefined>>();
  private readonly stderrChunks: string[] = [];
  private nextRequestId = 1;
  private closed = false;
  private destroying = false;

  constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    private readonly bunCommand: string,
  ) {
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      this.stderrChunks.push(chunk);
      if (this.stderrChunks.length > 20) {
        this.stderrChunks.shift();
      }
    });

    const reader = createInterface({ input: child.stdout });
    reader.on("line", (line) => {
      this.handleResponseLine(line);
    });

    child.on("error", (error) => {
      this.failAll(
        new Error(
          `Failed to start the OpenTUI sidecar with '${this.bunCommand}'. Install Bun or pass 'bunCommand'. ${describeUnknownError(error)}`,
        ),
      );
    });

    child.on("exit", (code, signal) => {
      if (this.closed && (code === 0 || signal === "SIGTERM")) {
        return;
      }

      const detail = this.stderrChunks.join("").trim();
      const suffix = detail.length > 0 ? `\n${detail}` : "";
      this.failAll(
        new Error(`OpenTUI sidecar exited unexpectedly (code=${code}, signal=${signal}).${suffix}`),
      );
    });
  }

  async initialize(options: CreateOpenTuiHostOptions) {
    await this.request("create", options);
    return this;
  }

  private handleResponseLine(line: string) {
    let response: OpenTuiSidecarResponse;
    try {
      response = JSON.parse(line) as OpenTuiSidecarResponse;
    } catch {
      this.failAll(new Error(`OpenTUI sidecar returned invalid JSON: ${line}`));
      return;
    }

    const pending = this.pending.get(response.id);
    if (!pending) {
      return;
    }

    this.pending.delete(response.id);
    if (response.ok) {
      pending.resolve(response.result);
      return;
    }

    pending.reject(new Error(response.error));
  }

  private failAll(error: Error) {
    if (this.closed) {
      return;
    }

    this.closed = true;
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }

  private request(method: OpenTuiSidecarRequest["method"], params?: unknown) {
    if (this.closed && !this.destroying) {
      return Promise.reject(new Error("OpenTUI sidecar has already been closed."));
    }

    const id = this.nextRequestId++;
    const message = JSON.stringify({ id, method, ...(params ? { params } : {}) });

    return new Promise<HostFrame | undefined>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(`${message}\n`, (error) => {
        if (!error) {
          return;
        }

        this.pending.delete(id);
        reject(error);
      });
    });
  }

  async mount(island: OpenTuiIslandSource) {
    await this.request("mount", { island: resolveOpenTuiIslandSource(island) });
  }

  async resize(size: HostSize) {
    await this.request("resize", size);
  }

  async focus() {
    await this.request("focus");
  }

  async blur() {
    await this.request("blur");
  }

  async sendKey(input: HostKeyInput) {
    await this.request("sendKey", input);
  }

  async sendMouse(input: HostMouseInput) {
    await this.request("sendMouse", input);
  }

  async renderFrame() {
    return (await this.request("renderFrame")) as HostFrame;
  }

  async destroy() {
    if (this.closed || this.destroying) {
      return;
    }

    this.destroying = true;
    try {
      await this.request("destroy");
    } finally {
      this.closed = true;
      this.child.stdin.end();
      if (!this.child.killed) {
        this.child.kill();
      }
      this.pending.clear();
    }
  }
}

/** Spawn a Bun sidecar that renders one OpenTUI island offscreen. */
export async function createOpenTuiSidecarHost(options: CreateOpenTuiSidecarHostOptions) {
  const bunCommand = options.bunCommand ?? process.env.OPENTUI_ISLAND_BUN ?? "bun";
  const sidecarPath = options.sidecarPath ?? fileURLToPath(new URL("./server.js", import.meta.url));
  const child = spawn(bunCommand, [sidecarPath], {
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env,
    },
    stdio: ["pipe", "pipe", "pipe"],
  }) as ChildProcessWithoutNullStreams;
  const host = new SidecarOpenTuiHost(child, bunCommand);
  return host.initialize(options);
}
