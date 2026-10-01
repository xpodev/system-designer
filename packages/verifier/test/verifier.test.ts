import { newSystem } from "@systemathic/tool";
import { describe, expect, it } from "vitest";
import { STANDARD, Verifier, ordered, profileSetting, snapshot, type HostRun, type Profile, type ScriptHost } from "../src/index.js";

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
});
