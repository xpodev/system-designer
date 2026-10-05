/**
 * The host, from the page. Served by `systemathic serve`, the page talks to it over HTTP; built
 * as a static site, the page carries its own host, in the browser (docs/tool-design.md,
 * `Tool / Host`: a local process, or a browser tab). Everything else in the UI is the same.
 */
import { HostClient, HostError, type ContextInfo, type EditInfo, type HostApi, type HostEvent, type OperationInfo, type PackageSummary, type RunInfo } from "@systemathic/host";
import type { SystemFile } from "./model";

export type { ContextInfo, EditInfo, HostEvent, OperationInfo, PackageSummary, RunInfo };

/** The System written up as one document, as the host gives it. */
export type Documentation = Awaited<ReturnType<HostApi["documentation"]>>["documentation"];
export { HostError as ApiError };

/** Where the host is: a process the page talks to, or the page itself. */
export type HostMode = "served" | "browser";

let host: HostApi = new HostClient("");
let mode: HostMode = "served";

/** Finds the host: the page's own when it was built to stand alone, the one that served it otherwise. */
export async function connect(): Promise<HostMode> {
  if (import.meta.env.MODE === "static") {
    const { browserHost } = await import("@systemathic/host-browser");
    host = await browserHost();
    mode = "browser";
  }
  return mode;
}

/** For tests: a host of their choosing. */
export function useHost(chosen: HostApi, as: HostMode): void {
  host = chosen;
  mode = as;
}

export const hostMode = (): HostMode => mode;

export interface Mark {
  severity: "error" | "warning";
  check: string;
  message: string;
}

export interface Item {
  id: string;
  subject: string;
  kind: string;
  label: string;
  detail?: string;
  level?: number;
  parent?: string;
  children: string[];
  marks: Mark[];
}

export interface Link {
  id: string;
  source: string;
  target: string;
  kind: string;
  label?: string;
  /** What reads beside each end's Item: a Relationship's end there, by name and range. */
  ends?: { source: LinkEnd; target: LinkEnd };
  /** The thing of the System the Link is: a Relationship. */
  subject?: string;
}

export interface LinkEnd {
  name?: string;
  range: string;
}

export interface View {
  perspective: string;
  title: string;
  items: Item[];
  links: Link[];
}

export interface PerspectiveInfo {
  perspective: string;
  title: string;
  about: string;
  needs?: "language";
}

export interface Diagnostic {
  severity: "error" | "warning";
  check: string;
  kind: "condition" | "rule";
  message: string;
  subjects: string[];
  suggestions: { message: string; subjects: string[] }[];
}

export interface ScriptSymbol {
  name: string;
  kind: "function" | "class" | "rule" | "constant" | "method" | "property";
  detail: string;
  doc: string;
  module: string;
}

export interface ScriptCheck {
  problems: { line: number; column: number; endLine: number; endColumn: number; message: string; severity: "error" | "warning" | "info" }[];
  rules: { name: string; severity: string; about: string; doc?: string; script: string; line?: number }[];
  profiles: { name: string; rules: string[] }[];
}

export const api = {
  editors: () => host.editors(),
  perspectives: () => host.perspectives() as Promise<PerspectiveInfo[]>,
  catalog: (text = "", tag = "") => host.catalog(text, tag || undefined),
  /** Read so that what an older host leaves out does not break the page. */
  contexts: () =>
    host.contexts().then((all) =>
      (all as Partial<ContextInfo>[]).map((c) => ({ edits: 0, sessions: 0, structuralErrors: 0, ...c, clients: c.clients ?? [], dirty: c.dirty ?? false }) as ContextInfo),
    ),
  files: () => host.files(),
  writeFile: (path: string, text: string) => host.writeFile(path, text),
  create: (name: string) => host.create(name),
  open: (path: string) => host.open(path),
  save: (context: string, path?: string) => host.save(context, path),
  startSession: (context: string) => host.startSession(context, "ui"),
  /** Ends a session, even as the page closes. */
  endSession: (context: string, session: string) => {
    if (mode === "served") void fetch(`/api/contexts/${encodeURIComponent(context)}/sessions/${encodeURIComponent(session)}`, { method: "DELETE", keepalive: true }).catch(() => undefined);
    else void host.endSession(context, session).catch(() => undefined);
  },
  apply: (context: string, session: string, editor: string, operation: string, args: Record<string, unknown>) => host.apply(context, session, editor, operation, args),
  undo: (context: string, session: string) => host.undo(context, session),
  redo: (context: string, session: string) => host.redo(context, session),
  select: (context: string, session: string, ids: string[]) => host.select(context, session, ids),
  importPackage: (context: string, session: string, id: string) => host.importPackage(context, session, { package: id }),
  system: (context: string) => host.system(context) as unknown as Promise<SystemFile>,
  history: (context: string) => host.history(context),
  diagnostics: (context: string) => host.diagnostics(context) as Promise<Diagnostic[]>,
  view: (context: string, perspective: string, language?: string) => host.view(context, perspective, language) as unknown as Promise<View>,
  verify: (context: string) => host.verify(context),
  specification: (context: string) => host.specification(context),
  documentation: (context: string) => host.documentation(context),
  exportSelection: (context: string, ids: string[], name: string, path?: string) => host.exportSelection(context, ids, name, path),
  script: (context: string) => host.script(context),
  saveScript: (context: string, path: string, source: string) => host.saveScript(context, path, source),
  checkScript: (source: string) => host.checkScript(source) as Promise<ScriptCheck>,
  symbols: () => host.symbols() as Promise<ScriptSymbol[]>,
  attachment: (context: string, owner: string) => host.attachment(context, owner),
  setAttachment: (context: string, owner: string, data: unknown) => host.setAttachment(context, owner, data),
  /** Every event of the host. A served page also hears whether the host is still there. */
  events: (listener: (event: HostEvent) => void, onConnection: (connected: boolean) => void): (() => void) => {
    if (mode === "browser" || typeof EventSource === "undefined") {
      onConnection(true);
      return host.subscribe(listener);
    }
    const source = new EventSource("/api/events");
    source.onopen = () => onConnection(true);
    source.onerror = () => onConnection(false);
    source.onmessage = (message) => listener(JSON.parse(message.data));
    return () => source.close();
  },
};
