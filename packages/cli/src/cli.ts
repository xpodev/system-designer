/**
 * CliSystems (docs/tool-design.md): the command line as a client of Tool and the Diagnoser.
 *
 *   systemathic check <file>          report what is wrong with a System
 *   systemathic new <file> [name]     write an empty System
 *
 * Exit codes: 0 nothing wrong, 1 structural errors or load problems, 2 unusable input.
 */
import { describe } from "@systemathic/core";
import { diagnose } from "@systemathic/diagnoser";
import { newSystem, open, save } from "@systemathic/tool";
import { FormatError, readSystem, writeSystem } from "@systemathic/tool-json";

export interface Io {
  readFile(path: string): string;
  writeFile(path: string, content: string): void;
  exists(path: string): boolean;
  out(line: string): void;
  err(line: string): void;
}

const USAGE = "usage: systemathic check <file> | systemathic new <file> [name]";

export function run(args: readonly string[], io: Io): number {
  const [command, file, ...rest] = args;
  if (command === "check" && file !== undefined && rest.length === 0) return check(file, io);
  if (command === "new" && file !== undefined && rest.length <= 1) return create(file, rest[0], io);
  io.err(USAGE);
  return 2;
}

function check(file: string, io: Io): number {
  let parsed: unknown;
  try {
    parsed = JSON.parse(io.readFile(file));
  } catch (error) {
    io.err(`${file}: ${(error as Error).message}`);
    return 2;
  }

  let result;
  try {
    result = readSystem(parsed);
  } catch (error) {
    if (!(error instanceof FormatError)) throw error;
    io.err(`${file}: not a System file: ${error.message}`);
    return 2;
  }

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
