import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import {
  createEditTool,
  type EditToolDetails,
  type ExtensionAPI,
  type ExtensionCommandContext,
  type ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import {
  createPiTuiSurface,
  disablePiTuiMouseMode,
  enablePiTuiMouseMode,
} from "../../dist/adapters/pi-tui/index.js";
import {
  Text,
  matchesKey,
  truncateToWidth,
  visibleWidth,
  type Component,
  type TUI,
} from "@mariozechner/pi-tui";
import { runPiResultEditorDemo } from "./result-editor.js";

type Surface = Component & {
  focused: boolean;
  sync(width?: number): Promise<void>;
  destroy(): Promise<void>;
  setScreenBounds(
    bounds: { row: number; col: number; width?: number; height?: number } | null,
  ): void;
};

type IslandConfig = {
  title: string;
  moduleUrl: URL;
  height: number;
  readyStatus: string;
  props?: Record<string, string | number | boolean | string[] | undefined>;
};

type DiffInput = {
  title: string;
  lines: string[];
  source: string;
};

type UiCapableContext = Pick<ExtensionContext, "hasUI" | "cwd" | "ui">;

const COUNTER_ISLAND_MODULE_URL = new URL("../islands/counter.island.tsx", import.meta.url);
const DIFF_VIEWER_ISLAND_MODULE_URL = new URL("../islands/diff-viewer.island.tsx", import.meta.url);
const MOUSE_PLAYGROUND_ISLAND_MODULE_URL = new URL(
  "../islands/mouse-playground.island.tsx",
  import.meta.url,
);
const MOUSE_DEMO_ROW = 2;
const MOUSE_DEMO_COL = 4;
const MOUSE_DEMO_WIDTH = 72;

const SAMPLE_DIFF = [
  "diff --git a/src/app.ts b/src/app.ts",
  "index 2f4b6be..fd8b88e 100644",
  "--- a/src/app.ts",
  "+++ b/src/app.ts",
  "@@ -12,8 +12,10 @@ export function renderStatus(branch: string | null) {",
  '   const label = branch ? `on ${branch}` : "detached";',
  '-  const accent = theme.fg("muted", label);',
  '+  const accent = theme.fg("accent", label);',
  '+  const dirty = repo.isDirty() ? theme.fg("warning", " • dirty") : "";',
  " ",
  "   return (",
  "-    <Text>{accent}</Text>",
  "+    <Text>{accent}{dirty}</Text>",
  '+    <Text>{theme.fg("dim", "Press / to explore commands")}</Text>',
  "   );",
  " }",
] as const;

let lastDiff: DiffInput | null = null;

function padToWidth(text: string, width: number): string {
  const clipped = truncateToWidth(text, width, "", true);
  const currentWidth = visibleWidth(clipped);
  return clipped + " ".repeat(Math.max(0, width - currentWidth));
}

function formatError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function normalizeDiffLines(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const fenced = normalized.match(/^```(?:diff|patch|text)?\n([\s\S]*?)\n```$/);
  const content = fenced?.[1] ?? normalized;
  return content.split("\n");
}

function countDiffStats(lines: string[]): { additions: number; removals: number } {
  let additions = 0;
  let removals = 0;

  for (const line of lines) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions += 1;
    if (line.startsWith("-") && !line.startsWith("---")) removals += 1;
  }

  return { additions, removals };
}

async function loadDiffInput(args: string, ctx: UiCapableContext): Promise<DiffInput> {
  const trimmedArgs = args.trim();

  if (trimmedArgs.length > 0) {
    const fileArg = trimmedArgs.startsWith("@") ? trimmedArgs.slice(1) : trimmedArgs;
    const absolutePath = fileArg.startsWith("/") ? fileArg : resolve(ctx.cwd, fileArg);
    const raw = await readFile(absolutePath, "utf8");
    const lines = normalizeDiffLines(raw);
    if (lines.length === 0) {
      throw new Error(`Diff file was empty: ${absolutePath}`);
    }
    return {
      title: basename(absolutePath),
      lines,
      source: `file ${absolutePath}`,
    };
  }

  const editorText = ((ctx.ui as { getEditorText?: () => string }).getEditorText?.() ?? "").trim();
  if (editorText.length > 0) {
    const lines = normalizeDiffLines(editorText);
    if (lines.length > 0) {
      return {
        title: "Editor diff",
        lines,
        source: "editor",
      };
    }
  }

  return {
    title: "app.ts sample",
    lines: [...SAMPLE_DIFF],
    source: "built-in sample",
  };
}

