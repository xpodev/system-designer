import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HostClient, HostError, STANDARD_EDITORS, STANDARD_PROVIDERS, type HostEvent, type MetadataProvider } from "@systemathic/host";

import type { Operation } from "@systemathic/editors";
import { nodeHost, serve } from "../src/index.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));

function workspace() {
  const dir = mkdtempSync(join(tmpdir(), "systemathic-host-"));
  copyFileSync(join(root, "examples/game.systemathic.json"), join(dir, "game.json"));
  return dir;
}

describe("Host", () => {
  it("is one authority per file: opening it twice gives the same system context", async () => {
    const host = nodeHost({ cwd: workspace() });
    const a = await host.open("game.json");
    const b = await host.open("./game.json");
    expect(b.id).toBe(a.id);
    expect(a).toMatchObject({ name: "Game", structuralErrors: 0, problems: [] });
  });

  it("applies every client's Edits in one order, and tells every subscriber", async () => {
    const host = nodeHost({ cwd: workspace() });
    const { id } = await host.create("Shop");
    const events: HostEvent[] = [];
    host.subscribe((event) => events.push(event));
    const ui = (await host.startSession(id, "ui")).session;
    const llm = (await host.startSession(id, "mcp")).session;
    const language = await host.apply(id, ui, "ComponentEditor", "addLanguage", { component: "system.root", name: "Orders" });
    await host.apply(id, llm, "LanguageEditor", "addEntity", { language: language.elements[0], name: "Order" });
    expect((await host.history(id)).map((e) => [e.id, e.client, e.summary])).toEqual([
      [1, "ui", "addLanguage Orders"],
      [2, "mcp", "addEntity Order"],
    ]);
    expect(events.filter((e) => e.type === "edit").length).toBe(2);
    expect((await host.undo(id, ui))!.reverts).toBe(1);
    expect(await host.undo(id, ui)).toBeNull();
  });

  it("says who is editing, whether there is anything unsaved, and which System files there are", async () => {
    const host = nodeHost({ cwd: workspace() });
    expect(await host.files()).toEqual([]);
    const { id } = await host.open("game.json");
    const { session } = await host.startSession(id, "ui");
    await host.startSession(id, "mcp");
    expect((await host.contexts())[0]).toMatchObject({ clients: ["ui", "mcp"], dirty: false });
    await host.apply(id, session, "LanguageEditor", "addEntity", { language: "core", name: "Item" });
    expect((await host.contexts())[0]!.dirty).toBe(true);
    await host.undo(id, session);
    expect((await host.redo(id, session))!.summary).toBe("redo addEntity Item");
    await host.save(id, "saved.systemathic.json");
    expect((await host.contexts())[0]!.dirty).toBe(false);
    expect(await host.files()).toEqual(["saved.systemathic.json"]);
    await host.endSession(id, session);
    expect((await host.contexts())[0]!.clients).toEqual(["mcp"]);
  });

  it("edits the verification script: a template to start, saved as the System's profile, checked as it is written", async () => {
    const dir = workspace();
    const host = nodeHost({ cwd: dir });
    const { id } = await host.open("game.json");
    const fresh = await host.script(id);
    expect(fresh).toMatchObject({ path: "game.rules.py", profile: "profile", exists: false });
    expect((await host.checkScript(fresh.source)).problems).toEqual([]);
    await host.saveScript(id, fresh.path, fresh.source);
    expect(await host.attachment(id, "verifier")).toEqual({ script: "game.rules.py", profile: "profile" });
    expect(await host.script(id)).toMatchObject({ path: "game.rules.py", exists: true, source: fresh.source });
    expect((await host.verify(id)).rules).toBe(12);
    const broken = await host.checkScript("from systemathic.std import *\nprofile = Profile(nothing)\n");
    expect(broken.problems[0]).toMatchObject({ line: 2, severity: "error" });
    expect((await host.symbols()).some((s) => s.name === "mediation_primitives")).toBe(true);
  }, 30_000);

  it("asks every Metadata Provider when a System is opened and saved; each keeps its metadata its own way", async () => {
    const dir = workspace();
    // Notes kept in a file of their own beside the System, not in its attachments.
    const notes = new Map<object, string>();
    const beside = (location: string) => join(dir, location.replace(/\.json$/, ".notes.txt"));
    const notesProvider: MetadataProvider = {
      async load(context, location) {
        if (location !== undefined && existsSync(beside(location))) notes.set(context, readFileSync(beside(location), "utf8"));
      },
      async save(system, location) {
        if (location !== undefined) writeFileSync(beside(location), "saved with the System");
      },
    };
    const host = nodeHost({ cwd: dir, providers: [...STANDARD_PROVIDERS, notesProvider] });
    const { id } = await host.open("game.json");
    const { session } = await host.startSession(id, "ui");
    await host.apply(id, session, "DocumentationEditor", "describe", { subject: "game.server", text: "Runs the game." });
    await host.save(id, "copy.json");
    expect(readFileSync(join(dir, "copy.notes.txt"), "utf8")).toBe("saved with the System");
    const file = JSON.parse(readFileSync(join(dir, "copy.json"), "utf8"));
    expect(file.attachments.map((a: { owner: string }) => a.owner)).not.toContain("notes");
    expect(file.attachments.find((a: { owner: string }) => a.owner === "documentation").data.descriptions["game.server"]).toBe("Runs the game.");
    const reopened = nodeHost({ cwd: dir, providers: [notesProvider] });
    await reopened.open("copy.json");
    expect([...notes.values()]).toEqual(["saved with the System"]);
  });

  it("offers the operations of every editor it is given, its own and others' alike", async () => {
    const touched: string[] = [];
    const markEditor: Operation[] = [
      {
        editor: "MarkEditor",
        name: "mark",
        about: "Marks a Component.",
        kind: "change",
        parameters: [{ name: "component", kind: "element", of: ["Component"], about: "the Component" }],
        run: (session, args) => session.edit("change", "mark", [args.component as string], () => void touched.push(args.component as string)),
      },
    ];
    const host = nodeHost({ cwd: workspace(), editors: [...STANDARD_EDITORS, markEditor] });
    const { id } = await host.open("game.json");
    const { session } = await host.startSession(id, "ui");
    expect((await host.editors()).some((o) => o.editor === "MarkEditor" && o.name === "mark")).toBe(true);
    expect((await host.apply(id, session, "MarkEditor", "mark", { component: "game.server" })).summary).toBe("mark");
    expect(touched).toEqual(["game.server"]);

    const bare = nodeHost({ cwd: workspace(), editors: [markEditor] });
    const opened = await bare.open("game.json");
    expect((await bare.editors()).map((o) => o.editor)).toEqual(["MarkEditor"]);
    await expect(bare.apply(opened.id, (await bare.startSession(opened.id, "ui")).session, "DocumentationEditor", "describe", { subject: "game.server", text: "x" })).rejects.toThrow(HostError);
  });

  it("keeps a Log of who did what, if told to, saved with the System, which outlives its History", async () => {
    const dir = workspace();
    const host = nodeHost({ cwd: dir });
    const { id } = await host.open("game.json");
    const { session } = await host.startSession(id, "ui");
    await host.apply(id, session, "LanguageEditor", "addEntity", { language: "core", name: "Gem" });
    expect(await host.log(id)).toEqual({ kept: false, entries: [] });
    await host.keepLog(id, true);
    await host.apply(id, session, "LanguageEditor", "addEntity", { language: "core", name: "Item" });
    await host.undo(id, session);
    expect((await host.log(id)).entries.map((entry) => [entry.client, entry.role, entry.summary])).toEqual([
      ["ui", "do", "addEntity Item"],
      ["ui", "undo", "undo addEntity Item"],
    ]);
    await host.save(id);
    const again = nodeHost({ cwd: dir });
    const reopened = await again.open("game.json");
    expect(await again.history(reopened.id)).toEqual([]);
    expect((await again.log(reopened.id)).entries.map((entry) => entry.summary)).toEqual(["addEntity Item", "undo addEntity Item"]);
    await again.keepLog(reopened.id, false);
    await again.save(reopened.id);
    expect(JSON.parse(readFileSync(join(dir, "game.json"), "utf8")).attachments.map((a: { owner: string }) => a.owner)).not.toContain("log");
  });

  it("keeps the script named from the System's file, wherever the System is saved", async () => {
    const dir = workspace();
    mkdirSync(join(dir, "sub"));
    copyFileSync(join(dir, "game.json"), join(dir, "sub/game.json"));
    const host = nodeHost({ cwd: dir });
    const { id } = await host.open("sub/game.json");
    const fresh = await host.script(id);
    expect(fresh.path).toBe("sub/game.rules.py");
    await host.saveScript(id, fresh.path, fresh.source);
    expect(await host.attachment(id, "verifier")).toEqual({ script: "game.rules.py", profile: "profile" });
    await host.save(id, "elsewhere/moved.json");
    expect(await host.attachment(id, "verifier")).toEqual({ script: "../sub/game.rules.py", profile: "profile" });
    expect(JSON.parse(readFileSync(join(dir, "elsewhere/moved.json"), "utf8")).attachments).toContainEqual({ owner: "verifier", data: { script: "../sub/game.rules.py", profile: "profile" } });
    expect(await host.script(id)).toMatchObject({ path: "sub/game.rules.py", exists: true });
    expect((await host.verify(id)).script).toBe("sub/game.rules.py");
  }, 30_000);

  it("refuses malformed requests, never ill-formed results", async () => {
    const host = nodeHost({ cwd: workspace() });
    const { id } = await host.open("game.json");
    const { session } = await host.startSession(id, "test");
    await expect(host.apply(id, session, "LanguageEditor", "addEntity", { language: "nothing", name: "X" })).rejects.toThrow(HostError);
    await expect(host.apply(id, session, "Nope", "nope", {})).rejects.toMatchObject({ status: 404 });
    await host.apply(id, session, "RelationshipEditor", "setRange", { end: "core.pack.leader", range: "3..1" });
    expect((await host.contexts())[0]!.structuralErrors).toBe(1);
    await expect(host.verify(id)).rejects.toMatchObject({ status: 409 });
    await expect(host.specification(id)).rejects.toMatchObject({ status: 409 });
  });

  it("verifies, and shows the Violations with the structural Diagnostics", async () => {
    const host = nodeHost({ cwd: workspace() });
    const { id } = await host.open("game.json");
    const run = await host.verify(id);
    expect(run).toMatchObject({ profile: "standard", rules: 11, errors: 0, warnings: 0 });
    expect(await host.diagnostics(id)).toEqual([]);
    const { session } = await host.startSession(id, "test");
    await host.apply(id, session, "ComponentEditor", "import", { component: "game.physics", item: "game.server" });
    await host.verify(id);
    expect((await host.diagnostics(id)).map((d) => [d.kind, d.check])).toEqual([["rule", "imports_acyclic"]]);
    const v = await host.view(id, "diagnostics");
    expect(v.items.find((item) => item.id === "warnings")!.detail).toBe("1");
    await expect(host.view(id, "component")).rejects.toMatchObject({ status: 400 });
    expect((await host.view(id, "component", "game")).title).toBe("Game");
  }, 30_000);

  it("saves, imports from the catalog, exports, and keeps attachments", async () => {
    const dir = workspace();
    const host = nodeHost({ cwd: dir });
    const { id } = await host.create("Api");
    const { session } = await host.startSession(id, "test");
    await expect(host.save(id)).rejects.toThrow("no file yet");
    const imported = await host.importPackage(id, session, { package: "http-over-tcp" });
    expect(imported.edits).toHaveLength(3);
    await host.setAttachment(id, "ui", { zoom: 2 });
    await host.save(id, "api.json");
    const saved = JSON.parse(readFileSync(join(dir, "api.json"), "utf8"));
    expect(saved.attachments.map((a: { owner: string }) => a.owner)).toEqual(["catalog", "ui"]);
    const exported = await host.exportSelection(id, ["lib.http"], "Just HTTP", "http.json");
    expect([exported.file.design.root.id, ...exported.file.design.packages.map((c) => c.id)]).toEqual(["pkg.http"]);
    expect((await host.specification(id)).markdown).toMatch(/^# Api\n/);
  });
});

describe("Host over HTTP", () => {
  let url: string;
  let close: () => void;
  beforeAll(async () => {
    const served = await serve(nodeHost({ cwd: workspace() }), { port: 0 });
    url = served.url;
    close = () => served.server.close();
  });
  afterAll(() => close());

  it("serves the same API: two clients edit one System and see each other's Edits", async () => {
    const ui = new HostClient(url);
    const llm = new HostClient(url);
    expect(await HostClient.reachable(url)).toBe(true);
    const { id } = await ui.open("game.json");
    const seen: HostEvent[] = [];
    const stop = ui.subscribe((event) => seen.push(event));
    await new Promise((done) => setTimeout(done, 100));
    const s1 = (await ui.startSession(id, "ui")).session;
    const s2 = (await llm.startSession((await llm.open("game.json")).id, "mcp")).session;
    await llm.apply(id, s2, "LanguageEditor", "addEntity", { language: "core", name: "Item" });
    await ui.apply(id, s1, "EntityEditor", "rename", { entity: "core.item", name: "Loot" });
    for (let i = 0; i < 50 && seen.filter((e) => e.type === "edit").length < 2; i++) await new Promise((done) => setTimeout(done, 20));
    stop();
    expect(seen.filter((e) => e.type === "edit").map((e) => (e.type === "edit" ? e.edit.client : ""))).toEqual(["mcp", "ui"]);
    const outline = await llm.view(id, "outline");
    expect(outline.items.some((item) => item.label === "Loot")).toBe(true);
  });

  it("answers errors with their status", async () => {
    const client = new HostClient(url);
    await expect(client.view("c999", "outline")).rejects.toMatchObject({ status: 404 });
    await expect(client.open("missing.json")).rejects.toMatchObject({ status: 404 });
    expect((await client.editors()).length).toBeGreaterThan(40);
  });
});
