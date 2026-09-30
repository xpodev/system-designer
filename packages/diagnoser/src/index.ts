/**
 * The Diagnoser (docs/tool-design.md): what is wrong with a System. Structural errors are
 * found without any knowledge of W1–W6 written here: the core's own ranges and axioms are
 * evaluated on the System, which is a finite model.
 */
import {
  analyzeFormula,
  coreSpec,
  counterexamples,
  describe,
  parse,
  type Formula,
  type Graph,
} from "@systemathic/core";
import type { SystemContext } from "@systemathic/tool";

export type Severity = "error" | "warning";

export interface Diagnostic {
  readonly severity: Severity;
  /** What found it: `range`, `formula`, or the id of a core axiom (`W1`–`W6`, `mapping`, …). */
  readonly check: string;
  readonly message: string;
  /** Instance ids the diagnostic is about. */
  readonly subjects: readonly string[];
}

const axioms: { readonly id: string; readonly about: string; readonly formula: Formula }[] = coreSpec.axioms.map((axiom) => ({
  id: axiom.id,
  about: axiom.about,
  formula: parse(axiom.formula),
}));

export function diagnose(context: SystemContext): Diagnostic[] {
  const graph = context.design;
  const found = [...ranges(graph), ...violatedAxioms(graph), ...formulas(graph)];
  return found.sort(compare);
}

/** Structural errors: the ones that must be solved before a System is verified. */
export function structuralErrors(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.filter((diagnostic) => diagnostic.severity === "error");
}

function* ranges(graph: Graph): Generator<Diagnostic> {
  for (const instance of graph.all()) {
    for (const [endName, steps] of graph.vocabulary.reachable(instance.entity)) {
      if (steps.length !== 1) continue;
      const { min, max } = steps[0]!.end;
      const count = graph.navigate(instance.id, endName).length;
      if (count >= min && (max === null || count <= max)) continue;
      yield {
        severity: "error",
        check: "range",
        message: `${describe(graph, instance.id)} has ${count} '${endName}', expected ${min}..${max ?? "N"}`,
        subjects: [instance.id],
      };
    }
  }
}

function* violatedAxioms(graph: Graph): Generator<Diagnostic> {
  for (const axiom of axioms) {
    // A symmetric axiom fails once per ordering of the same things: report it once.
    const seen = new Set<string>();
    for (const env of counterexamples(axiom.formula, graph)) {
      const subjects = [...new Set(env.values())];
      const key = [...subjects].sort().join("\u0000");
      if (seen.has(key)) continue;
      seen.add(key);
      yield { severity: "error", check: axiom.id, message: axiom.about, subjects };
    }
  }
}

function* formulas(graph: Graph): Generator<Diagnostic> {
  for (const formula of graph.ofEntity("Formula")) {
    const analysis = analyzeFormula(graph, formula);
    if (!analysis.ok) {
      yield { severity: "error", check: "formula", message: `the formula does not fit its Language: ${analysis.error}`, subjects: [formula] };
    }
  }
}

function compare(a: Diagnostic, b: Diagnostic): number {
  return a.check.localeCompare(b.check) || a.message.localeCompare(b.message) || a.subjects.join().localeCompare(b.subjects.join());
}
