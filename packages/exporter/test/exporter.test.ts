import { readFileSync } from "node:fs";
import { open } from "@systemathic/tool";
import { readSystem } from "@systemathic/tool-json";
import type { Profile } from "@systemathic/verifier";
import { describe, expect, it } from "vitest";
import { fromJson, fromMarkdown, specify, toJson, toMarkdown } from "../src/index.js";

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
    expect(text("relationship:core.pack")).toBe("Relationship Monster (end 'leader', 0..1) <——> Monster (end 'followers', 0..N).");
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
