import { readFileSync } from "node:fs";
import { open } from "@systemathic/tool";
import { readSystem } from "@systemathic/tool-json";
import type { Profile } from "@systemathic/verifier";
import { describe, expect, it } from "vitest";
import { counted, document, documentationMarkdown, fromJson, fromMarkdown, quantity, reading, specify, toJson, toMarkdown } from "../src/index.js";

const examples = new URL("../../../examples/", import.meta.url);
const context = (path: string) => open(readSystem(JSON.parse(readFileSync(new URL(path, examples), "utf8"))).system);
const profile: Profile = {
  name: "profile",
  script: { path: "rules.py" },
  rules: [{ name: "opacity", severity: "error", about: "Every mediated Connection is opaque.", script: "std" }],
};

describe("specification", () => {
  const spec = specify(context("game.systemathic.json"), profile);
  const all = (sections = spec.sections): { id: string; text: string }[] =>
    sections.flatMap((section) => [...section.statements, ...all(section.sections)]);
  const text = (id: string) => all().find((s) => s.id === id)?.text;

  it("states each Language's vocabulary, and what it extends", () => {
    expect(text("relationship:core.pack")).toBe("Relationship Monster (end 'leader', 0..1) <——> Monster (end 'followers', 0..N): Monster.followers; Monster.leader.");
    expect(text("extends:combat")).toBe("Extends Core, Fighting: its vocabulary is its own and theirs.");
    expect(text("entity:combat.combat-player")).toBe("Entity CombatPlayer, extending Player, Attacker: each of its instances is one of theirs.");
  });

  it("states what each Component may use, imports and offers, and how its Deployments connect its parts", () => {
    expect(text("interaction:game.server.attack")).toBe("Interaction attack(attacker: Attacker, target: Targetable): Damage, over Combat.");
    expect(text("transformation:game.combat-over-network.down")).toBe("Transformation Combat down to Network(monster: CombatMonster): EntityId: from Combat to Network.");
    expect(text("scope:game.combat-over-network")).toBe("May use exactly the Languages Core, Fighting, Combat, Network, and nothing else.");
    expect(text("imports:game.client")).toBe(
      "Imports the Components Physics, CombatOverNetwork, NetworkOverWire, In-process; the Interactions attack; the Transformations none; the Mediums none; it reaches nothing else of any other Component.",
    );
    expect(text("connection:game.online.client-1-attacks")).toBe(
      "In Online, client-1 uses attack of server; it passes over Network (down by Combat down to Network, up by Network up to Combat), then Wire (down by Network down to Transport, up by Transport up to Network).",
    );
    expect(text("medium:pkg.netstack.medium")).toBe("Medium Network: a What passes over Network, through send.");
  });

  it("nests Components as sections, the packages apart", () => {
    expect(spec.sections.map((s) => s.title)).toEqual(["Component Game", "Packages"]);
    expect(spec.sections[1]!.sections.map((s) => s.title)).toEqual(["Component NetStack", "Component Link", "Component In-process"]);
  });

  it("has the profile's rules as Requirements, and O1–O4 as Obligations for specific Subjects", () => {
    expect(spec.requirements).toEqual([{ id: "R:opacity", rule: "opacity", severity: "error", about: "Every mediated Connection is opaque.", script: "std" }]);
    const kinds = (kind: string) => spec.obligations.filter((o) => o.kind === kind).map((o) => o.id);
    expect(kinds("O1")).toEqual(["O1:core", "O1:fighting", "O1:combat", "O1:lib.network", "O1:lib.transport", "O1:lib.in-process"]);
    expect(kinds("O2")).toEqual(["O2:game.combat-over-network.down", "O2:game.network-over-wire.down"]);
    expect(kinds("O4")).toEqual(["O4:combat.combat-monster", "O4:combat.combat-player"]);
  });
});

describe("representations", () => {
  it("Markdown reads back into the Specification it came from", () => {
    const spec = specify(context("game.systemathic.json"), profile);
    expect(fromMarkdown(toMarkdown(spec))).toEqual(spec);
  });

  it("Markdown is for reading: headings and items led by their ids", () => {
    const markdown = toMarkdown(specify(context("game.systemathic.json")));
    expect(markdown).toMatch(/^# Game\n/);
    expect(markdown).toContain("### Language Core {#language:core}");
    expect(markdown).toContain("- [entity:core.monster] Entity Monster. <!-- core.monster -->");
  });

  it("JSON reads back too", () => {
    const spec = specify(context("game.systemathic.json"), profile);
    expect(fromJson(JSON.parse(JSON.stringify(toJson(spec))))).toEqual(spec);
    expect(() => fromJson({})).toThrow("not a specification");
  });
});

describe("documentation", () => {
  const file = JSON.parse(readFileSync(new URL("game.systemathic.json", examples), "utf8"));
  // Descriptions are the Documentation tool context's, kept beside the design as its attachment.
  file.attachments.push({
    owner: "documentation",
    data: { descriptions: { "game.system": "A small game.\n\nMonsters, and those who fight them.", "core.player": "Plays the game.", "core.hunts": "Who hunts whom.", "core.gone": "Of nothing there." } },
  });
  const documented = open(readSystem(file).system);
  const rules: Profile = { ...profile, rules: [{ ...profile.rules[0]!, doc: "Every mediated Connection is opaque.\n\nSo the how can be swapped." }] };
  const doc = document(documented, rules);

  it("reads each Relationship both ways, as what each side has of the other", () => {
    const [hunts, pack] = doc.components[0]!.languages[0]!.relationships;
    expect(hunts!.name).toBe("Player.prey ⟷ Monster.hunters");
    expect(hunts!.description).toBe("Who hunts whom.");
    expect(hunts!.navigations.map((n) => n.reading)).toEqual(["Each Player has any number of Monsters, as prey.", "Each Monster has any number of Players, as hunters."]);
    expect(pack!.navigations.map((n) => n.reading)).toEqual(["Each Monster has any number of Monsters, as followers.", "Each Monster has at most one Monster, as leader."]);
  });

  it("says how many in words", () => {
    expect([quantity(1, 1), quantity(0, 1), quantity(0, null), quantity(1, null), quantity(2, 5), quantity(3, 3)]).toEqual([
      "exactly one", "at most one", "any number of", "one or more", "2 to 5", "exactly 3",
    ]);
    expect(reading("Order", null, "Box", 1, null)).toBe("Each Order has one or more Boxes, but cannot navigate to them.");
    expect(counted("Category", 2)).toBe("Categories");
  });

  it("is a Markdown document, with every Description, Component by Component, and the rules' documentation", () => {
    const markdown = documentationMarkdown(doc);
    expect(markdown).toMatch(/^# Game\n\nA small game\.\n\nMonsters, and those who fight them\.\n\nThis System has 7 Components, and 3 packages beside its root\.\n/);
    expect(markdown).toContain("### Core — a core Language\n");
    expect(markdown).toContain("### Combat — extends Core, Fighting\n");
    expect(markdown).toContain("- **CombatMonster** : Monster, Targetable, Attacker\n");
    expect(markdown).toContain("- **Monster**\n- **Player** — Plays the game.\n");
    expect(markdown).toContain("**Player.prey ⟷ Monster.hunters**\n\nWho hunts whom.\n\n- Each Player has any number of Monsters, as prey. `0..N`\n");
    expect(markdown).toContain("- client-1 uses attack of server, over Network, down by Combat down to Network and up by Network up to Combat, then Wire");
    expect(markdown).toContain("## Verification rules\n\n### `opacity` — error, standard\n\nEvery mediated Connection is opaque.\n\nSo the how can be swapped.\n");
  });
});
