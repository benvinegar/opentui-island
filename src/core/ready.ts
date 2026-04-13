export type IslandReadyState = "loading" | "ready" | "error";

export interface IslandReadySnapshot {
  state: IslandReadyState;
  error: Error | null;
}

export interface IslandReadyCallbacks {
  onReady?: () => void;
  onError?: (error: Error) => void;
  onReadyStateChange?: (snapshot: IslandReadySnapshot) => void;
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
export class ReadyTracker {
  private callbacks: IslandReadyCallbacks;
  private state: IslandReadyState = "loading";
  private error: Error | null = null;
  private pending = createReadyPromise();
  private pendingSettled = false;

  constructor(callbacks: IslandReadyCallbacks = {}) {
    this.callbacks = callbacks;
  }

  updateCallbacks(callbacks: IslandReadyCallbacks) {
    this.callbacks = callbacks;
  }

  getSnapshot(): IslandReadySnapshot {
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

  private transitionTo(next: IslandReadySnapshot) {
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

// Backward-compatible aliases for the pre-rename public API.
export type OpenTuiReadyState = IslandReadyState;
export type OpenTuiReadySnapshot = IslandReadySnapshot;
export type OpenTuiReadyCallbacks = IslandReadyCallbacks;
export const OpenTuiReadyTracker = ReadyTracker;
