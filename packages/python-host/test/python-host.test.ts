/** The RuleHost, end to end: TypeScript hands a Snapshot to Python and reads back its Violations. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { remove } from "@systemathic/core";
import { open } from "@systemathic/tool";
import { readSystem } from "@systemathic/tool-json";
import { STANDARD, Verifier, snapshot } from "@systemathic/verifier";
import { describe, expect, it } from "vitest";
import { PythonHost } from "../src/index.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const context = (file: string) => open(readSystem(JSON.parse(readFileSync(`${root}${file}`, "utf8"))).system);
const verifier = new Verifier(new PythonHost(undefined, root));

describe("RuleHost", () => {
  it("verifies the tool's design against its own profile", async () => {
    const profile = await verifier.profile({ path: "docs/system-designer.rules.py" });
    expect(profile.rules.map((rule) => rule.name)).toContain("readers_dont_edit");
    expect(profile.rules).toHaveLength(16);
    const run = await verifier.verify(snapshot(context("docs/system-designer.systemathic.json")), profile);
    expect(run.failures).toEqual([]);
    expect(run.violations).toEqual([]);
  }, 30_000);

  it("runs the standard rules, and names the Elements a Violation is about", async () => {
    const profile = await verifier.profile(STANDARD);
    const game = context("examples/game.systemathic.json");
    expect((await verifier.verify(snapshot(game), profile)).violations).toEqual([]);
    game.design.connect("game.client", "uses", "lib.network");
    const run = await verifier.verify(snapshot(game), profile);
    expect(run.violations.map((violation) => [violation.rule.name, violation.subjects])).toEqual([
      ["opacity", ["game.online.client-1-attacks", "game.client"]],
      ["opacity", ["game.online.client-2-attacks", "game.client"]],
    ]);
  }, 30_000);

  it("reports a rule that raises, and still runs the others", async () => {
    const profile = await verifier.profile({ path: "python/tests/broken_rules.py" });
    const run = await verifier.verify(snapshot(context("examples/game.systemathic.json")), profile);
    expect(run.failures.map((failure) => failure.rule)).toEqual(["explodes"]);
    expect(run.violations.map((violation) => violation.rule.name)).toEqual(["finds_core"]);
  }, 30_000);

  it("fails on a script that cannot be loaded", async () => {
    await expect(verifier.profile({ path: "nowhere.py" })).rejects.toThrow();
  }, 30_000);
});