class InlineDiffResult implements Component {
  constructor(
    private readonly diffLines: string[],
    private readonly expanded: boolean,
    private readonly theme: {
      fg: (color: string, text: string) => string;
    },
  ) {}

  invalidate(): void {}

  render(width: number): string[] {
    const innerWidth = Math.max(1, width);
    const { additions, removals } = countDiffStats(this.diffLines);
    const visibleLimit = this.expanded ? 18 : 6;
    const visibleLines = this.diffLines.slice(0, visibleLimit);

    const lines = [
      padToWidth(
        this.theme.fg("toolDiffAdded", `+${additions}`) +
          this.theme.fg("dim", " / ") +
          this.theme.fg("toolDiffRemoved", `-${removals}`),
        innerWidth,
      ),
    ];

    for (const line of visibleLines) {
      let styled = this.theme.fg("toolDiffContext", line);
      if (line.startsWith("+") && !line.startsWith("+++"))
        styled = this.theme.fg("toolDiffAdded", line);
      else if (line.startsWith("-") && !line.startsWith("---"))
        styled = this.theme.fg("toolDiffRemoved", line);
      else if (line.startsWith("@@")) styled = this.theme.fg("accent", line);
      else if (
        line.startsWith("diff --git") ||
        line.startsWith("index ") ||
        line.startsWith("--- ") ||
        line.startsWith("+++ ")
      ) {
        styled = this.theme.fg("muted", line);
      }
      lines.push(padToWidth(styled, innerWidth));
    }

    if (this.diffLines.length > visibleLimit) {
      lines.push(
        padToWidth(
          this.theme.fg("muted", `... ${this.diffLines.length - visibleLimit} more diff lines`),
          innerWidth,
        ),
      );
    }

    lines.push(
      padToWidth(
        this.theme.fg(
          "dim",
          this.expanded
            ? "/review-last-diff for full viewer"
            : "Ctrl+O expands • /review-last-diff opens viewer",
        ),
        innerWidth,
      ),
    );
    return lines;
  }
}

class MouseIslandOverlay implements Component {
  private surface: Surface | null = null;
  private status = "Starting Bun sidecar with mouse mode…";
  private error: string | null = null;
  private width = MOUSE_DEMO_WIDTH;
  private readonly height = 7;

  constructor(
    private readonly tui: TUI,
    private readonly done: (value: string) => void,
  ) {
    enablePiTuiMouseMode(this.tui.terminal);
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.surface = (await createPiTuiSurface({
        height: this.height,
        initialWidth: this.width,
        requestRender: () => this.tui.requestRender(),
        island: { module: MOUSE_PLAYGROUND_ISLAND_MODULE_URL },
      })) as Surface;
      this.surface.focused = true;
      this.surface.setScreenBounds({
        row: MOUSE_DEMO_ROW,
        col: MOUSE_DEMO_COL,
        width: this.width,
        height: this.height,
      });
      await this.surface.sync(this.width);
      this.status = "Click inside the island; q closes.";
    } catch (error) {
      this.error = formatError(error);
      this.status = "Mouse island failed to initialize.";
    }

    this.tui.requestRender();
  }

  invalidate(): void {
    this.surface?.invalidate();
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "q")) {
      void this.close();
      return;
    }

    this.surface?.handleInput?.(data);
    this.tui.requestRender();
  }

  render(width: number): string[] {
    this.width = Math.max(1, Math.min(width, MOUSE_DEMO_WIDTH));
    this.surface?.setScreenBounds({
      row: MOUSE_DEMO_ROW,
      col: MOUSE_DEMO_COL,
      width: this.width,
      height: this.height,
    });

    if (this.error) {
      return [padToWidth(this.error, this.width), padToWidth("Press q to close.", this.width)];
    }

    if (!this.surface) {
      return [padToWidth(this.status, this.width)];
    }

    return [...this.surface.render(this.width), padToWidth(this.status, this.width)];
  }

  private async close(): Promise<void> {
    try {
      await this.surface?.destroy();
    } finally {
      disablePiTuiMouseMode(this.tui.terminal);
      this.done("closed");
    }
  }
}

