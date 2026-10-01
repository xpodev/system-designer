import { readFileSync } from "node:fs";
import { stdSpec } from "@systemathic/core";
import { open } from "@systemathic/tool";
import { readSystem } from "@systemathic/tool-json";
import { snapshot, type Run } from "@systemathic/verifier";
import { describe, expect, it } from "vitest";
import { diagnose, metrics, structuralErrors } from "../src/index.js";
import { suggestedAxioms } from "../src/suggestions.js";

const examples = new URL("../../../examples/", import.meta.url);
const context = (path: string) => open(readSystem(JSON.parse(readFileSync(new URL(path, examples), "utf8"))).system);

describe("suggestions", () => {
  it("name what to change, from the assignment that broke the axiom", () => {
    const [w3] = diagnose(context("broken/w3.systemathic.json")).filter((d) => d.check === "W3");
    expect(w3!.suggestions).toEqual([{ message: "Rename one of the two ends", subjects: w3!.subjects.slice(0, 2) }]);
    const [w4] = diagnose(context("broken/w4.systemathic.json")).filter((d) => d.check === "W4");
    expect(w4!.suggestions[0]!.message).toMatch(/^Make the holding Domain reference/);
  });

  it("say how to fix a range", () => {
    const [range] = diagnose(context("broken/range.systemathic.json")).filter((d) => d.check === "range");
    expect(range!.suggestions).toHaveLength(1);
    expect(range!.suggestions[0]!.message).toMatch(/^(Link|Unlink) \d+/);
  });

  it("are keyed by axioms that exist, and cover every axiom a fix can be suggested for", () => {
    const abouts = stdSpec.axioms.map((axiom) => axiom.about);
    for (const about of suggestedAxioms) expect(abouts).toContain(about);
    const without = ["Bounds are well-founded: no Bound succeeds itself", "A Mediation relates only Domains of its own System"];
    const order = stdSpec.axioms.filter((axiom) => axiom.id === "order").map((axiom) => axiom.about);
    expect(abouts.filter((about) => !suggestedAxioms.includes(about)).sort()).toEqual([...without, ...order].sort());
  });
});

describe("rule Violations", () => {
  it("are Diagnostics through the projection of Verification, and never structural errors", () => {
    const game = context("game.systemathic.json");
    const rule = { name: "no_combat", severity: "error" as const, about: "", script: "script" };
    const run: Run = {
      profile: { name: "profile", script: { path: "x.py" }, rules: [rule] },
      snapshot: snapshot(game),
      violations: [{ rule, message: "Combat is here", subjects: ["d.combat", "gone"] }],
      failures: [],
    };
    const found = diagnose(game, run);
    expect(found).toEqual([{ severity: "error", check: "no_combat", kind: "rule", message: "Combat is here", subjects: ["d.combat"], suggestions: [] }]);
    expect(structuralErrors(found)).toEqual([]);
  });
});

describe("metrics", () => {
  it("count, measure depth, and fan in and out", () => {
    const found = metrics(context("game.systemathic.json").design);
    const of = (subject: string, measure: string) => found.find((m) => m.subject === subject && m.measure === measure)?.value;
    expect(of("game", "languages")).toBe(5);
    expect(of("core", "entities")).toBe(2);
    expect(of("d.combat", "effective languages")).toBe(2);
    expect(of("d.combat", "reference depth")).toBe(1);
    expect(of("d.core", "fan-in")).toBe(2);
    expect(of("combat.view", "mappings")).toBe(2);
  });
});
