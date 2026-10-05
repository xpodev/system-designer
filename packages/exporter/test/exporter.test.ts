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
  rules: [{ name: "opacity", severity: "error", about: "Every Mediation is opaque.", script: "std" }],
};

describe("specification", () => {
  const spec = specify(context("game.systemathic.json"), profile);
  const all = (sections = spec.sections): { id: string; text: string }[] =>
    sections.flatMap((section) => [...section.statements, ...all(section.sections)]);

  it("states each Language's vocabulary, what each Domain may use, and which crossings exist", () => {
    const text = (id: string) => all().find((s) => s.id === id)?.text;
    expect(text("relationship:core.pack")).toBe("Relationship Monster (end 'leader', 0..1) <——> Monster (end 'followers', 0..N): Monster.followers; Monster.leader.");
    expect(text("interaction:combat.attack")).toBe("Interaction attack(attacker: Attacker, target: Targetable) → Damage. It is an Action on 'attacker'.");
    expect(text("scope:d.combat")).toBe("May use exactly the Languages Combat, Core, and nothing else.");
    expect(text("transformation:combat-in-unity")).toBe(
      "Transformation Combat as GameObjects: Combat → Unity, a mediation with a reverse by reference, keeping GameObject as context.",
    );
    expect(text("mediation:combat-over-unity")).toBe("Combat is carried out over Unity; only CombatInUnity knows both.");
  });

  it("has the profile's rules as Requirements, and O1–O3 as Obligations for specific Subjects", () => {
    expect(spec.requirements).toEqual([{ id: "R:opacity", rule: "opacity", severity: "error", about: "Every Mediation is opaque.", script: "std" }]);
    expect(spec.obligations.map((o) => o.id)).toEqual([
      "O1:core", "O1:combat", "O1:network", "O1:unity", "O1:transport",
      "O3:combat.view", "O3:network.view", "O2:combat-in-unity", "O2:network-over-transport",
    ]);
  });
});

describe("representations", () => {
  for (const file of ["game.systemathic.json", "tool-design.systemathic.json"]) {
    it(`Markdown reads back into the Specification it came from: ${file}`, () => {
      const spec = specify(context(file), profile);
      expect(fromMarkdown(toMarkdown(spec))).toEqual(spec);
    });
  }

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
    data: { descriptions: { game: "A small game.\n\nMonsters, and those who fight them.", "core.player": "Plays the game.", "core.hunts": "Who hunts whom.", "core.gone": "Of nothing there." } },
  });
  const documented = open(readSystem(file).system);
  const rules: Profile = { ...profile, rules: [{ ...profile.rules[0]!, doc: "Every Mediation is opaque.\n\nSo the how can be swapped." }] };
  const doc = document(documented, rules);

  it("reads each Relationship both ways, as what each side has of the other", () => {
    const [hunts, pack] = doc.languages[0]!.relationships;
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

  it("is a Markdown document, with every Description and the rules' documentation", () => {
    const markdown = documentationMarkdown(doc);
    expect(markdown).toMatch(/^# Game\n\nA small game\.\n\nMonsters, and those who fight them\.\n\nThis System has 5 Languages, 7 Domains, 2 Mediations\.\n/);
    expect(markdown).toContain("- **Monster**\n- **Player** — Plays the game.\n");
    expect(markdown).toContain("**Player.prey ⟷ Monster.hunters**\n\nWho hunts whom.\n\n- Each Player has any number of Monsters, as prey. `0..N`\n");
    expect(markdown).toContain("## Verification rules\n\n### `opacity` — error, standard\n\nEvery Mediation is opaque.\n\nSo the how can be swapped.\n");
  });
});
