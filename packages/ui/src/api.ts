/**
 * The host's HTTP API, from the browser. The types are the host's own; the transport is
 * plain fetch and EventSource, to the host that served this page.
 */
import type { ContextInfo, EditInfo, HostEvent, OperationInfo, PackageSummary, RunInfo } from "@systemathic/host";

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

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value?.error ?? response.statusText);
  return value as T;
}

const c = (context: string) => `/api/contexts/${encodeURIComponent(context)}`;
const s = (context: string, session: string) => `${c(context)}/sessions/${encodeURIComponent(session)}`;

export const api = {
  editors: () => call<OperationInfo[]>("GET", "/api/editors"),
  perspectives: () => call<PerspectiveInfo[]>("GET", "/api/perspectives"),
  catalog: (text = "", tag = "") => call<PackageSummary[]>("GET", `/api/catalog?${new URLSearchParams({ text, ...(tag ? { tag } : {}) })}`),
  contexts: () => call<ContextInfo[]>("GET", "/api/contexts"),
  create: (name: string) => call<ContextInfo>("POST", "/api/contexts", { name }),
  open: (path: string) => call<ContextInfo & { problems: { at: string; message: string }[] }>("POST", "/api/contexts/open", { path }),
  save: (context: string, path?: string) => call<{ path: string }>("POST", `${c(context)}/save`, path ? { path } : {}),
  startSession: (context: string) => call<{ session: string }>("POST", `${c(context)}/sessions`, { client: "ui" }),
  apply: (context: string, session: string, editor: string, operation: string, args: Record<string, unknown>) =>
    call<EditInfo>("POST", `${s(context, session)}/operations/${editor}/${operation}`, { args }),
  undo: (context: string, session: string) => call<EditInfo | null>("POST", `${s(context, session)}/undo`, {}),
  select: (context: string, session: string, ids: string[]) => call<string[]>("POST", `${s(context, session)}/select`, { ids }),
  importPackage: (context: string, session: string, id: string) => call<{ edits: EditInfo[] }>("POST", `${s(context, session)}/import`, { package: id }),
  history: (context: string) => call<EditInfo[]>("GET", `${c(context)}/history`),
  diagnostics: (context: string) => call<Diagnostic[]>("GET", `${c(context)}/diagnostics`),
  view: (context: string, perspective: string, language?: string) =>
    call<View>("GET", `${c(context)}/views/${perspective}${language ? `?language=${encodeURIComponent(language)}` : ""}`),
  verify: (context: string) => call<RunInfo>("POST", `${c(context)}/verify`, {}),
  specification: (context: string) => call<{ markdown: string }>("GET", `${c(context)}/specification`),
  attachment: (context: string, owner: string) => call<unknown>("GET", `${c(context)}/attachments/${owner}`),
  setAttachment: (context: string, owner: string, data: unknown) => call<void>("PUT", `${c(context)}/attachments/${owner}`, { data }),
  events: (listener: (event: HostEvent) => void): (() => void) => {
    const source = new EventSource("/api/events");
    source.onmessage = (message) => listener(JSON.parse(message.data));
    return () => source.close();
  },
};
