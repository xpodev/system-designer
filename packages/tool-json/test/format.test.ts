import { readFileSync } from "node:fs";
import { nameOf, parameters } from "@systemathic/core";
import { open, save } from "@systemathic/tool";
import { describe, expect, it } from "vitest";
import { FormatError, readSystem, writeSystem } from "../src/index.js";

const game = JSON.parse(readFileSync(new URL("../../../examples/game.systemathic.json", import.meta.url), "utf8"));

describe("Tool::System / JSON", () => {
  it("reads the example without problems", () => {
    const { system, problems } = readSystem(game);
    expect(problems).toEqual([]);
    expect(nameOf(system.design, "core.monster")).toBe("Monster");
    expect(parameters(system.design, "combat.attack")).toEqual(["combat.attack.attacker", "combat.attack.target"]);
  });

  it("round-trips: save(open(read(file))) writes the same file", () => {
    const { system } = readSystem(game);
    expect(writeSystem(save(open(system)))).toEqual(game);
  });

  it("derives a formula's mentions from its text", () => {
    const { system } = readSystem(game);
    expect(system.design.navigate("core.no-leadership-cycles", "mentionedEnds")).toEqual(["core.pack.leader"]);
  });

  it("reports references to nothing, or to the wrong kind of thing, and drops them", () => {
    const broken = structuredClone(game);
    broken.design.languages[0].relationships[0].ends[0].entity = "core.nobody";
    broken.design.domains[1].references = ["core"];
    const { system, problems } = readSystem(broken);
    expect(problems).toEqual([
      { at: "$.design.languages[0].relationships[0].ends[0].entity", message: "refers to 'core.nobody', which does not exist" },
      { at: "$.design.domains[1].references[0]", message: "refers to Language 'core', where a Domain is expected" },
    ]);
    expect(system.design.navigate("core.hunts.hunters", "entity")).toEqual([]);
  });

  it("reports duplicate ids and keeps the first", () => {
    const broken = structuredClone(game);
    broken.design.languages[0].entities.push({ id: "core.monster", name: "Impostor" });
    const { system, problems } = readSystem(broken);
    expect(problems).toEqual([{ at: "$.design.languages[0].entities[2]", message: "duplicate id 'core.monster'" }]);
    expect(nameOf(system.design, "core.monster")).toBe("Monster");
  });

  it("rejects a file that is not in the format", () => {
    expect(() => readSystem({ format: "other" })).toThrow(FormatError);
    expect(() => readSystem({ ...game, design: { ...game.design, languages: 3 } })).toThrow("$.design.languages: expected an array");
  });
});
