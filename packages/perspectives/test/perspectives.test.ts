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
const SUBJECTS = { Language: "combat", Component: "game", Deployment: "game.online" } as const;

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
    for (const { perspective, needs } of perspectives) {
      const v = view(game, perspective, needs === undefined ? {} : { subject: SUBJECTS[needs] });
      wellFormed(v);
      expect(JSON.stringify(v)).not.toMatch(/"(x|y|width|height|color)"/);
    }
  });

  it("refuses a View without the Subject it needs", () => {
    expect(() => view(game, "language")).toThrow("needs a Language");
    expect(() => view(game, "deployment", { subject: "game" })).toThrow("needs a Deployment");
  });

  it("outline: the root first, then the packages beside it, each nested, and the Configurations", () => {
    const v = view(game, "outline");
    expect(children(v, "game.system")).toEqual(["Game", "NetStack", "Link", "In-process", "Configurations"]);
    const root = "game.system/game";
    expect(children(v, `${root}/core`)).toEqual([
      "Monster",
      "Player",
      "Player.prey 0..N ⟷ Monster.hunters 0..N",
      "Monster.followers 0..N ⟷ Monster.leader 0..1",
      "all m in Monster. not m in m.^leader",
    ]);
    expect(v.items.find((item) => item.subject === "combat.combat-monster")!.detail).toBe("extends Monster, Targetable, Attacker");
    expect(v.items.find((item) => item.subject === "game.server.attack")!.detail).toBe("attack(attacker: Attacker, target: Targetable) → Damage, over Combat");
    expect(v.items.find((item) => item.subject === "game.online.client-1-attacks")!.detail).toBe("over Network (realized), then Wire (realized)");
    expect(v.items.find((item) => item.subject === "game.local.client-attacks")!.detail).toBe("over In-process");
    expect(children(v, "configurations")).toEqual(["Release"]);
  });

  it("language: Entities, what they extend, the Relationships between them, and the Interactions over it", () => {
    const v = view(game, "language", { subject: "combat" });
    expect(v.title).toBe("Combat");
    expect(v.links.filter((link) => link.kind === "extends").map((link) => `${link.source} → ${link.target}`)).toEqual([
      "combat.combat-monster → core.monster",
      "combat.combat-monster → fighting.targetable",
      "combat.combat-monster → fighting.attacker",
      "combat.combat-player → core.player",
      "combat.combat-player → fighting.attacker",
    ]);
    expect(v.links.filter((link) => link.kind === "parameter").map((link) => [link.source, link.target, link.label])).toEqual([
      ["game.server.attack", "fighting.attacker", "attacker"],
      ["game.server.attack", "fighting.targetable", "target"],
    ]);
    // Each end of a Relationship reads beside its own Entity: from a Monster, `followers` reaches 0..N Monsters, `leader` at most one.
    const pack = view(game, "language", { subject: "core" }).links.find((link) => link.subject === "core.pack")!;
    expect(pack.ends).toEqual({ source: { name: "leader", range: "0..1" }, target: { name: "followers", range: "0..N" } });
  });

  it("component: its Languages by level, its children, what they use and import", () => {
    const v = view(game, "component", { subject: "game" });
    const level = (id: string) => v.items.find((item) => item.id === id)!.level;
    expect([level("core"), level("combat"), level("game.server"), level("lib.network")]).toEqual([1, 2, 3, 0]);
    const imports = v.links.filter((link) => link.kind === "imports").map((link) => `${link.source} → ${link.target}: ${link.label}`);
    expect(imports).toContain("game.client → game.server: attack");
    expect(imports).toContain("game.server → game.physics: Physics");
  });

  it("deployment: Instances, and Connections by how they are mediated", () => {
    const v = view(game, "deployment", { subject: "game.online" });
    expect(v.items.map((item) => item.label)).toEqual(["Game", "server", "client-1", "client-2"]);
    expect(v.links.map((link) => [link.source, link.target, link.kind])).toEqual([
      ["game.online.client-1", "game.online.server", "mediated"],
      ["game.online.client-2", "game.online.server", "mediated"],
    ]);
    expect(v.links[0]!.label).toBe("attack — over Network (realized), then Wire (realized)");
  });

  it("mediation stack: Whats above their hows", () => {
    const v = view(game, "mediation-stack");
    const level = (id: string) => v.items.find((item) => item.id === id)!.level;
    expect([level("combat"), level("lib.network"), level("lib.transport")]).toEqual([0, 1, 2]);
    expect(v.links.map((link) => `${link.source} → ${link.target}: ${link.label}`)).toEqual(["combat → lib.network: Network", "combat → lib.in-process: In-process", "lib.network → lib.transport: Wire"]);
  });

  it("levels: the kernel, the Systemathic Languages, the model", () => {
    const v = view(game, "levels");
    expect(v.items.filter((item) => item.kind === "level").map((item) => item.label)).toEqual(["Kernel", "Systemathic Languages", "Model"]);
    expect(children(v, "kernel")).toContain("Relationship");
    expect(children(v, "languages/Std")).toEqual(["Deferred"]);
    expect(children(v, "languages/Mediation")).toEqual(["Medium", "Mediation"]);
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
    expect(children(v, "game.physics")).toContain("fan-in: 2");
  });
});
