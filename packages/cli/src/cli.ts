/**
 * CliSystems and CliVerification (docs/tool-design.md): the command line as a client of the tool.
 *
 *   systemathic check <file>                                report what is wrong with a System
 *   systemathic verify <file> [script] [profile]            verify a System against a profile of rules
 *   systemathic export <file> [md|json] [script] [profile]  print its specification
 *   systemathic new <file> [name]                           write an empty System
 *
 * `verify` uses the System's own profile setting, if it has one, or the standard rules; so
 * does `export`, for the specification's Requirements, if a script or setting names one. A
 * System with structural errors is neither verified nor exported.
 *
 * Exit codes: 0 nothing wrong, 1 structural errors, load problems or rule errors, 2 unusable input.
 */
import { describe } from "@systemathic/core";
import { diagnose, structuralErrors } from "@systemathic/diagnoser";
import { specify, toJson, toMarkdown } from "@systemathic/exporter";
import { PythonHost } from "@systemathic/python-host";
import { newSystem, open, save } from "@systemathic/tool";
import { FormatError, readSystem, writeSystem, type ReadResult } from "@systemathic/tool-json";
import { ordered, profileSetting, snapshot, STANDARD, Verifier, type ScriptHost } from "@systemathic/verifier";

export interface Io {
  readFile(path: string): string;
  writeFile(path: string, content: string): void;
  exists(path: string): boolean;
  out(line: string): void;
  err(line: string): void;
  /** Runs rule scripts; Python by default. */
  scripts?: ScriptHost;
}

const USAGE =
  "usage: systemathic check <file> | systemathic verify <file> [script] [profile] | systemathic export <file> [md|json] [script] [profile] | systemathic new <file> [name]";

export async function run(args: readonly string[], io: Io): Promise<number> {
  const [command, file, ...rest] = args;
  if (command === "check" && file !== undefined && rest.length === 0) return check(file, io);
  if (command === "verify" && file !== undefined && rest.length <= 2) return verify(file, rest[0], rest[1], io);
  if (command === "export" && file !== undefined && rest.length <= 3 && (rest[0] ?? "md").match(/^(md|json)$/)) {
    return exportSpecification(file, (rest[0] ?? "md") as "md" | "json", rest[1], rest[2], io);
  }
  if (command === "new" && file !== undefined && rest.length <= 1) return create(file, rest[0], io);
  io.err(USAGE);
  return 2;
}

function load(file: string, io: Io): ReadResult | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(io.readFile(file));
  } catch (error) {
    io.err(`${file}: ${(error as Error).message}`);
    return undefined;
  }
  try {
    return readSystem(parsed);
  } catch (error) {
    if (!(error instanceof FormatError)) throw error;
    io.err(`${file}: not a System file: ${error.message}`);
    return undefined;
  }
}

function check(file: string, io: Io): number {
  const result = load(file, io);
  if (result === undefined) return 2;
  const context = open(result.system);
  const diagnostics = diagnose(context);
  for (const problem of result.problems) io.out(`load   ${problem.at}: ${problem.message}`);
  for (const diagnostic of diagnostics) {
    io.out(`${diagnostic.severity.padEnd(6)} ${diagnostic.check.padEnd(8)} ${diagnostic.message}`);
    io.out(`       ${" ".repeat(8)} ${diagnostic.subjects.map((id) => describe(context.design, id)).join(", ")}`);
  }

  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  io.out(`${file}: ${count(errors, "structural error")}, ${count(result.problems.length, "load problem")}`);
  return errors + result.problems.length > 0 ? 1 : 0;
}

async function verify(file: string, script: string | undefined, profileName: string | undefined, io: Io): Promise<number> {
  const result = load(file, io);
  if (result === undefined) return 2;
  const context = open(result.system);
  const errors = structuralErrors(diagnose(context)).length + result.problems.length;
  if (errors > 0) {
    io.err(`${file}: ${count(errors, "structural error")}; run 'systemathic check ${file}', and solve them before verifying`);
    return 1;
  }

  const setting = profileSetting(context.attachments);
  const verifier = new Verifier(io.scripts ?? new PythonHost());
  let run;
  try {
    const path = script ?? setting?.script ?? STANDARD.path;
    const profile = await verifier.profile({ path }, profileName ?? (script === undefined ? setting?.profile : undefined));
    run = await verifier.verify(snapshot(context), profile);
  } catch (error) {
    io.err(`${file}: cannot verify: ${(error as Error).message}`);
    return 2;
  }

  for (const violation of ordered(run.violations)) {
    io.out(`${violation.rule.severity.padEnd(7)} ${violation.rule.name}: ${violation.message}`);
    if (violation.subjects.length > 0) io.out(`        ${violation.subjects.map((id) => describe(context.design, id)).join(", ")}`);
  }
  for (const failure of run.failures) io.out(`failed  ${failure.rule}: ${failure.error.trim().split("\n").at(-1)}`);
  const ruleErrors = run.violations.filter((violation) => violation.rule.severity === "error").length;
  const warnings = run.violations.length - ruleErrors;
  io.out(`${file}: ${run.profile.name} (${count(run.profile.rules.length, "rule")}): ${count(ruleErrors, "error")}, ${count(warnings, "warning")}, ${count(run.failures.length, "failed rule")}`);
  return ruleErrors + run.failures.length > 0 ? 1 : 0;
}

async function exportSpecification(file: string, as: "md" | "json", script: string | undefined, profileName: string | undefined, io: Io): Promise<number> {
  const result = load(file, io);
  if (result === undefined) return 2;
  const context = open(result.system);
  const errors = structuralErrors(diagnose(context)).length + result.problems.length;
  if (errors > 0) {
    io.err(`${file}: ${count(errors, "structural error")}; run 'systemathic check ${file}', and solve them before exporting`);
    return 1;
  }
  const setting = profileSetting(context.attachments);
  let profile;
  if (script !== undefined || setting !== undefined) {
    try {
      const verifier = new Verifier(io.scripts ?? new PythonHost());
      profile = await verifier.profile({ path: script ?? setting!.script }, profileName ?? (script === undefined ? setting?.profile : undefined));
    } catch (error) {
      io.err(`${file}: cannot read the profile: ${(error as Error).message}`);
      return 2;
    }
  }
  const specification = specify(context, profile);
  io.out(as === "json" ? JSON.stringify(toJson(specification), null, 2) : toMarkdown(specification));
  return 0;
}

function create(file: string, name: string | undefined, io: Io): number {
  if (io.exists(file)) {
    io.err(`${file} already exists`);
    return 2;
  }
  const system = save(newSystem(name ?? "Untitled"));
  io.writeFile(file, JSON.stringify(writeSystem(system), null, 2) + "\n");
  io.out(`wrote ${file}`);
  return 0;
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
