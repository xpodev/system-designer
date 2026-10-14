/** The RuleHost in WebAssembly, in Node: the same answers as Python's own, from the same package. */
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { remove } from "@systemathic/core";
import { open } from "@systemathic/tool";
import { readSystem } from "@systemathic/tool-json";
import { STANDARD, Verifier, snapshot } from "@systemathic/verifier";
import { describe, expect, it } from "vitest";
import { InProcess, PyodideScripts, RuleRunner } from "../src/index.js";

const root = new URL("../../../", import.meta.url);
const folder = new URL("python/systemathic/", root);
const sources = Object.fromEntries(
  readdirSync(folder)
    .filter((file) => file.endsWith(".py"))
    .map((file) => [file, readFileSync(new URL(file, folder), "utf8")]),
);
// Pyodide finds its own files from where it is loaded, which a test runner's transforms hide.
const pyodideFolder = dirname(createRequire(import.meta.url).resolve("pyodide/package.json")) + "/";
const scripts = new PyodideScripts(new InProcess(RuleRunner.load(sources, pyodideFolder)));
const verifier = new Verifier(scripts);
const text = (path: string) => readFileSync(new URL(path, root), "utf8");
const context = (path: string) => open(readSystem(JSON.parse(text(path))).system);

describe("RuleHost in WebAssembly", () => {
  it("verifies the tool's design against its own profile, as Python does", async () => {
    const script = { path: "docs/system-designer.rules.py", source: text("docs/system-designer.rules.py") };
    const profile = await verifier.profile(script);
    expect(profile.rules).toHaveLength(17);
    const run = await verifier.verify(snapshot(context("docs/system-designer.systemathic.json")), profile);
    expect(run.failures).toEqual([]);
    expect(run.violations).toEqual([]);
  }, 120_000);

  it("runs the standard rules", async () => {
    const game = context("examples/game.systemathic.json");
    game.design.connect("game.client", "uses", "lib.network");
    const run = await verifier.verify(snapshot(game), await verifier.profile(STANDARD));
    expect(run.violations.map((v) => [v.rule.name, v.subjects])).toEqual([
      ["opacity", ["game.online.client-1-attacks", "game.client"]],
      ["opacity", ["game.online.client-2-attacks", "game.client"]],
    ]);
  }, 120_000);

  it("reports a rule that raises, at its line", async () => {
    const script = { path: "broken.py", source: text("python/tests/broken_rules.py") };
    const run = await verifier.verify(snapshot(context("examples/game.systemathic.json")), await verifier.profile(script));
    expect(run.failures.map((f) => [f.rule, f.line])).toEqual([["explodes", 10]]);
  }, 120_000);

  it("checks scripts as they are written, and knows what they can use", async () => {
    const check = await scripts.check("from systemathic.std import *\nprofile = Profile(nothing)\n");
    expect(check.problems[0]).toMatchObject({ line: 2, severity: "error" });
    expect((await scripts.symbols()).some((s) => s.name === "mediation_primitives")).toBe(true);
  }, 120_000);

  it("refuses a script without its source, and a profile that is not there", async () => {
    await expect(verifier.profile({ path: "nowhere.py" })).rejects.toThrow("came without its source");
    await expect(verifier.profile(STANDARD, "nope")).rejects.toThrow("std has no profile 'nope'");
  }, 120_000);
});
