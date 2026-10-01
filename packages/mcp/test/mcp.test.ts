import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Host } from "@systemathic/host";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/index.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));

async function connected() {
  const dir = mkdtempSync(join(tmpdir(), "systemathic-mcp-"));
  copyFileSync(join(root, "examples/game.systemathic.json"), join(dir, "game.json"));
  const host = new Host({ cwd: dir });
  const server = await createServer(host);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
    const text = result.content[0]!.text;
    let value: unknown = text;
    try {
      value = JSON.parse(text);
    } catch {
      // plain text
    }
    return { error: result.isError === true, value: value as any };
  };
  return { host, client, call };
}

describe("MCP server", () => {
  it("offers a tool for every editor operation, with schemas from their descriptors", async () => {
    const { host, client } = await connected();
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);
    for (const op of await host.editors()) expect(names).toContain(`${op.editor}_${op.name}`);
    expect(names).toEqual(expect.arrayContaining(["open_system", "view", "verify", "diagnostics", "import_package", "undo"]));
    const addEntity = tools.find((tool) => tool.name === "LanguageEditor_addEntity")!;
    expect(addEntity.inputSchema.required).toEqual(["context", "language", "name"]);
  });

  it("lets a model open, edit, read, check and undo a System", async () => {
    const { call } = await connected();
    const opened = await call("open_system", { path: "game.json" });
    const context = opened.value.id;
    const added = await call("LanguageEditor_addEntity", { context, language: "core", name: "Item" });
    expect(added.value).toMatchObject({ client: "mcp", summary: "addEntity Item" });
    const outline = await call("view", { context, perspective: "outline" });
    expect(outline.value.items.some((item: { label: string }) => item.label === "Item")).toBe(true);
    await call("RelationshipEditor_setRange", { context, end: "core.pack.leader", range: "2..1" });
    const diagnostics = await call("diagnostics", { context });
    expect(diagnostics.value[0]).toMatchObject({ check: "W2", suggestions: [{ message: "Make the end's min at most its max" }] });
    expect((await call("verify", { context })).error).toBe(true);
    await call("undo", { context });
    expect((await call("diagnostics", { context })).value).toEqual([]);
  });

  it("answers a bad request with an error the model can read", async () => {
    const { call } = await connected();
    const { value } = await call("new_system", { name: "Shop" });
    const result = await call("LanguageEditor_addEntity", { context: value.id, language: "nothing", name: "X" });
    expect(result).toEqual({ error: true, value: "LanguageEditor.addEntity: language: expected the id of a Language, got \"nothing\"" });
  });

  it("imports from the catalog, and lists Views as resources", async () => {
    const { client, call } = await connected();
    const { value } = await call("new_system", { name: "Api" });
    expect((await call("search_catalog", { tag: "web" })).value.map((p: { id: string }) => p.id)).toContain("http");
    expect((await call("import_package", { context: value.id, package: "http" })).value.edits).toHaveLength(2);
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toContain(`systemathic://${value.id}/views/domain-map`);
    const read = await client.readResource({ uri: `systemathic://${value.id}/views/domain-map` });
    expect(JSON.parse((read.contents[0] as { text: string }).text).items.map((i: { label: string }) => i.label)).toEqual(["HTTP", "HTTP"]);
  });
});
