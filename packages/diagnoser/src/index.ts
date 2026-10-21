/**
 * The Diagnoser: what is wrong with a System, and what can be measured about it. Structural
 * errors are the Violations of the Verifier's structural Rule — the core's ranges and axioms,
 * and the fit of the design's Formulas — which it always verifies; the Violations of a
 * verification Run are those of the Rules it was given. Both reach it through its projection
 * of Verification, so the Verifier never knows diagnostics exist.
 */
import type { Graph } from "@systemathic/core";
import type { SystemContext } from "@systemathic/tool";
import { verifyStructure, type Run } from "@systemathic/verifier";
import { axiomSuggestions, rangeSuggestions, type Suggestion } from "./suggestions.js";

export { metrics, type Measure, type Metric } from "./metrics.js";
export type { Suggestion } from "./suggestions.js";

export type Severity = "error" | "warning";

/** What found a Diagnostic: a well-formedness Condition of the core, a Rule of a verification script, or a check of a Configuration. */
export type CheckKind = "condition" | "rule" | "configuration";

export interface Diagnostic {
  readonly severity: Severity;
  /** What found it: `range`, `formula`, the id of a core axiom (`W1`–`W16`, `order`, …), a rule's name, or a Configuration check (`C1`–`C4`). */
  readonly check: string;
  readonly kind: CheckKind;
  readonly message: string;
  /** Instance ids the diagnostic is about. */
  readonly subjects: readonly string[];
  readonly suggestions: readonly Suggestion[];
}

/** Everything wrong with a system context: its structural errors, and the Violations of `run`, if given. */
export function diagnose(context: SystemContext, run?: Run): Diagnostic[] {
  const graph = context.design;
  const found = [...structural(graph), ...(run ? violations(run, graph) : [])];
  return found.sort(compare);
}

/** Structural errors: errors of the structural Rule, which must be solved before a System is verified. */
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

/** The projection of the structural Rule's Violations: each a Condition's error, with the Suggestions that fix it. */
function* structural(graph: Graph): Generator<Diagnostic> {
  for (const violation of verifyStructure(graph)) {
    const found = { severity: "error", kind: "condition", message: violation.message, subjects: violation.subjects } as const;
    if (violation.assertion === "range") {
      yield { ...found, check: "range", suggestions: rangeSuggestions(violation.subjects[0], violation.end, violation.count, violation.min, violation.max) };
    } else if (violation.assertion === "fit") {
      yield { ...found, check: "formula", suggestions: [{ message: "Fix the formula's text, in the ASCII syntax, over its own Language", subjects: violation.subjects }] };
    } else {
      yield { ...found, check: violation.assertion.id, suggestions: axiomSuggestions(violation.assertion.about, violation.bindings) };
    }
  }
}

function compare(a: Diagnostic, b: Diagnostic): number {
  const rank = (d: Diagnostic) => (d.kind === "condition" ? 0 : 1) * 2 + (d.severity === "error" ? 0 : 1);
  return rank(a) - rank(b) || a.check.localeCompare(b.check) || a.message.localeCompare(b.message) || a.subjects.join().localeCompare(b.subjects.join());
}
