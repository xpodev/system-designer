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
  it("deleting a Language takes its contents, the Interactions over it and the Parameters of its Entities", () => {
    const system = load();
    const removed = remove(system.design, "lib.network");
    expect(removed).toEqual(
      expect.arrayContaining(["lib.network", "lib.network.message", "pkg.netstack.send", "game.combat-over-network.up.id", "game.network-over-wire.down.message"]),
    );
    expect(system.design.has("game.combat-over-network.up")).toBe(true);
    expect(system.design.navigate("game.combat-over-network.down", "output")).toEqual([]);
    expect(system.design.navigate("pkg.netstack", "uses")).toEqual([]);
    expect(system.design.has("pkg.netstack.medium")).toBe(true);
  });

  it("deleting a Transformation leaves the Mediations it realized, unrealized", () => {
    const system = load();
    remove(system.design, "game.combat-over-network.down");
    const [first] = mediationStack(system.design, "game.online.client-1-attacks");
    expect(system.design.navigate(first!, "down")).toEqual([]);
    expect(system.design.navigate(first!, "how")).toEqual(["pkg.netstack.medium"]);
  });

  it("deleting a Medium leaves the Mediations over it broken, in their place", () => {
    const system = load();
    remove(system.design, "pkg.link.medium");
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

  it("deleting an Instance takes its Connections", () => {
    const system = load();
    const removed = remove(system.design, "game.online.client-2");
    expect(removed).toEqual(["game.online.client-2", "game.online.client-2-attacks", "game.online.client-2-attacks#m0", "game.online.client-2-attacks#m1"]);
  });

  it("ends, outputs and Entities that refer to a deleted Entity stay, ill-formed", () => {
    const system = load();
    expect(remove(system.design, "fighting.damage")).toEqual(["fighting.damage"]);
    expect(system.design.navigate("game.server.attack", "output")).toEqual([]);
    const removed = remove(system.design, "core.player");
    expect(removed).toEqual(["core.player"]);
    expect(system.design.has("core.hunts.hunters")).toBe(true);
    expect(system.design.navigate("core.hunts.hunters", "entity")).toEqual([]);
    expect(system.design.navigate("combat.combat-player", "extends")).toEqual(["fighting.attacker"]);
  });

  it("is undone exactly by inverting what it recorded", () => {
    for (const root of ["core", "lib.network", "game.server", "game.online.client-2", "game.server.attack", "pkg.link.medium", "core.monster", "game.online"]) {
      const system = load();
      const delta = system.design.record((graph) => remove(graph, root));
      system.design.apply(invert(delta));
      expect(writeSystem(system), root).toEqual(game);
    }
  });
});
