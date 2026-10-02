/**
 * The UI against a real host: what a person does — open a System, open its editors, edit in
 * place — and what they should see. The browser is jsdom; the host is the real one, over HTTP.
 *
 * jsdom is installed by hand on Node's globals, rather than as Vitest's environment, which would
 * rewrite the host's `new URL(…, import.meta.url)` into web addresses.
 */
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Host, HostClient, serve } from "@systemathic/host";
import { JSDOM } from "jsdom";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
const globals = globalThis as Record<string, unknown>;
for (const key of Object.getOwnPropertyNames(dom.window)) if (!(key in globalThis)) globals[key] = (dom.window as unknown as Record<string, unknown>)[key];
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}

const { act, cleanup, fireEvent, render, screen, waitFor, within } = await import("@testing-library/react");
const { App } = await import("../src/App");

const root = fileURLToPath(new URL("../../../", import.meta.url));
let url: string;
let host: Host;
let close: () => void;

/** The host's event stream, as EventSource gives it to the page. */
class HostEventSource {
  onmessage?: (message: { data: string }) => void;
  onopen?: () => void;
  onerror?: () => void;
  private readonly stop: () => void;
  constructor() {
    this.stop = new HostClient(url).subscribe((event) => this.onmessage?.({ data: JSON.stringify(event) }));
    setTimeout(() => this.onopen?.(), 0);
  }
  close() {
    this.stop();
  }
}

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "systemathic-ui-"));
  copyFileSync(join(root, "examples/game.systemathic.json"), join(dir, "game.systemathic.json"));
  host = new Host({ cwd: dir });
  const served = await serve(host, { port: 0 });
  url = served.url;
  close = () => served.server.close();
  const real = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => real(new URL(String(input), url), init)) as typeof fetch;
  globals.EventSource = HostEventSource;
  dom.window.Element.prototype.scrollIntoView = () => undefined;
});
afterAll(() => close?.());
afterEach(() => cleanup());

async function openGame() {
  const { id } = await host.open("game.systemathic.json");
  window.history.replaceState(null, "", `#${id}`);
  render(<App />);
  await waitFor(() => expect(document.querySelector(".explorer")).not.toBeNull(), { timeout: 5000 });
  // Let the page's event stream connect, so it hears of what other clients do from here on.
  await new Promise((done) => setTimeout(done, 150));
  return id;
}

const explorerRow = (label: string) =>
  [...document.querySelectorAll<HTMLElement>(".explorer .tree-row")].find((row) => row.querySelector(".tree-label")?.textContent === label)!;

