/**
 * Deletion (docs/foundation.md, "Deletion") and undoing it, on the game example. These live
 * here because the example is easiest to read and compare as a file.
 */
import { readFileSync } from "node:fs";
import { invert, mediationStack, remove } from "@systemathic/core";
import { describe, expect, it } from "vitest";
import { readSystem, writeSystem } from "../src/index.js";

const game = JSON.parse(readFileSync(new URL("../../../examples/game.systemathic.json", import.meta.url), "utf8"));
const load = () => readSystem(game).system;

describe("deletion", () => {
  it("deleting a Language takes its contents, the Interactions over it and the Transformations from or to it", () => {
    const system = load();
    const removed = remove(system.design, "lib.network");
    expect(removed).toEqual(
      expect.arrayContaining(["lib.network", "lib.network.message", "lib.netstack.send", "game.combat-over-network.down", "game.network-over-wire.up"]),
    );
    expect(system.design.navigate("lib.netstack", "uses")).toEqual([]);
    expect(system.design.has("lib.netstack.network")).toBe(true);
  });

  it("deleting a Transformation leaves the Mediations it realized, unrealized", () => {
    const system = load();
    remove(system.design, "game.combat-over-network.down");
    const [first] = mediationStack(system.design, "game.online.client-1-attacks");
    expect(system.design.navigate(first!, "down")).toEqual([]);
    expect(system.design.navigate(first!, "how")).toEqual(["lib.netstack.network"]);
  });

  it("deleting a Medium leaves the Mediations over it broken, in their place", () => {
    const system = load();
    remove(system.design, "lib.link.wire");
    expect(mediationStack(system.design, "game.online.client-1-attacks")).toHaveLength(2);
    expect(system.design.navigate("game.online.client-1-attacks#m1", "how")).toEqual([]);
  });

  it("deleting a Component takes everything it owns, its Instances and their Connections", () => {
    const system = load();
    const removed = remove(system.design, "game.server");
    expect(removed).toEqual(expect.arrayContaining(["game.server", "game.server.attack", "game.server.single", "game.online.server", "game.online.client-1-attacks"]));
    expect(system.design.has("game.online.client-1")).toBe(true);
    expect(system.design.navigate("game.client", "importedInteractions")).toEqual([]);
  });

  it("deleting an Instance takes its Connections and the choices for it", () => {
    const system = load();
    const removed = remove(system.design, "game.online.client-2");
    expect(removed).toEqual(expect.arrayContaining(["game.online.client-2-attacks", "game.release#root.2"]));
    expect(system.design.has("game.release#root.1")).toBe(true);
  });

  it("an Entity's mappings go with it; ends and Entities that refer to it stay, ill-formed", () => {
    const system = load();
    expect(remove(system.design, "fighting.damage")).toEqual(
      expect.arrayContaining(["fighting.damage", "game.combat-over-network.down#em2", "game.combat-over-network.up#em1"]),
    );
    expect(system.design.navigate("game.server.attack", "output")).toEqual([]);
    const removed = remove(system.design, "core.player");
    expect(removed).toEqual(["core.player"]);
    expect(system.design.has("core.hunts.hunters")).toBe(true);
    expect(system.design.navigate("core.hunts.hunters", "entity")).toEqual([]);
    expect(system.design.navigate("combat.combat-player", "extends")).toEqual(["fighting.attacker"]);
  });

  it("is undone exactly by inverting what it recorded", () => {
    for (const root of ["core", "lib.network", "game.server", "game.online.client-2", "game.server.attack", "lib.link.wire", "core.monster", "game.online"]) {
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
    const server = file.design.components[0].components[3];
    server.interactions[0].compares = ["fighting.damage"];
    file.design.components[0].components[1].transformations[0].deferred = [{ entity: "core.player" }];
    const { system, problems } = readSystem(file);
    expect(problems).toEqual([]);
    expect(system.design.navigate("game.server.attack", "primary")).toEqual(["game.server.attack.attacker"]);
    expect(system.design.navigate("fighting.damage", "comparison")).toEqual(["game.server.attack"]);
    expect(writeSystem(system)).toEqual(file);
  });
});