class OpenTuiIslandOverlay implements Component {
  private surface: Surface | null = null;
  private status = "Starting Bun sidecar…";
  private error: string | null = null;

  constructor(
    private readonly tui: TUI,
    private readonly config: IslandConfig,
    private readonly done: (value: string) => void,
  ) {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.surface = (await createPiTuiSurface({
        height: this.config.height,
        initialWidth: Math.max(24, this.tui.terminal.columns - 4),
        requestRender: () => this.tui.requestRender(),
        island: { module: this.config.moduleUrl, props: this.config.props },
      })) as Surface;
      this.surface.focused = true;
      await this.surface.sync(Math.max(24, this.tui.terminal.columns - 4));
      this.status = this.config.readyStatus;
    } catch (error) {
      this.error = formatError(error);
      this.status = "OpenTUI island failed to initialize.";
    }

    this.tui.requestRender();
  }

  invalidate(): void {
    this.surface?.invalidate();
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "q")) {
      void this.close();
      return;
    }

    this.surface?.handleInput?.(data);
    this.tui.requestRender();
  }

  render(width: number): string[] {
    const innerWidth = Math.max(1, width - 2);
    const top = `╭${"─".repeat(innerWidth)}╮`;
    const bottom = `╰${"─".repeat(innerWidth)}╯`;
    const title = `│${padToWidth(this.config.title, innerWidth)}│`;

    if (this.error) {
      const body = [
        "Node import worked, but the Bun sidecar or island failed to start.",
        this.error,
        `Island module: ${this.config.moduleUrl.pathname}`,
        "Make sure Bun 1.3+ is installed and available on PATH.",
      ];
      return [top, title, ...body.map((line) => `│${padToWidth(line, innerWidth)}│`), bottom];
    }

    if (!this.surface) {
      return [
        top,
        title,
        `│${padToWidth(this.status, innerWidth)}│`,
        `│${padToWidth("Press q or Esc to close.", innerWidth)}│`,
        bottom,
      ];
    }

    const lines = this.surface
      .render(innerWidth)
      .map((line) => `│${padToWidth(line, innerWidth)}│`);
    return [top, title, ...lines, `│${padToWidth(this.status, innerWidth)}│`, bottom];
  }

  private async close(): Promise<void> {
    try {
      await this.surface?.destroy();
    } finally {
      this.done("closed");
    }
  }
}

async function runIslandDemo(ctx: UiCapableContext, config: IslandConfig): Promise<void> {
  if (!ctx.hasUI) return;

  await ctx.ui.custom<string>(
    (tui, _theme, _keybindings, done) => new OpenTuiIslandOverlay(tui, config, done),
    {
      overlay: true,
      overlayOptions: {
        anchor: "center",
        width: "80%",
        maxHeight: config.height + 4,
        margin: 1,
      },
    },
  );
}

async function reviewDiff(
  ctx: UiCapableContext,
  diff: DiffInput,
  sourceLabel?: string,
): Promise<void> {
  lastDiff = diff;
  await runIslandDemo(ctx, {
    title: "opentui diff demo",
    moduleUrl: DIFF_VIEWER_ISLAND_MODULE_URL,
    height: 13,
    readyStatus: `Diff ready from ${sourceLabel ?? diff.source}. Use j/k or arrows to scroll; q closes.`,
    props: {
      title: diff.title,
      lines: diff.lines,
    },
  });
}

