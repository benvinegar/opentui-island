import { createPiTuiSurface, type PiTuiSurface } from "../../dist/adapters/pi-tui/index.js";
import {
  matchesKey,
  truncateToWidth,
  visibleWidth,
  type Component,
  type TUI,
} from "@mariozechner/pi-tui";

type Surface = PiTuiSurface;

export type NoteEditorSaveEvent = {
  type: "save";
  payload: { text: string };
};

export type NoteEditorCancelEvent = {
  type: "cancel";
  payload: null;
};

export type NoteEditorResultEvent = NoteEditorSaveEvent | NoteEditorCancelEvent;

const NOTE_EDITOR_MODULE_URL = new URL("../islands/note-editor.island.tsx", import.meta.url);

function padToWidth(text: string, width: number): string {
  const clipped = truncateToWidth(text, width, "", true);
  return clipped + " ".repeat(Math.max(0, width - visibleWidth(clipped)));
}

function formatError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function isNoteEditorResultEvent(event: {
  type: string;
  payload: unknown;
}): event is NoteEditorResultEvent {
  return event.type === "save" || event.type === "cancel";
}

class ResultEditorOverlay implements Component {
  private surface: Surface | null = null;
  private status = "Starting Bun sidecar…";
  private error: string | null = null;
  private closed = false;

  constructor(
    private readonly tui: TUI,
    private readonly initialText: string,
    private readonly done: (value: NoteEditorResultEvent) => void,
  ) {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.surface = await createPiTuiSurface({
        height: 9,
        initialWidth: Math.max(30, this.tui.terminal.columns - 4),
        requestRender: () => this.tui.requestRender(),
        island: {
          module: NOTE_EDITOR_MODULE_URL,
          props: { initialText: this.initialText },
        },
      });
      this.surface.focused = true;
      await this.surface.sync(Math.max(30, this.tui.terminal.columns - 4));
      this.status = "Type in the island. Tab saves; Esc cancels.";
      this.tui.requestRender();

      const result = await this.surface.waitForEvent(isNoteEditorResultEvent);
      await this.close(result);
    } catch (error) {
      if (this.closed) {
        return;
      }

      this.error = formatError(error);
      this.status = "Hosted editor failed to initialize.";
      this.tui.requestRender();
    }
  }

  invalidate(): void {
    this.surface?.invalidate();
  }

  handleInput(data: string): void {
    if (matchesKey(data, "ctrl+c") || (this.error && matchesKey(data, "q"))) {
      void this.close({ type: "cancel", payload: null });
      return;
    }

    this.surface?.handleInput?.(data);
    this.tui.requestRender();
  }

  render(width: number): string[] {
    const innerWidth = Math.max(1, width - 2);
    const top = `╭${"─".repeat(innerWidth)}╮`;
    const bottom = `╰${"─".repeat(innerWidth)}╯`;
    const title = `│${padToWidth("opentui result editor", innerWidth)}│`;

    if (this.error) {
      return [
        top,
        title,
        `│${padToWidth(this.status, innerWidth)}│`,
        `│${padToWidth(this.error, innerWidth)}│`,
        `│${padToWidth("Press q or Ctrl+C to close.", innerWidth)}│`,
        bottom,
      ];
    }

    if (!this.surface) {
      return [top, title, `│${padToWidth(this.status, innerWidth)}│`, bottom];
    }

    const lines = this.surface
      .render(innerWidth)
      .map((line) => `│${padToWidth(line, innerWidth)}│`);
    return [top, title, ...lines, `│${padToWidth(this.status, innerWidth)}│`, bottom];
  }

  private async close(result: NoteEditorResultEvent): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;
    try {
      await this.surface?.destroy();
    } finally {
      this.done(result);
    }
  }
}

export async function runPiResultEditorDemo(ctx: {
  hasUI: boolean;
  ui: {
    custom<T>(
      render: (
        tui: TUI,
        theme: unknown,
        keybindings: unknown,
        done: (value: T) => void,
      ) => Component,
      options: {
        overlay: true;
        overlayOptions: { anchor: "center"; width: string; maxHeight: number; margin: number };
      },
    ): Promise<T>;
  };
}) {
  if (!ctx.hasUI) {
    return { type: "cancel", payload: null } satisfies NoteEditorCancelEvent;
  }

  return ctx.ui.custom<NoteEditorResultEvent>(
    (tui, _theme, _keybindings, done) =>
      new ResultEditorOverlay(tui, "Draw a terminal postcard.", done),
    {
      overlay: true,
      overlayOptions: {
        anchor: "center",
        width: "80%",
        maxHeight: 13,
        margin: 1,
      },
    },
  );
}
