import { setName } from "@systemathic/core";
import { newSystem } from "@systemathic/tool";
import { describe, expect, it } from "vitest";
import { STANDARD, STRUCTURAL, Verifier, ordered, verifyStructure, profileSetting, scriptSetting, settingScript, snapshot, type HostRun, type Profile, type ScriptHost } from "../src/index.js";

const rule = (name: string, severity: "error" | "warning" = "error") => ({ name, severity, about: name, script: "script" });
const profile: Profile = { name: "profile", script: { path: "rules.py" }, rules: [rule("a"), rule("b", "warning")] };

function host(result: HostRun): ScriptHost {
  return { profiles: async () => [profile], run: async () => result };
}

describe("Verifier", () => {
  it("keeps only Violations of the profile's rules, about Elements of the Snapshot", async () => {
    const verifier = new Verifier(
      host({
        violations: [
          { rule: "a", message: "found", subjects: ["system", "gone"] },
          { rule: "z", message: "stray", subjects: ["system"] },
        ],
        failures: [],
      }),
    );
    const run = await verifier.verify(snapshot(newSystem()), profile);
    expect(run.violations).toEqual([{ rule: profile.rules[0], message: "found", subjects: ["system"] }]);
    expect(run.failures).toEqual([{ rule: "z", error: "reported a violation, but is not a rule of profile 'profile'" }]);
  });

  it("finds profiles by name, `profile` by default", async () => {
    const verifier = new Verifier(host({ violations: [], failures: [] }));
    expect(await verifier.profile({ path: "rules.py" })).toBe(profile);
    await expect(verifier.profile(STANDARD)).rejects.toThrow("std has no profile 'standard'; it has profile");
  });

  it("snapshots a context, so later edits do not change what was verified", () => {
    const context = newSystem();
    const taken = snapshot(context);
    context.design.add("Language", "late");
    expect(taken.system.design.has("late")).toBe(false);
  });

  it("orders errors first", () => {
    const [a, b] = profile.rules;
    const violations = [{ rule: b!, message: "1", subjects: [] }, { rule: a!, message: "2", subjects: [] }];
    expect(ordered(violations).map((v) => v.message)).toEqual(["2", "1"]);
  });

  it("reads the default profile from its attachment", () => {
    expect(profileSetting([{ owner: "verifier", data: { script: "rules.py", profile: "strict" } }])).toEqual({ script: "rules.py", profile: "strict" });
    expect(profileSetting([{ owner: "ui", data: {} }])).toBeUndefined();
  });

  it("names the script from the folder of the System's file", () => {
    expect(settingScript({ script: "rules.py", profile: "p" }, "docs/game.json")).toBe("docs/rules.py");
    expect(settingScript({ script: "../rules/game.py", profile: "p" }, "docs/game.json")).toBe("rules/game.py");
    expect(settingScript({ script: "rules.py", profile: "p" }, undefined)).toBe("rules.py");
    expect(settingScript({ script: "std", profile: "standard" }, "docs/game.json")).toBe("std");
    expect(scriptSetting("docs/rules.py", "docs/game.json")).toBe("rules.py");
    expect(scriptSetting("docs/rules.py", "other/deep/game.json")).toBe("../../docs/rules.py");
    expect(scriptSetting("rules.py", "./game.json")).toBe("rules.py");
    expect(scriptSetting("std", "docs/game.json")).toBe("std");
  });
});

describe("the structural Rule", () => {
  it("holds of a well-formed System", () => {
    expect(verifyStructure(newSystem("Shop").design)).toEqual([]);
    expect(STRUCTURAL).toMatchObject({ name: "structural", severity: "error" });
  });

  it("finds the core's ranges, axioms and the design's Formulas that do not hold, with what each found", () => {
    const design = newSystem("Shop").design;
    design.disconnect("system", "root");
    design.add("Language", "loop");
    setName(design, "loop", "Loop");
    design.connect("loop", "extends", "loop");
    design.add("Formula", "f", "all x in Nothing. x == x");
    design.connect("loop", "formulas", "f");
    const found = verifyStructure(design);
    expect(found).toContainEqual(expect.objectContaining({ assertion: "range", subjects: ["system"], end: "root", count: 0, min: 1, max: 1 }));
    const cycle = found.find((v) => typeof v.assertion === "object" && v.assertion.about === "No Language extends itself, eventually");
    expect(cycle && "bindings" in cycle && cycle.bindings.get("l")).toBe("loop");
    expect(found).toContainEqual(expect.objectContaining({ assertion: "fit", subjects: ["f"] }));
  });
});
