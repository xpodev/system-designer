/**
 * Deletion (docs/foundation.md, "Deletion") and undoing it, on the game example. These live
 * here because the example is easiest to read and compare as a file.
 */
import { readFileSync } from "node:fs";
import { invert, remove } from "@systemathic/core";
import { describe, expect, it } from "vitest";
import { readSystem, writeSystem } from "../src/index.js";

const game = JSON.parse(readFileSync(new URL("../../../examples/game.systemathic.json", import.meta.url), "utf8"));
const load = () => readSystem(game).system;

describe("deletion", () => {
  it("deleting a Language takes its contents, the Transformations from or to it, and its references", () => {
    const system = load();
    const removed = remove(system.design, "core");
    expect(removed).toEqual(expect.arrayContaining(["core", "core.monster", "core.pack", "core.pack.leader", "core.no-leadership-cycles", "combat.view", "network.view"]));
    expect(system.design.navigate("d.core", "languages")).toEqual([]);
    expect(system.design.has("combat-over-unity")).toBe(true);
    expect(system.design.has("combat.targetable")).toBe(true);
  });

  it("deleting a Language removes the Mediations its Transformations witnessed", () => {
    const system = load();
    const removed = remove(system.design, "unity");
    expect(removed).toEqual(expect.arrayContaining(["combat-in-unity", "combat-over-unity"]));
    expect(system.design.has("network-over-transport-mediation")).toBe(true);
  });

  it("deleting a Domain removes Transformations that fall out of scope, and nothing else of the Languages", () => {
    const system = load();
    const removed = remove(system.design, "d.core");
    expect(removed.sort()).toEqual(["combat.view", "combat.view#em0", "combat.view#em1", "d.core", "network.view", "network.view#em0", "network.view#em1"]);
    expect(system.design.has("core")).toBe(true);
  });

  it("deleting a Domain removes every Mediation naming it", () => {
    const system = load();
    expect(remove(system.design, "d.unity")).toEqual(["d.unity", "combat-over-unity"]);
    expect(system.design.has("combat-in-unity")).toBe(true);
  });

  it("an Entity's mappings and deferrals go with it; ends that refer to it stay, ill-formed", () => {
    const system = load();
    const removed = remove(system.design, "core.player");
    expect(removed).toEqual(expect.arrayContaining(["combat.view#em1", "network.view#em1"]));
    expect(system.design.has("core.hunts.hunters")).toBe(true);
    expect(system.design.navigate("core.hunts.hunters", "entity")).toEqual([]);
  });

  it("is undone exactly by inverting what it recorded", () => {
    for (const root of ["core", "unity", "d.core", "d.combat-in-unity", "combat.attack", "core.monster"]) {
      const system = load();
      const delta = system.design.record((graph) => remove(graph, root));
      system.design.apply(invert(delta));
      expect(writeSystem(system), root).toEqual(game);
    }
  });
});

describe("Std in the file", () => {
  it("reads and writes primary Parameters, comparisons and deferrals", () => {
    const file = structuredClone(game);
    file.design.languages[1].interactions[0].compares = ["combat.damage"];
    file.design.domains[2].transformations[0].deferred = [{ entity: "core.player" }];
    const { system, problems } = readSystem(file);
    expect(problems).toEqual([]);
    expect(system.design.navigate("combat.attack", "primary")).toEqual(["combat.attack.attacker"]);
    expect(system.design.navigate("combat.damage", "comparison")).toEqual(["combat.attack"]);
    expect(writeSystem(system)).toEqual(file);
  });
});
