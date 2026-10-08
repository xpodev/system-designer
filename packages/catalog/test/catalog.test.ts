import { readdirSync, readFileSync } from "node:fs";
import { nameOf } from "@systemathic/core";
import { diagnose } from "@systemathic/diagnoser";
import { Target, undo } from "@systemathic/editing";
import { newSystem, open } from "@systemathic/tool";
import { readSystem, writeSystem } from "@systemathic/tool-json";
import { describe, expect, it } from "vitest";
import { Catalog, closure, exportSelection, importPackage, packageOf, parsePackage } from "../src/index.js";
import { files } from "../../../scripts/build-catalog.js";

const folder = new URL("../../../catalog/", import.meta.url);
const catalog = new Catalog(
  readdirSync(folder)
    .filter((file) => file.endsWith(".systemathic.json"))
    .sort()
    .map((file) => parsePackage(JSON.parse(readFileSync(new URL(file, folder), "utf8")), "standard", file)),
);
const fresh = () => {
  const target = new Target(newSystem("Api"));
  return { target, session: target.startSession("test") };
};

describe("the standard catalog", () => {
  it("is up to date with scripts/build-catalog.ts", () => {
    for (const [name, content] of Object.entries(files())) {
      expect(readFileSync(new URL(`../../../catalog/${name}`, import.meta.url), "utf8").replace(/\r\n/g, "\n"), name).toBe(content);
    }
  });

  it("holds the standard Packages, each well-formed", () => {
    expect(catalog.packages.map((p) => p.id)).toEqual(["bytes", "ethernet", "http-over-tcp", "http", "in-process", "ip", "json", "rest", "sql", "tcp", "websocket"]);
    for (const p of catalog.packages) {
      expect(p.origin).toBe("standard");
      expect(diagnose(open(p.content)), p.id).toEqual([]);
    }
  });

  it("is searched by text and by tag", () => {
    expect(catalog.search("tcp").map((p) => p.id)).toEqual(["http-over-tcp", "tcp"]);
    expect(catalog.search("", "web").map((p) => p.id)).toEqual(["http-over-tcp", "http", "rest", "websocket"]);
    expect(catalog.tags).toContain("network");
  });
});

describe("importing", () => {
  it("copies a Package's Components in beside the root, through the SystemEditor, one Edit each", () => {
    const { target, session } = fresh();
    const result = importPackage(session, catalog.find("http")!);
    expect(result.edits.map((edit) => edit.summary)).toEqual(["addPackage pkg.http"]);
    expect(target.graph.navigate(target.context.system!, "components")).toEqual([target.context.root, "pkg.http"]);
    expect(nameOf(target.graph, "lib.http.request")).toBe("Request");
    expect(nameOf(target.graph, "pkg.http.medium")).toBe("HTTP");
    expect(diagnose(target.context)).toEqual([]);
    expect(target.context.attachments.at(-1)).toMatchObject({ owner: "catalog", data: { imported: "http" } });
  });

  it("stacks a realization on content imported before, reusing it", () => {
    const { target, session } = fresh();
    importPackage(session, catalog.find("http")!);
    const result = importPackage(session, catalog.find("http-over-tcp")!);
    expect(result.reused).toEqual(["pkg.http"]);
    expect(target.graph.ofEntity("Language")).toEqual(["lib.http", "lib.tcp"]);
    expect(target.graph.navigate("pkg.http-over-tcp", "transformations")).toEqual(["pkg.http-over-tcp.down", "pkg.http-over-tcp.up"]);
    expect(diagnose(target.context)).toEqual([]);
  });

  it("keeps ids free of clashes with what is already there, and can be undone", () => {
    const { target, session } = fresh();
    target.graph.add("Entity", "lib.http.request");
    importPackage(session, catalog.find("http")!);
    expect(target.graph.navigate("lib.http", "entities")).toContain("lib.http.request~2");
    undo(session);
    expect(target.graph.has("pkg.http")).toBe(false);
  });
});

describe("exporting a selection", () => {
  const game = open(readSystem(JSON.parse(readFileSync(new URL("../../../examples/game.systemathic.json", import.meta.url), "utf8"))).system);

  it("closes it under what it depends on", () => {
    expect([...closure(game.design, ["pkg.netstack.send"])]).toEqual(["pkg.netstack"]);
    expect([...closure(game.design, ["game.combat-over-network.down"])].sort()).toEqual(["game", "pkg.in-process", "pkg.link", "pkg.netstack"]);
  });

  it("gives a closed Package that imports back", () => {
    const content = exportSelection(game, ["pkg.link"], { name: "Link", tags: ["network"] });
    expect(diagnose(open(content))).toEqual([]);
    const file = writeSystem(content);
    expect(file.design.components.map((c) => c.id)).toEqual(["pkg.link"]);
    const { target, session } = fresh();
    importPackage(session, packageOf(readSystem(file).system, "file", "link.json"));
    expect(diagnose(target.context)).toEqual([]);
    expect(target.graph.navigate("pkg.link", "mediums")).toEqual(["pkg.link.medium"]);
  });
});
