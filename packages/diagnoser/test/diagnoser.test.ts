import { readdirSync, readFileSync } from "node:fs";
import { open } from "@systemathic/tool";
import { readSystem } from "@systemathic/tool-json";
import { describe, expect, it } from "vitest";
import { diagnose } from "../src/index.js";

const examples = new URL("../../../examples/", import.meta.url);
const read = (path: string) => readSystem(JSON.parse(readFileSync(new URL(path, examples), "utf8")));

describe("diagnoser", () => {
  it("finds nothing wrong with the game example", () => {
    expect(diagnose(open(read("game.systemathic.json").system))).toEqual([]);
  });

  for (const file of readdirSync(new URL("broken/", examples))) {
    it(`diagnoses broken/${file}`, () => {
      const { system, problems } = read(`broken/${file}`);
      const found = diagnose(open(system)).map(({ check, message, subjects }) => ({ check, message, subjects }));
      expect({ problems, found }).toMatchSnapshot();
    });
  }
});