describe("the UI", () => {
  it("opens a System on its overview, with its health and its parts", async () => {
    await openGame();
    expect(await screen.findByText("Well-formed")).toBeTruthy();
    expect(screen.getByText("5 Languages · 7 Domains · 2 Mediations")).toBeTruthy();
  });

  it("opens a Language from the Explorer, and edits it in place", async () => {
    const id = await openGame();
    fireEvent.click(explorerRow("Core"));
    const editor = await waitFor(() => {
      const h1 = document.querySelector(".editor-header h1");
      expect(h1?.textContent).toBe("Core");
      return h1!.closest(".editor") as HTMLElement;
    });
    const entities = () => within(editor.querySelector<HTMLElement>(".grid")!);
    expect(entities().getByText("Monster")).toBeTruthy();

    // Add an Entity by typing its name.
    fireEvent.click(within(editor).getByText("Entity", { selector: ".add-inline, .add-inline *" }));
    const input = editor.querySelector<HTMLInputElement>(".add-input")!;
    fireEvent.change(input, { target: { value: "Item" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(async () => {
      const file = await host.system(id);
      expect(file.design.languages[0]!.entities.map((e) => e.name)).toContain("Item");
    });
    await waitFor(() => expect(entities().getByText("Item")).toBeTruthy());

    // Rename it in place.
    fireEvent.click(entities().getByText("Item"));
    const rename = editor.querySelector<HTMLInputElement>(".inline-input")!;
    fireEvent.change(rename, { target: { value: "Loot" } });
    fireEvent.keyDown(rename, { key: "Enter" });
    await waitFor(() => expect(entities().getByText("Loot")).toBeTruthy());

    // Relate two Entities: the new Relationship's ends are named after them.
    fireEvent.click(within(editor).getByText("Relationship", { selector: ".add-inline, .add-inline *" }));
    await waitFor(async () => expect((await host.system(id)).design.languages[0]!.relationships).toHaveLength(3));
    const ends = (await host.system(id)).design.languages[0]!.relationships[2]!.ends.map((e) => e.name);
    expect(ends).toEqual(["monster", "players"]);
  });

  it("shows a problem where it is, and undoes it", async () => {
    const id = await openGame();
    const session = (await host.startSession(id, "mcp")).session;
    await act(async () => {
      await host.apply(id, session, "RelationshipEditor", "setRange", { end: "core.pack.leader", range: "3..1" });
    });
    await waitFor(() => expect(document.querySelector(".statusbar .status-errors")).not.toBeNull(), { timeout: 5000 });
    expect(await screen.findByText("mcp: setRange 3..1")).toBeTruthy();
    fireEvent.click(document.querySelector(".statusbar .status-errors")!);
    const problem = await screen.findByText("min <= max, where max is present");
    fireEvent.click(problem);
    await waitFor(() => expect(document.querySelector(".editor-header h1")?.textContent).toBe("Core"));
    await act(async () => {
      await host.undo(id, session);
    });
    await waitFor(() => expect(document.querySelector(".statusbar .status-errors")).toBeNull());
  });

  it("maps a Transformation's items, and shows what is missing", async () => {
    await openGame();
    fireEvent.click(explorerRow("CombatInUnity"));
    fireEvent.click(await screen.findByText("Combat as GameObjects", { selector: ".cell-main" }));
    await waitFor(() => expect(document.querySelector(".editor-header h1")?.textContent).toBe("Combat as GameObjects"));
    expect(screen.getByText(/missing, of 5 items of Combat/)).toBeTruthy();
    expect(document.querySelectorAll(".mapping-row.is-missing")).toHaveLength(2);
  });

  it("edits a Domain: what it uses, what that puts in scope, a new Transformation", async () => {
    const id = await openGame();
    fireEvent.click(explorerRow("Unity"));
    const domainRow = [...document.querySelectorAll<HTMLElement>(".explorer .tree-row")].filter((row) => row.querySelector(".tree-label")?.textContent === "Unity")[1]!;
    fireEvent.click(domainRow);
    await waitFor(() => expect(document.querySelector(".editor-kind")?.textContent).toBe("Domain"));
    const add = document.querySelectorAll<HTMLSelectElement>(".chip-add")[0]!;
    fireEvent.change(add, { target: { value: "transport" } });
    await waitFor(async () => expect((await host.system(id)).design.domains.find((d) => d.id === "d.unity")!.languages).toEqual(["unity", "transport"]));
    await waitFor(() => expect(document.querySelectorAll(".scope-item")).toHaveLength(2));
    fireEvent.click(screen.getByText("Transformation", { selector: ".add-inline, .add-inline *" }));
    const [from, to] = document.querySelectorAll<HTMLSelectElement>(".new-row .picker");
    fireEvent.change(from!, { target: { value: "unity" } });
    fireEvent.change(to!, { target: { value: "transport" } });
    fireEvent.click(screen.getByText("Create"));
    await waitFor(() => expect(document.querySelector(".editor-header h1")?.textContent).toBe("Unity as Transport"));
  });

  it("makes a Mediation's witness in one step", async () => {
    const id = await openGame();
    const session = (await host.startSession(id, "test")).session;
    await host.apply(id, session, "TransformationEditor", "remove", { transformation: "network-over-transport" });
    const mediation = await host.apply(id, session, "SystemEditor", "addMediation", { system: "game", what: "d.network", how: "d.transport", mediator: "d.network-over-transport" });
    // The new Mediation has no witness yet: once the page shows that error, it has read the change.
    await waitFor(() => expect(document.querySelector(".statusbar .status-errors")).not.toBeNull(), { timeout: 5000 });
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = await screen.findByPlaceholderText("Go to anything, or type a command…");
    fireEvent.change(input, { target: { value: "network / transport" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByText("Not witnessed.");
    fireEvent.click(screen.getByText("Create witness"));
    await waitFor(() => expect(document.querySelector(".editor-header h1")?.textContent).toBe("Network as Transport"));
    const file = await host.system(id);
    const holder = file.design.domains.find((d) => d.id === "d.network-over-transport")!;
    expect(holder.transformations.map((t) => [t.source, t.target, t.reverse !== null])).toEqual([["network", "transport", true]]);
    expect(mediation.elements[0]).toBeTruthy();
  });

  it("edits the verification script, with its rules beside it", async () => {
    await openGame();
    fireEvent.click(explorerRow("Verification script"));
    await waitFor(() => expect(document.querySelector(".cm-editor")).not.toBeNull(), { timeout: 10_000 });
    expect(document.querySelector(".cm-content")?.textContent).toContain("every_domain_uses_a_language");
    await screen.findByText("every_domain_uses_a_language", { selector: ".rule-list code" }, { timeout: 10_000 });
    fireEvent.click(screen.getByText("Save", { selector: ".editor-actions button, .editor-actions button *" }));
    await waitFor(async () => expect(await host.attachment((await host.contexts())[0]!.id, "verifier")).toEqual({ script: "game.rules.py", profile: "profile" }));
  }, 20_000);

  it("says so when the host is older than the page, rather than breaking", async () => {
    const current = globalThis.fetch;
    // An older host: no file listing, and Systems without who is editing them.
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path.startsWith("/api/files")) return new Response(JSON.stringify({ error: "no route" }), { status: 404 });
      const response = await current(input, init);
      if (path === "/api/contexts") {
        const contexts = (await response.json()) as Record<string, unknown>[];
        return new Response(JSON.stringify(contexts.map(({ clients: _c, dirty: _d, ...rest }) => rest)));
      }
      return response;
    }) as typeof fetch;
    try {
      window.history.replaceState(null, "", "#");
      render(<App />);
      await screen.findByText(/older than the page/);
      expect(await screen.findByText("Open now")).toBeTruthy();
    } finally {
      globalThis.fetch = current;
    }
  });

  it("goes anywhere from the command palette", async () => {
    await openGame();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = await screen.findByPlaceholderText("Go to anything, or type a command…");
    fireEvent.change(input, { target: { value: "network / transport" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(document.querySelector(".editor-header h1")?.textContent).toBe("Network / Transport"));
    expect(screen.getByText("Witnessed")).toBeTruthy();
  });

  it("verifies, and shows the result", async () => {
    await openGame();
    fireEvent.click(document.querySelector(".system-row")!);
    fireEvent.click(await screen.findByText("Verify", { selector: ".health-card button" }));
    await screen.findByText(/^0 rule errors, \d+ warnings?$/, {}, { timeout: 15000 });
  }, 20_000);
});
