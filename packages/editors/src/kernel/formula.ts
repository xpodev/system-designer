/** FormulaEditor (Kernel): a Formula, kept as its text; what it mentions is read from the text. */
import { remove as removeFromModel } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { element, operation, str, text, type Operation } from "../operation.js";

const EDITOR = "FormulaEditor";

/** Sets a Formula's text. Text that does not parse, or leaves its Language, is kept, and diagnosed. */
export function setText(session: EditSession, formula: string, value: string): Edit {
  return session.edit("change", `setText ${value}`, [formula], (graph) => graph.setValue(formula, value));
}

export function remove(session: EditSession, formula: string): Edit {
  return session.edit("removal", "remove Formula", [formula], (graph) => void removeFromModel(graph, formula));
}

const FORMULA = element("formula", "Formula", "the Formula");

export const formulaEditor: readonly Operation[] = [
  operation(EDITOR, "setText", "change", "Sets a Formula's text, in the ASCII syntax.", [FORMULA, text("text", "the formula")], (s, a) =>
    setText(s, str(a, "formula"), str(a, "text")),
  ),
  operation(EDITOR, "remove", "removal", "Removes a Formula.", [FORMULA], (s, a) => remove(s, str(a, "formula"))),
];
