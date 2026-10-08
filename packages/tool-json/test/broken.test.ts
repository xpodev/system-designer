/** Each broken example breaks what its name says. */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readSystem } from "../src/index.js";
import { wellFormednessProblems } from "./format.test.js";

const broken = new URL("../../../examples/broken/", import.meta.url);

describe("broken examples", () => {
  for (const file of readdirSync(broken)) {
    it(file, () => {
      const { system, problems } = readSystem(JSON.parse(readFileSync(new URL(file, broken), "utf8")));
      const found = wellFormednessProblems(system.design).map((problem) => problem.split(" ")[0]);
      if (file.startsWith("dangling")) expect(problems).toHaveLength(1);
      else if (file.startsWith("range")) expect(found).toContain("range:");
      else if (file.startsWith("formula")) expect(found).toEqual([]);
      else expect(found).toContain(file.split(/[-.]/)[0]!.toUpperCase());
    });
  }
});
