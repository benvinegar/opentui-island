export type OpenTuiReadyState = "loading" | "ready" | "error";

export interface OpenTuiReadySnapshot {
  state: OpenTuiReadyState;
  error: Error | null;
}

export interface OpenTuiReadyCallbacks {
  onReady?: () => void;
  onError?: (error: Error) => void;
  onReadyStateChange?: (snapshot: OpenTuiReadySnapshot) => void;
}

function sameError(left: Error | null, right: Error | null) {
  return left?.message === right?.message;
}

function createReadyPromise() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  void promise.catch(() => {});

  return { promise, resolve, reject };
}

/** Tracks one adapter's current loading state and exposes one waitable ready promise per cycle. */
export class OpenTuiReadyTracker {
  private callbacks: OpenTuiReadyCallbacks;
  private state: OpenTuiReadyState = "loading";
  private error: Error | null = null;
  private pending = createReadyPromise();
  private pendingSettled = false;

  constructor(callbacks: OpenTuiReadyCallbacks = {}) {
    this.callbacks = callbacks;
  }

  updateCallbacks(callbacks: OpenTuiReadyCallbacks) {
    this.callbacks = callbacks;
  }

  getSnapshot(): OpenTuiReadySnapshot {
    return {
      state: this.state,
      error: this.error,
    };
  }

  isReady() {
    return this.state === "ready";
  }

  waitUntilReady() {
    return this.pending.promise;
  }

  startLoading() {
    if (this.state === "loading" && this.error === null) {
      return;
    }

    this.pending = createReadyPromise();
    this.pendingSettled = false;
    this.transitionTo({ state: "loading", error: null });
  }

  markReady() {
    if (!this.pendingSettled) {
      this.pendingSettled = true;
      this.pending.resolve();
    }

    this.transitionTo({ state: "ready", error: null });
  }

  markError(error: Error) {
    if (!this.pendingSettled) {
      this.pendingSettled = true;
      this.pending.reject(error);
    }

    this.transitionTo({ state: "error", error });
  }

  private transitionTo(next: OpenTuiReadySnapshot) {
    const stateChanged = this.state !== next.state;
    const errorChanged = !sameError(this.error, next.error);
    if (!stateChanged && !errorChanged) {
      return;
    }

    this.state = next.state;
    this.error = next.error;
    this.callbacks.onReadyStateChange?.(this.getSnapshot());

    if (next.state === "ready") {
      this.callbacks.onReady?.();
      return;
    }

    if (next.state === "error" && next.error) {
      this.callbacks.onError?.(next.error);
    }
  }
}

export type IslandReadyState = OpenTuiReadyState;
export type IslandReadySnapshot = OpenTuiReadySnapshot;
export type IslandReadyCallbacks = OpenTuiReadyCallbacks;
