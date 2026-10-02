/**
 * The Host as a browser tab has it, run in Node: kept files in memory instead of IndexedDB, and
 * Python in WebAssembly in this thread instead of a Worker. Everything else is the page's own.
 */
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { InProcess, RuleRunner } from "@systemathic/pyodide-host";
import { describe, expect, it } from "vitest";
import { browserHost, exampleFiles, MemoryStore, normalize, pythonSources, standardCatalog } from "../src/index.js";

const pyodideFolder = dirname(createRequire(import.meta.url).resolve("pyodide/package.json")) + "/";
const channel = new InProcess(RuleRunner.load(pythonSources, pyodideFolder));
const fresh = () => browserHost({ store: new MemoryStore(), channel });

describe("a browser tab's host", () => {
  it("starts a new visitor with the examples, and carries the catalog and the Python package", async () => {
    expect(Object.keys(exampleFiles).sort()).toEqual(["examples/game.systemathic.json", "examples/tool-design.rules.py", "examples/tool-design.systemathic.json"]);
    expect(JSON.parse(exampleFiles["examples/game.systemathic.json"]!).attachments.map((a: { owner: string }) => a.owner)).not.toContain("ui");
    expect(standardCatalog().packages).toHaveLength(10);
    expect(Object.keys(pythonSources)).toEqual(expect.arrayContaining(["core.py", "std.py", "host.py", "assist.py", "_schema.py"]));
    const host = await fresh();
    expect(await host.files()).toEqual(["examples/game.systemathic.json", "examples/tool-design.systemathic.json"]);
  });

  it("names a file one way, however it is written", () => {
    expect(normalize("./examples//game.json")).toBe("examples/game.json");
    expect(normalize("examples\\..\\game.json")).toBe("game.json");
  });

  it("opens, edits and keeps a System in the browser", async () => {
    const store = new MemoryStore();
    const host = await browserHost({ store, channel });
    const { id } = await host.open("examples/game.systemathic.json");
    const { session } = await host.startSession(id, "ui");
    await host.apply(id, session, "LanguageEditor", "addEntity", { language: "core", name: "Item" });
    await host.save(id);
    const kept = JSON.parse((await store.get("examples/game.systemathic.json"))!);
    expect(kept.design.languages[0].entities.map((e: { name: string }) => e.name)).toContain("Item");
    await host.save(id, "mine/game.systemathic.json");
    expect(await host.files()).toContain("mine/game.systemathic.json");
  });

  it("verifies with the tool design's own rules, in WebAssembly", async () => {
    const host = await fresh();
    const { id } = await host.open("examples/tool-design.systemathic.json");
    const run = await host.verify(id, "examples/tool-design.rules.py");
    expect(run).toMatchObject({ profile: "profile", rules: 16, errors: 0, failures: [] });
  }, 120_000);

  it("edits a System's script, and checks it as it is written", async () => {
    const host = await fresh();
    const { id } = await host.open("examples/game.systemathic.json");
    const script = await host.script(id);
    expect(script).toMatchObject({ path: "examples/game.rules.py", exists: false });
    await host.saveScript(id, script.path, script.source);
    expect((await host.verify(id)).rules).toBe(10);
    expect((await host.checkScript("profile = Profile(\n")).problems[0]!.message).toMatch(/^SyntaxError/);
  }, 120_000);

  it("imports from the bundled catalog", async () => {
    const host = await fresh();
    const { id } = await host.create("Api");
    const { session } = await host.startSession(id, "ui");
    expect((await host.importPackage(id, session, { package: "http-over-tcp" })).edits).toHaveLength(6);
  });
});
