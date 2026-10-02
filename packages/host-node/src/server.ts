/**
 * The Host over HTTP, on this machine only: a JSON API under /api, every event as Server-Sent
 * Events on /api/events, and the UI's files, if given, everywhere else. Each route is one
 * method of HostApi, so the HTTP client and the in-process Host are interchangeable.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { HostError, type HostApi } from "@systemathic/host";

type Params = Record<string, string>;
type Handler = (params: Params, body: Record<string, any>, query: URLSearchParams) => Promise<unknown>;

const C = "/api/contexts/:context";
const S = `${C}/sessions/:session`;

function routes(host: HostApi): [method: string, pattern: string, handler: Handler][] {
  return [
    ["GET", "/api/editors", () => host.editors()],
    ["GET", "/api/perspectives", () => host.perspectives()],
    ["GET", "/api/catalog", (_, __, q) => host.catalog(q.get("text") ?? undefined, q.get("tag") ?? undefined)],
    ["GET", "/api/contexts", () => host.contexts()],
    ["GET", "/api/files", () => host.files()],
    ["POST", "/api/contexts", (_, b) => host.create(String(b.name ?? "Untitled"))],
    ["POST", "/api/contexts/open", (_, b) => host.open(String(b.path))],
    ["POST", `${C}/save`, (p, b) => host.save(p.context!, b.path)],
    ["GET", `${C}/system`, (p) => host.system(p.context!)],
    ["GET", `${C}/history`, (p) => host.history(p.context!)],
    ["GET", `${C}/diagnostics`, (p) => host.diagnostics(p.context!)],
    ["GET", `${C}/views/:perspective`, (p, _, q) => host.view(p.context!, p.perspective!, q.get("language") ?? undefined)],
    ["POST", `${C}/verify`, (p, b) => host.verify(p.context!, b.script, b.profile)],
    ["GET", `${C}/specification`, (p) => host.specification(p.context!)],
    ["GET", `${C}/script`, (p) => host.script(p.context!)],
    ["PUT", `${C}/script`, (p, b) => host.saveScript(p.context!, String(b.path), String(b.source ?? ""))],
    ["POST", "/api/scripts/check", (_, b) => host.checkScript(String(b.source ?? ""))],
    ["GET", "/api/scripts/symbols", () => host.symbols()],
    ["POST", `${C}/export`, (p, b) => host.exportSelection(p.context!, b.ids ?? [], String(b.name ?? "Package"), b.path)],
    ["GET", `${C}/attachments/:owner`, (p) => host.attachment(p.context!, p.owner!)],
    ["PUT", `${C}/attachments/:owner`, (p, b) => host.setAttachment(p.context!, p.owner!, b.data ?? null)],
    ["POST", `${C}/sessions`, (p, b) => host.startSession(p.context!, String(b.client ?? "client"))],
    ["DELETE", S, (p) => host.endSession(p.context!, p.session!)],
    ["POST", `${S}/operations/:editor/:operation`, (p, b) => host.apply(p.context!, p.session!, p.editor!, p.operation!, b.args ?? {})],
    ["POST", `${S}/undo`, (p) => host.undo(p.context!, p.session!)],
    ["POST", `${S}/redo`, (p) => host.redo(p.context!, p.session!)],
    ["POST", `${S}/select`, (p, b) => host.select(p.context!, p.session!, b.ids ?? [])],
    ["POST", `${S}/import`, (p, b) => host.importPackage(p.context!, p.session!, b.package !== undefined ? { package: b.package } : { path: b.path })],
  ];
}

function match(pattern: string, path: string): Params | undefined {
  const want = pattern.split("/");
  const got = path.split("/");
  if (want.length !== got.length) return undefined;
  const params: Params = {};
  for (let i = 0; i < want.length; i++) {
    if (want[i]!.startsWith(":")) params[want[i]!.slice(1)] = decodeURIComponent(got[i]!);
    else if (want[i] !== got[i]) return undefined;
  }
  return params;
}

const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };

export interface ServeOptions {
  readonly port?: number;
  /** The UI's built files, served at /. */
  readonly ui?: string;
}

/** Serves `host` on 127.0.0.1; resolves once it listens, and rejects if it cannot, as when the port is taken. */
export function serve(host: HostApi, options: ServeOptions = {}): Promise<{ server: Server; url: string }> {
  const table = routes(host);
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    try {
      if (url.pathname === "/api/events" && request.method === "GET") return events(host, response);
      if (url.pathname.startsWith("/api/")) {
        for (const [method, pattern, handler] of table) {
          const params = request.method === method ? match(pattern, url.pathname) : undefined;
          if (!params) continue;
          const result = await handler(params, await body(request), url.searchParams);
          return send(response, 200, result ?? null);
        }
        return send(response, 404, { error: `no route ${request.method} ${url.pathname}` });
      }
      return files(options.ui, url.pathname, response);
    } catch (error) {
      const status = error instanceof HostError ? error.status : 500;
      return send(response, status, { error: (error as Error).message });
    }
  });
  return new Promise((done, fail) => {
    server.once("error", fail);
    server.listen(options.port ?? 4747, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : options.port;
      done({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

function events(host: HostApi, response: ServerResponse): void {
  response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  response.write(": connected\n\n");
  const unsubscribe = host.subscribe((event) => response.write(`data: ${JSON.stringify(event)}\n\n`));
  const keepAlive = setInterval(() => response.write(": ping\n\n"), 15_000);
  response.on("close", () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
}

async function body(request: IncomingMessage): Promise<Record<string, any>> {
  if (request.method === "GET" || request.method === "DELETE") return {};
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.trim() === "") return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HostError(400, "the request body is not JSON");
  }
}

function send(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

function files(root: string | undefined, path: string, response: ServerResponse): void {
  if (root === undefined || !existsSync(root)) {
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("The Systemathic host is running. Its API is under /api; the UI is not built (pnpm --filter @systemathic/ui build).");
    return;
  }
  const base = resolve(root);
  let file = normalize(join(base, decodeURIComponent(path)));
  if (!file.startsWith(base)) file = join(base, "index.html");
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(base, "index.html");
  response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  response.end(readFileSync(file));
}
