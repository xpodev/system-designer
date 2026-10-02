import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HostClient, HostError, type HostEvent } from "@systemathic/host";
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
    const language = await host.apply(id, ui, "SystemEditor", "addLanguage", { system: "system", name: "Orders" });
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
    expect((await host.verify(id)).rules).toBe(10);
    const broken = await host.checkScript("from systemathic.std import *\nprofile = Profile(nothing)\n");
    expect(broken.problems[0]).toMatchObject({ line: 2, severity: "error" });
    expect((await host.symbols()).some((s) => s.name === "witnesses")).toBe(true);
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
    expect(run).toMatchObject({ profile: "standard", rules: 9, errors: 0, warnings: 1 });
    expect((await host.diagnostics(id)).map((d) => [d.kind, d.check])).toEqual([["rule", "completeness"]]);
    const v = await host.view(id, "diagnostics");
    expect(v.items.find((item) => item.id === "warnings")!.detail).toBe("1");
  }, 30_000);

  it("saves, imports from the catalog, exports, and keeps attachments", async () => {
    const dir = workspace();
    const host = nodeHost({ cwd: dir });
    const { id } = await host.create("Api");
    const { session } = await host.startSession(id, "test");
    await expect(host.save(id)).rejects.toThrow("no file yet");
    const imported = await host.importPackage(id, session, { package: "http-over-tcp" });
    expect(imported.edits).toHaveLength(6);
    await host.setAttachment(id, "ui", { zoom: 2 });
    await host.save(id, "api.json");
    const saved = JSON.parse(readFileSync(join(dir, "api.json"), "utf8"));
    expect(saved.attachments.map((a: { owner: string }) => a.owner)).toEqual(["catalog", "ui"]);
    const exported = await host.exportSelection(id, ["lib.http"], "Just HTTP", "http.json");
    expect(exported.file.design.languages.map((l) => l.id)).toEqual(["lib.http"]);
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
