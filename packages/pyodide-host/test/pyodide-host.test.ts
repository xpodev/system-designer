/** The RuleHost in WebAssembly, in Node: the same answers as Python's own, from the same package. */
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
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
    const script = { path: "examples/tool-design.rules.py", source: text("examples/tool-design.rules.py") };
    const profile = await verifier.profile(script);
    expect(profile.rules).toHaveLength(16);
    const run = await verifier.verify(snapshot(context("examples/tool-design.systemathic.json")), profile);
    expect(run.failures).toEqual([]);
    expect(run.violations.filter((v) => v.rule.severity === "error")).toEqual([]);
    expect(run.violations.length).toBeGreaterThan(0);
  }, 120_000);

  it("runs the standard rules", async () => {
    const run = await verifier.verify(snapshot(context("examples/game.systemathic.json")), await verifier.profile(STANDARD));
    expect(run.violations.map((v) => [v.rule.name, v.subjects])).toEqual([["completeness", ["combat-in-unity", "combat.engages", "combat.attack"]]]);
  }, 120_000);

  it("reports a rule that raises, at its line", async () => {
    const script = { path: "broken.py", source: text("python/tests/broken_rules.py") };
    const run = await verifier.verify(snapshot(context("examples/game.systemathic.json")), await verifier.profile(script));
    expect(run.failures.map((f) => [f.rule, f.line])).toEqual([["explodes", 10]]);
  }, 120_000);

  it("checks scripts as they are written, and knows what they can use", async () => {
    const check = await scripts.check("from systemathic.std import *\nprofile = Profile(nothing)\n");
    expect(check.problems[0]).toMatchObject({ line: 2, severity: "error" });
    expect((await scripts.symbols()).some((s) => s.name === "witnesses")).toBe(true);
  }, 120_000);

  it("refuses a script without its source, and a profile that is not there", async () => {
    await expect(verifier.profile({ path: "nowhere.py" })).rejects.toThrow("came without its source");
    await expect(verifier.profile(STANDARD, "nope")).rejects.toThrow("std has no profile 'nope'");
  }, 120_000);
});
