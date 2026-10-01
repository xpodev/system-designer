/**
 * The Diagnoser (docs/tool-design.md): what is wrong with a System, and what can be measured
 * about it. Structural errors are found without any knowledge of W1–W6 written here: the
 * core's own ranges and axioms are evaluated on the System, which is a finite model. Rule
 * Violations of a verification Run reach it through its projection of Verification, so the
 * Verifier never knows diagnostics exist.
 */
import { analyzeFormula, counterexamples, describe, parse, stdSpec, type Formula, type Graph } from "@systemathic/core";
import type { SystemContext } from "@systemathic/tool";
import type { Run } from "@systemathic/verifier";
import { axiomSuggestions, rangeSuggestions, type Suggestion } from "./suggestions.js";

export { metrics, type Measure, type Metric } from "./metrics.js";
export type { Suggestion } from "./suggestions.js";

export type Severity = "error" | "warning";

/** What found a Diagnostic: a well-formedness Condition of the core, or a Rule of a verification script. */
export type CheckKind = "condition" | "rule";

export interface Diagnostic {
  readonly severity: Severity;
  /** What found it: `range`, `formula`, the id of a core axiom (`W1`–`W6`, `mapping`, …), or a rule's name. */
  readonly check: string;
  readonly kind: CheckKind;
  readonly message: string;
  /** Instance ids the diagnostic is about. */
  readonly subjects: readonly string[];
  readonly suggestions: readonly Suggestion[];
}

const axioms: { readonly id: string; readonly about: string; readonly formula: Formula }[] = stdSpec.axioms.map((axiom) => ({
  id: axiom.id,
  about: axiom.about,
  formula: parse(axiom.formula),
}));

/** Everything wrong with a system context: its structural errors, and the Violations of `run`, if given. */
export function diagnose(context: SystemContext, run?: Run): Diagnostic[] {
  const graph = context.design;
  const found = [...ranges(graph), ...violatedAxioms(graph), ...formulas(graph), ...(run ? violations(run, graph) : [])];
  return found.sort(compare);
}

/** Structural errors: errors found by a Condition, which must be solved before a System is verified. */
export function structuralErrors(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.filter((diagnostic) => diagnostic.severity === "error" && diagnostic.kind === "condition");
}

/** The projection of Verification: `Violation ↦ Diagnostic`, about the Elements still in the context. */
function* violations(run: Run, graph: Graph): Generator<Diagnostic> {
  for (const violation of run.violations) {
    yield {
      severity: violation.rule.severity,
      check: violation.rule.name,
      kind: "rule",
      message: violation.message,
      subjects: violation.subjects.filter((id) => graph.has(id)),
      suggestions: [],
    };
  }
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
        kind: "condition",
        message: `${describe(graph, instance.id)} has ${count} '${endName}', expected ${min}..${max ?? "N"}`,
        subjects: [instance.id],
        suggestions: rangeSuggestions(instance.id, endName, count, min, max),
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
      yield { severity: "error", check: axiom.id, kind: "condition", message: axiom.about, subjects, suggestions: axiomSuggestions(axiom.about, env) };
    }
  }
}

function* formulas(graph: Graph): Generator<Diagnostic> {
  for (const formula of graph.ofEntity("Formula")) {
    const analysis = analyzeFormula(graph, formula);
    if (!analysis.ok) {
      yield {
        severity: "error",
        check: "formula",
        kind: "condition",
        message: `the formula does not fit its Language: ${analysis.error}`,
        subjects: [formula],
        suggestions: [{ message: "Fix the formula's text, in the ASCII syntax, over its own Language", subjects: [formula] }],
      };
    }
  }
}

function compare(a: Diagnostic, b: Diagnostic): number {
  const rank = (d: Diagnostic) => (d.kind === "condition" ? 0 : 1) * 2 + (d.severity === "error" ? 0 : 1);
  return rank(a) - rank(b) || a.check.localeCompare(b.check) || a.message.localeCompare(b.message) || a.subjects.join().localeCompare(b.subjects.join());
}
