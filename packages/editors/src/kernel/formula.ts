/** FormulaEditor (Kernel): a Formula, kept as its text. */
import { linkMentions, remove as removeFromModel } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { element, maybe, operation, str, text, type Operation } from "../operation.js";

const EDITOR = "FormulaEditor";

/** Sets a Formula's text. Text that does not parse, or leaves its Language, is kept, and diagnosed. */
export function setText(session: EditSession, formula: string, value: string): Edit {
  return session.edit("change", `setText ${value}`, [formula], (graph) => {
    graph.setValue(formula, value);
    linkMentions(graph, formula);
  });
}

/** Makes a Formula a constraint of a Relationship, or of none. */
export function constrain(session: EditSession, formula: string, relationship: string | undefined): Edit {
  return session.edit("change", "constrain", [formula], (graph) => {
    graph.disconnect(formula, "constrains");
    if (relationship !== undefined) graph.connect(formula, "constrains", relationship);
  });
}

export function remove(session: EditSession, formula: string): Edit {
  return session.edit("removal", "remove Formula", [formula], (graph) => void removeFromModel(graph, formula));
}

const FORMULA = element("formula", "Formula", "the Formula");

export const formulaEditor: readonly Operation[] = [
  operation(EDITOR, "setText", "change", "Sets a Formula's text, in the ASCII syntax.", [FORMULA, text("text", "the formula")], (s, a) =>
    setText(s, str(a, "formula"), str(a, "text")),
  ),
  operation(
    EDITOR,
    "constrain",
    "change",
    "Makes a Formula a constraint of a Relationship; without one, of none.",
    [FORMULA, element("relationship", "Relationship", "the Relationship", true)],
    (s, a) => constrain(s, str(a, "formula"), maybe(a, "relationship")),
  ),
  operation(EDITOR, "remove", "removal", "Removes a Formula.", [FORMULA], (s, a) => remove(s, str(a, "formula"))),
];
