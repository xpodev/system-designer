/**
 * The host's HTTP API, from the browser. The types are the host's own; the transport is
 * plain fetch and EventSource, to the host that served this page.
 */
import type { ContextInfo, EditInfo, HostEvent, OperationInfo, PackageSummary, RunInfo } from "@systemathic/host";
import type { SystemFile } from "./model";

export type { ContextInfo, EditInfo, HostEvent, OperationInfo, PackageSummary, RunInfo };

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
  rules: { name: string; severity: string; about: string; script: string; line?: number }[];
  profiles: { name: string; rules: string[] }[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, value?.error ?? response.statusText);
  return value as T;
}

const c = (context: string) => `/api/contexts/${encodeURIComponent(context)}`;
const s = (context: string, session: string) => `${c(context)}/sessions/${encodeURIComponent(session)}`;

export const api = {
  editors: () => call<OperationInfo[]>("GET", "/api/editors"),
  perspectives: () => call<PerspectiveInfo[]>("GET", "/api/perspectives"),
  catalog: (text = "", tag = "") => call<PackageSummary[]>("GET", `/api/catalog?${new URLSearchParams({ text, ...(tag ? { tag } : {}) })}`),
  /** Read so that what an older host leaves out does not break the page. */
  contexts: () =>
    call<Partial<ContextInfo>[]>("GET", "/api/contexts").then((all) =>
      all.map((c) => ({ edits: 0, sessions: 0, structuralErrors: 0, ...c, clients: c.clients ?? [], dirty: c.dirty ?? false }) as ContextInfo),
    ),
  files: () => call<string[]>("GET", "/api/files"),
  create: (name: string) => call<ContextInfo>("POST", "/api/contexts", { name }),
  open: (path: string) => call<ContextInfo & { problems: { at: string; message: string }[] }>("POST", "/api/contexts/open", { path }),
  save: (context: string, path?: string) => call<{ path: string }>("POST", `${c(context)}/save`, path ? { path } : {}),
  startSession: (context: string) => call<{ session: string }>("POST", `${c(context)}/sessions`, { client: "ui" }),
  /** Ends a session, even as the page closes. */
  endSession: (context: string, session: string) => void fetch(s(context, session), { method: "DELETE", keepalive: true }).catch(() => undefined),
  apply: (context: string, session: string, editor: string, operation: string, args: Record<string, unknown>) =>
    call<EditInfo>("POST", `${s(context, session)}/operations/${editor}/${operation}`, { args }),
  undo: (context: string, session: string) => call<EditInfo | null>("POST", `${s(context, session)}/undo`, {}),
  redo: (context: string, session: string) => call<EditInfo | null>("POST", `${s(context, session)}/redo`, {}),
  select: (context: string, session: string, ids: string[]) => call<string[]>("POST", `${s(context, session)}/select`, { ids }),
  importPackage: (context: string, session: string, id: string) => call<{ edits: EditInfo[]; reused: string[] }>("POST", `${s(context, session)}/import`, { package: id }),
  system: (context: string) => call<SystemFile>("GET", `${c(context)}/system`),
  history: (context: string) => call<EditInfo[]>("GET", `${c(context)}/history`),
  diagnostics: (context: string) => call<Diagnostic[]>("GET", `${c(context)}/diagnostics`),
  view: (context: string, perspective: string, language?: string) =>
    call<View>("GET", `${c(context)}/views/${perspective}${language ? `?language=${encodeURIComponent(language)}` : ""}`),
  verify: (context: string) => call<RunInfo>("POST", `${c(context)}/verify`, {}),
  specification: (context: string) => call<{ markdown: string }>("GET", `${c(context)}/specification`),
  exportSelection: (context: string, ids: string[], name: string, path?: string) => call<{ path?: string }>("POST", `${c(context)}/export`, { ids, name, path }),
  script: (context: string) => call<{ path: string; profile: string; source: string; exists: boolean }>("GET", `${c(context)}/script`),
  saveScript: (context: string, path: string, source: string) => call<{ path: string }>("PUT", `${c(context)}/script`, { path, source }),
  checkScript: (source: string) => call<ScriptCheck>("POST", "/api/scripts/check", { source }),
  symbols: () => call<ScriptSymbol[]>("GET", "/api/scripts/symbols"),
  attachment: (context: string, owner: string) => call<unknown>("GET", `${c(context)}/attachments/${owner}`),
  setAttachment: (context: string, owner: string, data: unknown) => call<void>("PUT", `${c(context)}/attachments/${owner}`, { data }),
  events: (listener: (event: HostEvent) => void, onConnection: (connected: boolean) => void): (() => void) => {
    const source = new EventSource("/api/events");
    source.onopen = () => onConnection(true);
    source.onerror = () => onConnection(false);
    source.onmessage = (message) => listener(JSON.parse(message.data));
    return () => source.close();
  },
};
