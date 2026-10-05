import { readFileSync } from "node:fs";
import { diagnose } from "@systemathic/diagnoser";
import { open } from "@systemathic/tool";
import { readSystem } from "@systemathic/tool-json";
import { describe, expect, it } from "vitest";
import { perspectives, view, type View } from "../src/index.js";

const examples = new URL("../../../examples/", import.meta.url);
const context = (path: string) => open(readSystem(JSON.parse(readFileSync(new URL(path, examples), "utf8"))).system);
const game = context("game.systemathic.json");
const label = (v: View, id: string) => v.items.find((item) => item.id === id)?.label;
const children = (v: View, id: string) => v.items.find((item) => item.id === id)!.children.map((child) => label(v, child));

/** Every View is well-formed: links and children stay in the View, and no Item is its own ancestor. */
function wellFormed(v: View): void {
  const ids = new Set(v.items.map((item) => item.id));
  expect(ids.size).toBe(v.items.length);
  for (const link of v.links) expect(ids.has(link.source) && ids.has(link.target)).toBe(true);
  for (const item of v.items) {
    for (const child of item.children) expect(v.items.find((i) => i.id === child)!.parent).toBe(item.id);
    const seen = new Set<string>();
    for (let at: string | undefined = item.id; at !== undefined; at = v.items.find((i) => i.id === at)!.parent) {
      expect(seen.has(at)).toBe(false);
      seen.add(at);
    }
  }
}

describe("perspectives", () => {
  it("every perspective gives a well-formed View, without positions", () => {
    for (const { perspective } of perspectives) {
      const v = view(game, perspective, { language: "core" });
      wellFormed(v);
      expect(JSON.stringify(v)).not.toMatch(/"(x|y|width|height|color)"/);
    }
  });

  it("outline: Languages and their contents, Domains, Mediations", () => {
    const v = view(game, "outline");
    expect(children(v, "game")).toEqual(["Languages", "Domains", "Mediations"]);
    expect(children(v, "languages/core")).toEqual([
      "Monster",
      "Player",
      "Player.prey 0..N ⟷ Monster.hunters 0..N",
      "Monster.followers 0..N ⟷ Monster.leader 0..1",
      "all m in Monster. not m in m.^leader",
    ]);
    expect(v.items.find((item) => item.subject === "combat.attack")!.detail).toBe("attack(attacker: Attacker, target: Targetable) → Damage");
    expect(children(v, "mediations")).toEqual(["Combat / Unity", "Network / Transport"]);
  });

  it("language: Entities linked by Relationships, Interactions by their Parameters", () => {
    const v = view(game, "language", { language: "combat" });
    expect(v.title).toBe("Combat");
    expect(v.links.filter((link) => link.kind === "parameter").map((link) => [link.source, link.target, link.label])).toEqual([
      ["combat.attack", "combat.attacker", "attacker"],
      ["combat.attack", "combat.targetable", "target"],
    ]);
    expect(() => view(game, "language")).toThrow("needs a Language");
    // Each end of a Relationship reads beside its own Entity: from a Monster, `followers` reaches 0..N Monsters, `leader` at most one.
    const pack = view(game, "language", { language: "core" }).links.find((link) => link.subject === "core.pack")!;
    expect(pack.ends).toEqual({ source: { name: "leader", range: "0..1" }, target: { name: "followers", range: "0..N" } });
  });

  it("domain map: what Domains use and reference, and the Transformations between Languages", () => {
    const v = view(game, "domain-map");
    const links = (kind: string) => v.links.filter((link) => link.kind === kind).map((link) => `${link.source} → ${link.target}`);
    expect(links("references")).toEqual(["d.combat → d.core", "d.network → d.core"]);
    expect(links("projection")).toEqual(["core → combat", "core → network"]);
    expect(links("mediation")).toEqual(["combat → unity", "network → transport"]);
  });

  it("mediation stack: whats above their hows", () => {
    const v = view(game, "mediation-stack");
    const level = (id: string) => v.items.find((item) => item.id === id)!.level;
    expect([level("d.combat"), level("d.unity")]).toEqual([0, 1]);
    expect(v.links.map((link) => link.label)).toEqual(["CombatInUnity", "NetworkOverTransport"]);
  });

  it("levels: the kernel, the Systemathic Languages, the model", () => {
    const v = view(game, "levels");
    expect(v.items.filter((item) => item.kind === "level").map((item) => item.label)).toEqual(["Kernel", "Systemathic Languages", "Model"]);
    expect(children(v, "kernel")).toContain("Relationship");
    expect(children(v, "languages/Std")).toEqual(["Deferred"]);
  });

  it("diagnostics: grouped, with subjects and suggestions, and marks where they are", () => {
    const broken = context("broken/w3.systemathic.json");
    const v = view(broken, "diagnostics");
    const structural = v.items.find((item) => item.id === "structural")!;
    expect(structural.detail).toBe(String(diagnose(broken).length));
    const first = v.items.find((item) => item.id === structural.children[0])!;
    expect(first.marks[0]).toMatchObject({ check: "W3" });
    expect(first.children.map((child) => v.items.find((item) => item.id === child)!.kind)).toContain("suggestion");
    const outline = view(broken, "outline");
    expect(outline.items.filter((item) => item.marks.length > 0).map((item) => item.kind)).toContain("End");
  });

  it("statistics: one Item per Subject, a child per Measure", () => {
    const v = view(game, "statistics");
    expect(children(v, "d.combat")).toContain("effective languages: 2");
  });
});