export default function openTuiIslandPiExamples(pi: ExtensionAPI) {
  const cwd = process.cwd();
  const originalEdit = createEditTool(cwd);

  pi.registerTool({
    name: "edit",
    label: originalEdit.label,
    description: originalEdit.description,
    parameters: originalEdit.parameters,

    async execute(toolCallId, params, signal, onUpdate) {
      const result = await originalEdit.execute(toolCallId, params, signal, onUpdate);
      const details = result.details as EditToolDetails | undefined;
      const diffLines = normalizeDiffLines(details?.diff ?? "");

      if (diffLines.length > 0) {
        lastDiff = {
          title: params.path,
          lines: diffLines,
          source: `edit ${params.path}`,
        };
      }

      return result;
    },

    renderCall(args, theme) {
      return new Text(
        theme.fg("toolTitle", theme.bold("edit ")) + theme.fg("accent", args.path),
        0,
        0,
      );
    },

    renderResult(result, { expanded, isPartial }, theme) {
      if (isPartial) return new Text(theme.fg("warning", "Editing..."), 0, 0);

      const details = result.details as EditToolDetails | undefined;
      const content = result.content[0];
      const diffLines = normalizeDiffLines(details?.diff ?? "");

      if (content?.type === "text" && content.text.startsWith("Error")) {
        return new Text(theme.fg("error", content.text.split("\n")[0] ?? "Edit failed"), 0, 0);
      }

      if (diffLines.length === 0) {
        return new Text(theme.fg("success", "Applied"), 0, 0);
      }

      return new InlineDiffResult(diffLines, expanded, theme);
    },
  });

  pi.registerCommand("opentui-counter-demo", {
    description: "Mount a counter island inside a Pi overlay via Bun sidecar",
    handler: async (_args, ctx) => {
      try {
        await runIslandDemo(ctx, {
          title: "opentui counter demo",
          moduleUrl: COUNTER_ISLAND_MODULE_URL,
          height: 4,
          readyStatus: "Counter ready. Press a to increment; q closes.",
          props: {},
        });
        ctx.ui.notify("Closed counter demo.", "info");
      } catch (error) {
        ctx.ui.notify(`opentui-island failed: ${formatError(error)}`, "error");
      }
    },
  });

  pi.registerCommand("opentui-diff-demo", {
    description: "Render a generic diff viewer from args path or editor text via opentui-island",
    handler: async (args, ctx) => {
      try {
        const diff = await loadDiffInput(args, ctx);
        await reviewDiff(ctx, diff);
        ctx.ui.notify(`Closed diff from ${diff.source}.`, "info");
      } catch (error) {
        ctx.ui.notify(`Failed to load diff: ${formatError(error)}`, "error");
      }
    },
  });

  pi.registerCommand("opentui-editor-demo", {
    description: "Open a hosted island editor and return its saved text to the Pi host",
    handler: async (_args, ctx: ExtensionCommandContext) => {
      try {
        const result = await runPiResultEditorDemo(ctx);
        if (result.type === "save") {
          const maybePasteToEditor = (
            ctx.ui as {
              pasteToEditor?: (text: string) => Promise<void> | void;
            }
          ).pasteToEditor;
          await maybePasteToEditor?.(result.payload.text);
          ctx.ui.notify("Saved island text back to the host.", "success");
          return;
        }

        ctx.ui.notify("Cancelled island editor.", "info");
      } catch (error) {
        ctx.ui.notify(`Hosted editor failed: ${formatError(error)}`, "error");
      }
    },
  });

  pi.registerCommand("review-last-diff", {
    description: "Reopen the most recent edit diff in the full diff viewer",
    handler: async (_args, ctx: ExtensionCommandContext) => {
      if (!lastDiff) {
        ctx.ui.notify("No diff captured yet.", "info");
        return;
      }

      try {
        await reviewDiff(ctx, lastDiff, `cached ${lastDiff.source}`);
        ctx.ui.notify("Closed cached diff review.", "info");
      } catch (error) {
        ctx.ui.notify(`Failed to reopen diff: ${formatError(error)}`, "error");
      }
    },
  });

  pi.registerCommand("opentui-mouse-demo", {
    description: "Demonstrate Pi mouse input being translated into an OpenTUI island",
    handler: async (_args, ctx: ExtensionCommandContext) => {
      if (!ctx.hasUI) return;
      try {
        await ctx.ui.custom<string>(
          (tui, _theme, _keybindings, done) => new MouseIslandOverlay(tui, done),
          {
            overlay: true,
            overlayOptions: {
              row: MOUSE_DEMO_ROW,
              col: MOUSE_DEMO_COL,
              width: MOUSE_DEMO_WIDTH,
              maxHeight: 8,
              margin: 0,
            },
          },
        );
        ctx.ui.notify("Closed mouse demo.", "info");
      } catch (error) {
        ctx.ui.notify(`Mouse demo failed: ${formatError(error)}`, "error");
      }
    },
  });
}
