import { ComponentEditor } from "@systemathic/editors";
import { NotASystem, newSystem, save, type MetadataProvider, type Repository, type ToolSystem } from "@systemathic/tool";
import { describe, expect, it } from "vitest";
import { Workspace } from "../src/index.js";

/** Systems kept in memory, by key: a Repository that is not files at all. */
function memory(): Repository & { stored: Map<string, ToolSystem>; said: string[] } {
  const stored = new Map<string, ToolSystem>();
  const said: string[] = [];
  return {
    stored,
    said,
    resolve: (location) => location.toLowerCase(),
    async open(location) {
      if (location === "junk") throw new NotASystem("not a System");
      const system = stored.get(location);
      return system === undefined ? undefined : { system, problems: [] };
    },
    async save(system, location) {
      said.push(`repository ${location}`);
      stored.set(location, system);
      return location;
    },
  };
}

describe("the Workspace", () => {
  it("opens through the Repository and asks every provider to load; one location is one open System", async () => {
    const repository = memory();
    repository.stored.set("shop", save(newSystem("Shop")));
    const loaded: (string | undefined)[] = [];
    const provider: MetadataProvider = { load: async (_, location) => void loaded.push(location), save: async () => {} };
    const workspace = new Workspace(repository, [provider], []);
    const { system } = (await workspace.open("Shop"))!;
    expect(system.location).toBe("shop");
    expect(loaded).toEqual(["shop"]);
    expect((await workspace.open("SHOP"))!.system).toBe(system);
    expect(loaded).toEqual(["shop"]);
    expect(await workspace.open("nothing")).toBeUndefined();
    await expect(workspace.open("junk")).rejects.toThrow(NotASystem);
  });

  it("saves by asking every provider to save into a copy, then writing the copy through the Repository", async () => {
    const repository = memory();
    const provider: MetadataProvider = {
      load: async () => {},
      async save(copy, location) {
        repository.said.push(`provider ${location}`);
        copy.attach({ owner: "note", data: "saved" });
      },
    };
    const connected: string[] = [];
    const workspace = new Workspace(repository, [provider], [(target) => void connected.push(target.context.system!)]);
    const system = await workspace.new("Shop");
    expect(connected).toEqual(["system"]);
    await expect(workspace.save(system)).rejects.toThrow();
    ComponentEditor.addLanguage(system.target.startSession("test"), "system.root", "Catalog");
    expect(await workspace.save(system, "Shop")).toBe("shop");
    expect(repository.said).toEqual(["provider shop", "repository shop"]);
    expect(repository.stored.get("shop")!.attachments).toEqual([{ owner: "note", data: "saved" }]);
    expect(system.target.context.attachments).toEqual([]);
    expect(system).toMatchObject({ location: "shop", saved: 1 });
  });
});
