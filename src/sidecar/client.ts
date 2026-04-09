import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import type { CreateOpenTuiHostOptions, OpenTuiHost } from "../core/host.js";
import {
  resolveOpenTuiIslandSource,
  type OpenTuiIslandProps,
  type OpenTuiIslandSource,
} from "../core/island.js";
import type { HostFrame, HostKeyInput, HostMouseInput, HostSize } from "../core/types.js";
import {
  OPENTUI_SIDECAR_PROTOCOL,
  OPENTUI_SIDECAR_PROTOCOL_VERSION,
  type OpenTuiSidecarHandshake,
  type OpenTuiSidecarRequest,
  type OpenTuiSidecarResponse,
} from "./protocol.js";

interface PendingRequest {
  method: OpenTuiSidecarRequest["method"];
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeout: ReturnType<typeof setTimeout> | null;
}

export interface CreateOpenTuiSidecarHostOptions extends CreateOpenTuiHostOptions {
  bunCommand?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  sidecarPath?: string;
  startupTimeoutMs?: number;
  requestTimeoutMs?: number;
}

const DEFAULT_SIDECAR_STARTUP_TIMEOUT_MS = 5_000;
const DEFAULT_SIDECAR_REQUEST_TIMEOUT_MS = 15_000;

function describeUnknownError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function describeSpawnFailure(bunCommand: string, error: unknown) {
  if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
    return `Failed to start the OpenTUI sidecar because '${bunCommand}' was not found. Install Bun or pass 'bunCommand'.`;
  }

  return `Failed to start the OpenTUI sidecar with '${bunCommand}'. Install Bun or pass 'bunCommand'. ${describeUnknownError(error)}`;
}

class SidecarOpenTuiHost implements OpenTuiHost {
  private readonly pending = new Map<number, PendingRequest>();
  private readonly stderrChunks: string[] = [];
  private nextRequestId = 1;
  private closed = false;
  private destroying = false;

  constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    private readonly bunCommand: string,
    private readonly requestTimeoutMs: number,
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
      this.abort(new Error(describeSpawnFailure(this.bunCommand, error)));
    });

    child.on("exit", (code, signal) => {
      if (this.closed) {
        return;
      }

      const methods = [...new Set([...this.pending.values()].map((pending) => pending.method))];
      const waitingFor = methods.length > 0 ? ` while waiting for ${methods.join(", ")}` : "";
      this.abort(
        new Error(
          `OpenTUI sidecar exited unexpectedly${waitingFor} (code=${code}, signal=${signal}).${this.stderrSuffix()}`,
        ),
      );
    });
  }

  async initialize(options: CreateOpenTuiHostOptions, startupTimeoutMs: number) {
    await this.verifyProtocol(startupTimeoutMs);
    await this.request("create", options, startupTimeoutMs);
    return this;
  }

  private isHandshakeResult(value: unknown): value is OpenTuiSidecarHandshake {
    return (
      typeof value === "object" &&
      value !== null &&
      "protocol" in value &&
      "version" in value &&
      typeof value.protocol === "string" &&
      typeof value.version === "number"
    );
  }

  private async verifyProtocol(timeoutMs: number) {
    const result = await this.request<unknown>(
      "handshake",
      {
        protocol: OPENTUI_SIDECAR_PROTOCOL,
        version: OPENTUI_SIDECAR_PROTOCOL_VERSION,
      },
      timeoutMs,
    );

    if (!this.isHandshakeResult(result)) {
      const error = new Error(
        `OpenTUI sidecar returned an invalid protocol handshake. Expected { protocol: '${OPENTUI_SIDECAR_PROTOCOL}', version: ${OPENTUI_SIDECAR_PROTOCOL_VERSION} }.`,
      );
      this.abort(error);
      throw error;
    }

    if (
      result.protocol !== OPENTUI_SIDECAR_PROTOCOL ||
      result.version !== OPENTUI_SIDECAR_PROTOCOL_VERSION
    ) {
      const error = new Error(
        `OpenTUI sidecar protocol mismatch. Host expects ${OPENTUI_SIDECAR_PROTOCOL}@${OPENTUI_SIDECAR_PROTOCOL_VERSION}, but the sidecar reported ${result.protocol}@${result.version}.`,
      );
      this.abort(error);
      throw error;
    }
  }

  private stderrSuffix() {
    const detail = this.stderrChunks.join("").trim();
    return detail.length > 0 ? `\n${detail}` : "";
  }

  private clearPendingTimeout(pending: PendingRequest) {
    if (!pending.timeout) {
      return;
    }

    clearTimeout(pending.timeout);
    pending.timeout = null;
  }

  private shutdownProcess() {
    if (!this.child.stdin.destroyed) {
      this.child.stdin.end();
    }

    if (!this.child.killed) {
      this.child.kill();
    }
  }

  private abort(error: Error) {
    this.failAll(error);
    this.shutdownProcess();
  }

  private handleResponseLine(line: string) {
    let response: OpenTuiSidecarResponse;
    try {
      response = JSON.parse(line) as OpenTuiSidecarResponse;
    } catch {
      this.abort(
        new Error(`OpenTUI sidecar returned invalid JSON.${this.stderrSuffix()}\n${line}`),
      );
      return;
    }

    const pending = this.pending.get(response.id);
    if (!pending) {
      return;
    }

    this.pending.delete(response.id);
    this.clearPendingTimeout(pending);
    if (response.ok) {
      pending.resolve(response.result);
      return;
    }

    pending.reject(new Error(`OpenTUI sidecar ${pending.method} failed: ${response.error}`));
  }

  private failAll(error: Error) {
    if (this.closed) {
      return;
    }

    this.closed = true;
    for (const pending of this.pending.values()) {
      this.clearPendingTimeout(pending);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private request<T = undefined>(
    method: OpenTuiSidecarRequest["method"],
    params?: unknown,
    timeoutMs = this.requestTimeoutMs,
  ) {
    if (this.closed && !this.destroying) {
      return Promise.reject(new Error("OpenTUI sidecar has already been closed."));
    }

    const id = this.nextRequestId++;
    const message = JSON.stringify({ id, method, ...(params ? { params } : {}) });

    return new Promise<T>((resolve, reject) => {
      const pending: PendingRequest = {
        method,
        resolve: (value) => {
          resolve(value as T);
        },
        reject,
        timeout:
          timeoutMs > 0
            ? setTimeout(() => {
                this.abort(
                  new Error(
                    `OpenTUI sidecar ${method} timed out after ${timeoutMs}ms.${this.stderrSuffix()}`,
                  ),
                );
              }, timeoutMs)
            : null,
      };
      this.pending.set(id, pending);
      this.child.stdin.write(`${message}\n`, (error) => {
        if (!error) {
          return;
        }

        this.pending.delete(id);
        this.clearPendingTimeout(pending);
        reject(new Error(`OpenTUI sidecar ${method} write failed: ${describeUnknownError(error)}`));
      });
    });
  }

  async mount(island: OpenTuiIslandSource) {
    await this.request("mount", { island: resolveOpenTuiIslandSource(island) });
  }

  async updateProps(props?: OpenTuiIslandProps) {
    await this.request("updateProps", { props });
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
    return (await this.request<HostFrame>("renderFrame")) as HostFrame;
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
      this.shutdownProcess();
      this.pending.clear();
    }
  }
}

/** Spawn a Bun sidecar that renders one OpenTUI island offscreen. */
export async function createOpenTuiSidecarHost(options: CreateOpenTuiSidecarHostOptions) {
  const bunCommand = options.bunCommand ?? process.env.OPENTUI_ISLAND_BUN ?? "bun";
  const sidecarPath = options.sidecarPath ?? fileURLToPath(new URL("./server.js", import.meta.url));
  const startupTimeoutMs = options.startupTimeoutMs ?? DEFAULT_SIDECAR_STARTUP_TIMEOUT_MS;
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_SIDECAR_REQUEST_TIMEOUT_MS;
  const child = spawn(bunCommand, [sidecarPath], {
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env,
    },
    stdio: ["pipe", "pipe", "pipe"],
  }) as ChildProcessWithoutNullStreams;
  const host = new SidecarOpenTuiHost(child, bunCommand, requestTimeoutMs);
  return host.initialize(
    {
      size: options.size,
      kittyKeyboard: options.kittyKeyboard,
      otherModifiersMode: options.otherModifiersMode,
    },
    startupTimeoutMs,
  );
}
