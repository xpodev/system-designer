import { readFileSync } from "node:fs";
import { analyzeFormula, coreSpec, counterexamples, describe as describeElement, mediationStack, nameOf, parameters, parse, type Graph } from "@systemathic/core";
import { open, save } from "@systemathic/tool";
import { describe, expect, it } from "vitest";
import { FormatError, readSystem, writeSystem } from "../src/index.js";

const game = JSON.parse(readFileSync(new URL("../../../examples/game.systemathic.json", import.meta.url), "utf8"));

/** Every axiom and range of the Systemathic Languages that `graph` breaks, described. */
export function wellFormednessProblems(graph: Graph): string[] {
  const problems: string[] = [];
  for (const axiom of coreSpec.axioms) {
    for (const env of counterexamples(parse(axiom.formula), graph)) {
      problems.push(`${axiom.id} ${axiom.about}: ${[...env.values()].map((id) => describeElement(graph, id)).join(", ")}`);
    }
  }
  for (const instance of graph.all()) {
    for (const [end, steps] of graph.vocabulary.reachable(instance.entity)) {
      if (steps.length !== 1) continue;
      const { min, max } = steps[0]!.end;
      const count = graph.navigate(instance.id, end).length;
      if (count < min || (max !== null && count > max)) problems.push(`range: ${describeElement(graph, instance.id)} has ${count} '${end}'`);
    }
  }
  return problems;
}

describe("System files, systemathic/3", () => {
  it("reads the example without problems, and it is well-formed", () => {
    const { system, problems } = readSystem(game);
    expect(problems).toEqual([]);
    expect(nameOf(system.design, "core.monster")).toBe("Monster");
    expect(parameters(system.design, "game.server.attack")).toEqual(["game.server.attack.attacker", "game.server.attack.target"]);
    expect(mediationStack(system.design, "game.online.client-1-attacks")).toEqual(["game.online.client-1-attacks#m0", "game.online.client-1-attacks#m1"]);
    expect(parameters(system.design, "game.combat-over-network.down")).toEqual(["game.combat-over-network.down.monster"]);
    expect(system.design.navigate("game.combat-over-network.down", "output")).toEqual(["lib.network.entity-id"]);
    expect(wellFormednessProblems(system.design)).toEqual([]);
  });

  it("round-trips: save(open(read(file))) writes the same file", () => {
    const { system } = readSystem(game);
    expect(writeSystem(save(open(system)))).toEqual(game);
  });

  it("reads and writes an unnamed end as a null name", () => {
    const file = structuredClone(game);
    file.design.root.languages[0].relationships[0].ends[1].name = null;
    const { system, problems } = readSystem(file);
    expect(problems).toEqual([]);
    expect(nameOf(system.design, "core.hunts.prey")).toBeUndefined();
    expect(writeSystem(save(open(system)))).toEqual(file);
  });

  it("derives a formula's mentions from its text", () => {
    const { system } = readSystem(game);
    expect(analyzeFormula(system.design, "core.no-leadership-cycles")).toMatchObject({ ok: true, ends: ["core.pack.leader"] });
  });

  it("reads and writes what a Component implements, Instance ranges and a Function without an output", () => {
    const file = structuredClone(game);
    const [, , , server, client] = file.design.root.components;
    client.implements = ["game.server"];
    client.imports.components.push("game.server");
    file.design.root.deployments[0].instances[1].max = "N";
    server.interactions[0].output = null;
    const { system, problems } = readSystem(file);
    expect(problems).toEqual([]);
    expect(system.design.navigate("game.client", "implements")).toEqual(["game.server"]);
    expect(system.design.navigate("game.server.attack", "output")).toEqual([]);
    expect(writeSystem(system)).toEqual(file);
  });

  it("reports references to nothing, or to the wrong kind of thing, and drops them", () => {
    const broken = structuredClone(game);
    broken.design.root.languages[0].relationships[0].ends[0].entity = "core.nobody";
    broken.design.root.components[3].uses = ["game.physics"];
    const { system, problems } = readSystem(broken);
    expect(problems).toEqual([
      { at: "$.design.root.languages[0].relationships[0].ends[0].entity", message: "refers to 'core.nobody', which does not exist" },
      { at: "$.design.root.components[3].uses[0]", message: "refers to Component 'game.physics', where a Language is expected" },
    ]);
    expect(system.design.navigate("core.hunts.hunters", "entity")).toEqual([]);
  });

  it("reports duplicate ids and keeps the first", () => {
    const broken = structuredClone(game);
    broken.design.root.languages[0].entities.push({ id: "core.monster", name: "Impostor", extends: [] });
    const { system, problems } = readSystem(broken);
    expect(problems).toEqual([{ at: "$.design.root.languages[0].entities[2]", message: "duplicate id 'core.monster'" }]);
    expect(nameOf(system.design, "core.monster")).toBe("Monster");
  });

  it("rejects a file that is not in the format, and says how to bring an earlier one forward", () => {
    expect(() => readSystem({ format: "other" })).toThrow(FormatError);
    expect(() => readSystem({ format: "systemathic/2" })).toThrow("scripts/migrate.py");
    expect(() => readSystem({ ...game, design: { ...game.design, packages: 3 } })).toThrow("$.design.packages: expected an array");
  });
});
