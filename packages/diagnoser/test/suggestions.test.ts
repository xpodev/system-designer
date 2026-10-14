import { readFileSync } from "node:fs";
import { coreSpec } from "@systemathic/core";
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
    expect(w3!.suggestions).toEqual([{ message: "Rename one of the two ends", subjects: ["core.hunts.hunters", "core.pack.followers"] }]);
    const [w5] = diagnose(context("broken/w5.systemathic.json")).filter((d) => d.check === "W5");
    expect(w5!.suggestions).toEqual([{ message: "Import the Language from the Component that exports it, or stop using it", subjects: ["game.server", "lib.network"] }]);
  });

  it("say how to fix a range", () => {
    const [range] = diagnose(context("broken/range.systemathic.json")).filter((d) => d.check === "range");
    expect(range!.suggestions).toHaveLength(1);
    expect(range!.suggestions[0]!.message).toMatch(/^(Link|Unlink) \d+/);
  });

  it("are keyed by axioms that exist, and cover every axiom a fix can be suggested for", () => {
    const abouts = coreSpec.axioms.map((axiom) => axiom.about);
    for (const about of suggestedAxioms) expect(abouts).toContain(about);
    const order = coreSpec.axioms.filter((axiom) => axiom.id === "order").map((axiom) => axiom.about);
    expect(abouts.filter((about) => !suggestedAxioms.includes(about)).sort()).toEqual(order.sort());
  });
});

describe("rule Violations", () => {
  it("are Diagnostics through the projection of Verification, and never structural errors", () => {
    const game = context("game.systemathic.json");
    const rule = { name: "no_combat", severity: "error" as const, about: "", script: "script" };
    const run: Run = {
      profile: { name: "profile", script: { path: "x.py" }, rules: [rule] },
      snapshot: snapshot(game),
      violations: [{ rule, message: "Combat is here", subjects: ["combat", "gone"] }],
      failures: [],
    };
    const found = diagnose(game, run);
    expect(found).toEqual([{ severity: "error", check: "no_combat", kind: "rule", message: "Combat is here", subjects: ["combat"], suggestions: [] }]);
    expect(structuralErrors(found)).toEqual([]);
  });
});

describe("metrics", () => {
  it("count, measure depth, and fan in and out", () => {
    const found = metrics(context("game.systemathic.json").design);
    const of = (subject: string, measure: string) => found.find((m) => m.subject === subject && m.measure === measure)?.value;
    expect(of("game.system", "packages")).toBe(3);
    expect(of("game", "languages")).toBe(3);
    expect(of("core", "entities")).toBe(2);
    expect(of("combat", "extends")).toBe(2);
    expect(of("game.client.input", "nesting depth")).toBe(2);
    expect(of("game.physics", "fan-in")).toBe(2);
    expect(of("game.client", "fan-out")).toBe(5);
    expect(of("game.online.client-1-attacks", "mediations")).toBe(2);
    expect(of("game.combat-over-network.down", "parameters")).toBe(1);
    expect(of("game.server.attack", "parameters")).toBe(2);
  });
});
