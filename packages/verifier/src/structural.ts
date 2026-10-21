/**
 * The structural Rule (docs/system-designer.md, Diagnoser): every formula of the Systemathic
 * Languages, as StdLib Formula Assertions, always checked. It is built in, not written in a
 * script: its Assertions are read from the core's own schema and evaluated here, on the System,
 * which is a finite model. They are
 *
 * - each axiom of the core, a Formula Assertion;
 * - the core's ranges: the formula each End's range abbreviates, that every instance has as
 *   many through the End as the range allows;
 * - that each Formula of the design fits its Language, so it can be evaluated at all.
 *
 * What a Violation of one means, or how to fix it, is not the Verifier's business: each carries
 * what its Assertion found, for whoever reports it.
 */
import { analyzeFormula, coreSpec, counterexamples, describe, parse, type Environment, type Formula, type Graph } from "@systemathic/core";
import type { Rule } from "./index.js";

export const STRUCTURAL: Rule = {
  name: "structural",
  severity: "error",
  about: "Every formula of the Systemathic Languages holds of the System",
  script: "core",
};

/** An axiom of the core, as a Formula Assertion: its id (`W1`–`W16`, `order`, …), what it says, and its formula. */
export interface FormulaAssertion {
  readonly kind: "formula";
  readonly id: string;
  readonly about: string;
  readonly formula: Formula;
}

/** The structural Rule's Assertions, besides the ranges and the fit of the design's Formulas. */
export const AXIOMS: readonly FormulaAssertion[] = coreSpec.axioms.map((axiom) => ({
  kind: "formula",
  id: axiom.id,
  about: axiom.about,
  formula: parse(axiom.formula),
}));

/** What a structural Assertion found false, with what it found. */
export type StructuralViolation =
  | {
      readonly assertion: FormulaAssertion;
      readonly message: string;
      readonly subjects: readonly string[];
      /** The assignment that falsified the formula: its variables, as the schema names them. */
      readonly bindings: Environment;
    }
  | {
      readonly assertion: "range";
      readonly message: string;
      readonly subjects: readonly [string];
      readonly end: string;
      readonly count: number;
      readonly min: number;
      readonly max: number | null;
    }
  | {
      readonly assertion: "fit";
      readonly message: string;
      readonly subjects: readonly [string];
    };

/** Verifies `design` against the structural Rule: every Violation of it, ranges first, then axioms, then Formulas. */
export function verifyStructure(design: Graph): StructuralViolation[] {
  return [...ranges(design), ...axioms(design), ...fits(design)];
}

function* ranges(graph: Graph): Generator<StructuralViolation> {
  for (const instance of graph.all()) {
    for (const [end, steps] of graph.vocabulary.reachable(instance.entity)) {
      if (steps.length !== 1) continue;
      const { min, max } = steps[0]!.end;
      const count = graph.navigate(instance.id, end).length;
      if (count >= min && (max === null || count <= max)) continue;
      yield {
        assertion: "range",
        message: `${describe(graph, instance.id)} has ${count} '${end}', expected ${min}..${max ?? "N"}`,
        subjects: [instance.id],
        end,
        count,
        min,
        max,
      };
    }
  }
}

function* axioms(graph: Graph): Generator<StructuralViolation> {
  for (const assertion of AXIOMS) {
    // A symmetric axiom fails once per ordering of the same things: report it once.
    const seen = new Set<string>();
    for (const bindings of counterexamples(assertion.formula, graph)) {
      const subjects = [...new Set(bindings.values())];
      const key = [...subjects].sort().join("\u0000");
      if (seen.has(key)) continue;
      seen.add(key);
      yield { assertion, message: assertion.about, subjects, bindings };
    }
  }
}

function* fits(graph: Graph): Generator<StructuralViolation> {
  for (const formula of graph.ofEntity("Formula")) {
    const analysis = analyzeFormula(graph, formula);
    if (!analysis.ok) yield { assertion: "fit", message: `the formula does not fit its Language: ${analysis.error}`, subjects: [formula] };
  }
}
