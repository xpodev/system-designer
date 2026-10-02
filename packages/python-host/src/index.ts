/**
 * RuleHost (docs/tool-design.md, `Verifier / Python`): rules are Python, run by
 * `python -m systemathic.host`. A Snapshot crosses by value, as a System file; Violations come
 * back as JSON and become the Verifier's. Which Python runs it is `SYSTEMATHIC_PYTHON`, or
 * `python`; the `systemathic` package is the one in this repository's `python/` folder.
 */
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeSystem } from "@systemathic/tool-json";
import type { Failure, HostRun, Profile, Rule, Script, ScriptAssistant, ScriptCheck, ScriptHost, ScriptSymbol, Snapshot } from "@systemathic/verifier";

/** The folder holding the `systemathic` Python package. */
export const PYTHON_PACKAGE = fileURLToPath(new URL("../../../python/", import.meta.url));

interface Described {
  rules: Rule[];
  profiles: { name: string; rules: string[] }[];
}

interface Ran {
  violations: { rule: string; severity: string; message: string; subjects: string[] }[];
  failures: Failure[];
}

export class PythonHost implements ScriptHost, ScriptAssistant {
  private symbolsOnce?: Promise<ScriptSymbol[]>;

  constructor(
    private readonly python = process.env.SYSTEMATHIC_PYTHON ?? "python",
    /** Where relative script paths are resolved from. */
    private readonly cwd = process.cwd(),
  ) {}

  async profiles(script: Script): Promise<Profile[]> {
    const described = await this.call<Described>(["describe", this.path(script)]);
    const rules = new Map(described.rules.map((rule) => [rule.name, rule]));
    return described.profiles.map((profile) => ({
      name: profile.name,
      script,
      rules: profile.rules.map((name) => rules.get(name)!).filter((rule) => rule !== undefined),
    }));
  }

  async run(profile: Profile, snapshot: Snapshot): Promise<HostRun> {
    const folder = mkdtempSync(join(tmpdir(), "systemathic-"));
    try {
      const file = join(folder, "snapshot.systemathic.json");
      writeFileSync(file, JSON.stringify(writeSystem(snapshot.system)));
      const ran = await this.call<Ran>(["run", this.path(profile.script), file, profile.name]);
      return { violations: ran.violations, failures: ran.failures };
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }

  check(script: Script): Promise<ScriptCheck> {
    return this.call<ScriptCheck>(["check", this.path(script)]);
  }

  /** Read once: what a script can use does not change while the host runs. */
  symbols(): Promise<ScriptSymbol[]> {
    this.symbolsOnce ??= this.call<{ symbols: ScriptSymbol[] }>(["symbols"]).then((r) => r.symbols);
    return this.symbolsOnce;
  }

  private path(script: Script): string {
    return script.path === "std" || isAbsolute(script.path) ? script.path : resolve(this.cwd, script.path);
  }

  private call<T>(args: string[]): Promise<T> {
    return new Promise((done, fail) => {
      execFile(
        this.python,
        ["-m", "systemathic.host", ...args],
        { cwd: PYTHON_PACKAGE, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, PYTHONIOENCODING: "utf-8" } },
        (error, stdout, stderr) => {
          let parsed: (T & { error?: string }) | undefined;
          try {
            parsed = JSON.parse(stdout);
          } catch {
            fail(new Error(`the rule host did not answer: ${error?.message ?? ""} ${stderr}`.trim()));
            return;
          }
          if (parsed?.error) fail(new Error(parsed.error));
          else done(parsed as T);
        },
      );
    });
  }
}
