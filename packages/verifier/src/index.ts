/**
 * The Verifier (docs/tool-design.md, Verification): scripts, profiles, and the Runs of a
 * profile on a Snapshot of a system context. Rules are written in scripts and run by a
 * ScriptHost — the mediation that knows the scripts' language — so nothing here knows how
 * rules are written or run. The Verifier knows nothing of diagnostics either; structural
 * errors blocking verification is the business of whoever starts a Run.
 */
import { save, type SystemContext, type ToolSystem } from "@systemathic/tool";

export type Severity = "error" | "warning";

/**
 * A script of rules, by where it is: a path, or `std` for the standard rules. Its source comes
 * with it when whoever holds it has it at hand, for a host that cannot read the path itself.
 */
export interface Script {
  readonly path: string;
  readonly source?: string;
}

export interface Rule {
  readonly name: string;
  readonly severity: Severity;
  /** What it checks, in a sentence. */
  readonly about: string;
  /** Its documentation, as the script writes it: what it checks, then what it is for. */
  readonly doc?: string;
  /** The script the rule is written in: the profile's own, or the standard one. */
  readonly script: string;
}

/** The rules a System is verified against. */
export interface Profile {
  readonly name: string;
  readonly script: Script;
  readonly rules: readonly Rule[];
}

/** A system context exactly as it was verified. */
export interface Snapshot {
  readonly system: ToolSystem;
  readonly taken: Date;
}

export interface Violation {
  readonly rule: Rule;
  readonly message: string;
  /** Ids of Elements of the Snapshot. */
  readonly subjects: readonly string[];
}

/** A rule that could not be run: it raised, or reported a rule its profile does not have. */
export interface Failure {
  readonly rule: string;
  readonly error: string;
  /** The script's line it failed at, when the host can tell. */
  readonly line?: number;
}

export interface Run {
  readonly profile: Profile;
  readonly snapshot: Snapshot;
  readonly violations: readonly Violation[];
  readonly failures: readonly Failure[];
}

/** What a script host reports; the Verifier turns it into a Run. */
export interface HostRun {
  readonly violations: readonly { rule: string; message: string; subjects: readonly string[] }[];
  readonly failures: readonly Failure[];
}

/** Runs scripts: the mediation of the Verifier into the language rules are written in. */
export interface ScriptHost {
  /** The script's profiles, with their rules. */
  profiles(script: Script): Promise<Profile[]>;
  /** Runs one of the script's profiles on a Snapshot. */
  run(profile: Profile, snapshot: Snapshot): Promise<HostRun>;
}

/** Something wrong, or worth a look, at a place in a script; lines and columns count from 1. */
export interface ScriptProblem {
  readonly line: number;
  readonly column: number;
  readonly endLine: number;
  readonly endColumn: number;
  readonly message: string;
  readonly severity: "error" | "warning" | "info";
}

export interface ScriptCheck {
  readonly problems: readonly ScriptProblem[];
  /** The script's rules, with the line each is defined at when it is its own. */
  readonly rules: readonly (Rule & { line?: number })[];
  readonly profiles: readonly { name: string; rules: readonly string[] }[];
}

/** What a script can use: a function, a class, a rule, a property to navigate, … */
export interface ScriptSymbol {
  readonly name: string;
  readonly kind: "function" | "class" | "rule" | "constant" | "method" | "property";
  readonly detail: string;
  readonly doc: string;
  readonly module: string;
}

/** Helps write scripts: what is wrong with one, and what one can use. A minimal language server. */
export interface ScriptAssistant {
  /** What is wrong with a script, as it is being written: its source, not yet saved anywhere. */
  check(source: string): Promise<ScriptCheck>;
  symbols(): Promise<ScriptSymbol[]>;
}

/** The standard rules, as a script. */
export const STANDARD: Script = { path: "std" };

export function snapshot(context: SystemContext): Snapshot {
  return { system: save(context), taken: new Date() };
}

export class Verifier {
  constructor(private readonly host: ScriptHost) {}

  /** A profile of a script, by name: `profile` by default, `standard` for the standard rules. */
  async profile(script: Script, name = script.path === STANDARD.path ? "standard" : "profile"): Promise<Profile> {
    const profiles = await this.host.profiles(script);
    const found = profiles.find((profile) => profile.name === name);
    if (!found) throw new Error(`${script.path} has no profile '${name}'; it has ${profiles.map((p) => p.name).join(", ") || "none"}`);
    return found;
  }

  /**
   * `verify(Snapshot, Profile) → Run`. Every Violation is of a rule of the profile, and about
   * Elements of the Snapshot; anything else the host reports is a failure, not a Violation.
   */
  async verify(snapshot: Snapshot, profile: Profile): Promise<Run> {
    const result = await this.host.run(profile, snapshot);
    const rules = new Map(profile.rules.map((rule) => [rule.name, rule]));
    const failures = [...result.failures];
    const violations: Violation[] = [];
    for (const violation of result.violations) {
      const rule = rules.get(violation.rule);
      if (rule === undefined) {
        failures.push({ rule: violation.rule, error: `reported a violation, but is not a rule of profile '${profile.name}'` });
        continue;
      }
      const subjects = violation.subjects.filter((id) => snapshot.system.design.has(id));
      violations.push({ rule, message: violation.message, subjects });
    }
    return { profile, snapshot, violations, failures };
  }
}

/** Errors first, then warnings; by rule, then message. */
export function ordered(violations: readonly Violation[]): Violation[] {
  const rank = (violation: Violation) => (violation.rule.severity === "error" ? 0 : 1);
  return [...violations].sort((a, b) => rank(a) - rank(b) || a.rule.name.localeCompare(b.rule.name) || a.message.localeCompare(b.message));
}

/** The profile a System is verified against by default, kept as an attachment of the Verifier's. */
export interface ProfileSetting {
  readonly script: string;
  readonly profile: string;
}

export const ATTACHMENT_OWNER = "verifier";

export function profileSetting(attachments: ToolSystem["attachments"]): ProfileSetting | undefined {
  const data = attachments.find((attachment) => attachment.owner === ATTACHMENT_OWNER)?.data as Partial<ProfileSetting> | undefined;
  return typeof data?.script === "string" && typeof data.profile === "string" ? { script: data.script, profile: data.profile } : undefined;
}
