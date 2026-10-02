/** HostApi over HTTP: a client of a Host running in another process. */
import type { Diagnostic } from "@systemathic/diagnoser";
import type { Specification } from "@systemathic/exporter";
import type { PerspectiveInfo, View } from "@systemathic/perspectives";
import type { SystemFile } from "@systemathic/tool-json";
import type { ScriptCheck, ScriptSymbol } from "@systemathic/verifier";
import { HostError, type ContextInfo, type EditInfo, type HostApi, type HostEvent, type OperationInfo, type PackageSummary, type RunInfo } from "./api.js";

const enc = encodeURIComponent;

export class HostClient implements HostApi {
  constructor(readonly url: string) {}

  /** Whether a host answers at `url`. */
  static async reachable(url: string): Promise<boolean> {
    try {
      const response = await fetch(`${url}/api/contexts`, { signal: AbortSignal.timeout(1000) });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.url}${path}`, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value = await response.json();
    if (!response.ok) {
      const status = response.status === 400 || response.status === 404 || response.status === 409 ? response.status : undefined;
      if (status) throw new HostError(status, value.error);
      throw new Error(value.error ?? response.statusText);
    }
    return value as T;
  }

  private c(context: string): string {
    return `/api/contexts/${enc(context)}`;
  }

  private s(context: string, session: string): string {
    return `${this.c(context)}/sessions/${enc(session)}`;
  }

  editors = () => this.call<OperationInfo[]>("GET", "/api/editors");
  perspectives = () => this.call<PerspectiveInfo[]>("GET", "/api/perspectives");
  catalog = (text?: string, tag?: string) => {
    const query = new URLSearchParams();
    if (text) query.set("text", text);
    if (tag) query.set("tag", tag);
    return this.call<PackageSummary[]>("GET", `/api/catalog?${query}`);
  };
  contexts = () => this.call<ContextInfo[]>("GET", "/api/contexts");
  files = () => this.call<string[]>("GET", "/api/files");
  create = (name: string) => this.call<ContextInfo>("POST", "/api/contexts", { name });
  open = (path: string) => this.call<ContextInfo & { problems: { at: string; message: string }[] }>("POST", "/api/contexts/open", { path });
  save = (context: string, path?: string) => this.call<{ path: string }>("POST", `${this.c(context)}/save`, path === undefined ? {} : { path });
  startSession = (context: string, client: string) => this.call<{ session: string }>("POST", `${this.c(context)}/sessions`, { client });
  endSession = (context: string, session: string) => this.call<void>("DELETE", this.s(context, session));
  apply = (context: string, session: string, editor: string, operation: string, args: Record<string, unknown>) =>
    this.call<EditInfo>("POST", `${this.s(context, session)}/operations/${enc(editor)}/${enc(operation)}`, { args });
  undo = (context: string, session: string) => this.call<EditInfo | null>("POST", `${this.s(context, session)}/undo`, {});
  redo = (context: string, session: string) => this.call<EditInfo | null>("POST", `${this.s(context, session)}/redo`, {});
  select = (context: string, session: string, ids: readonly string[]) => this.call<string[]>("POST", `${this.s(context, session)}/select`, { ids });
  importPackage = (context: string, session: string, from: { package: string } | { path: string }) =>
    this.call<{ edits: EditInfo[]; reused: string[] }>("POST", `${this.s(context, session)}/import`, from);
  system = (context: string) => this.call<SystemFile>("GET", `${this.c(context)}/system`);
  history = (context: string) => this.call<EditInfo[]>("GET", `${this.c(context)}/history`);
  diagnostics = (context: string) => this.call<Diagnostic[]>("GET", `${this.c(context)}/diagnostics`);
  view = (context: string, perspective: string, language?: string) =>
    this.call<View>("GET", `${this.c(context)}/views/${enc(perspective)}${language === undefined ? "" : `?language=${enc(language)}`}`);
  verify = (context: string, script?: string, profile?: string) => this.call<RunInfo>("POST", `${this.c(context)}/verify`, { script, profile });
  specification = (context: string) => this.call<{ specification: Specification; markdown: string }>("GET", `${this.c(context)}/specification`);
  exportSelection = (context: string, ids: readonly string[], name: string, path?: string) =>
    this.call<{ path?: string; file: SystemFile }>("POST", `${this.c(context)}/export`, { ids, name, path });
  setAttachment = (context: string, owner: string, data: unknown) => this.call<void>("PUT", `${this.c(context)}/attachments/${enc(owner)}`, { data });
  script = (context: string) => this.call<{ path: string; profile: string; source: string; exists: boolean }>("GET", `${this.c(context)}/script`);
  saveScript = (context: string, path: string, source: string) => this.call<{ path: string }>("PUT", `${this.c(context)}/script`, { path, source });
  checkScript = (source: string) => this.call<ScriptCheck>("POST", "/api/scripts/check", { source });
  symbols = () => this.call<ScriptSymbol[]>("GET", "/api/scripts/symbols");
  attachment = (context: string, owner: string) => this.call<unknown>("GET", `${this.c(context)}/attachments/${enc(owner)}`);

  subscribe(listener: (event: HostEvent) => void): () => void {
    const abort = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`${this.url}/api/events`, { signal: abort.signal });
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) return;
          buffer += decoder.decode(value, { stream: true });
          let end: number;
          while ((end = buffer.indexOf("\n\n")) >= 0) {
            const message = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            for (const line of message.split("\n")) if (line.startsWith("data: ")) listener(JSON.parse(line.slice(6)));
          }
        }
      } catch {
        // The host went away, or the subscriber stopped listening: either way, no more events.
      }
    })();
    return () => abort.abort();
  }
}
