/**
 * FunctionEditor (Functions): any Function — an Interaction or a Transformation — its
 * Parameters, in order, and its output. Functions are added by the ComponentEditor and the
 * InteractionEditor, where their owner is.
 */
import { parameters, remove as removeFromModel, setName, setParameters } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { element, freshId, index, maybe, operation, str, text, type Operation } from "../operation.js";

const EDITOR = "FunctionEditor";

/** Adds a Parameter, at `position` or last. */
export function addParameter(session: EditSession, func: string, name: string, type: string, position?: number): Edit {
  const id = freshId(session.target.graph, func, name);
  return session.edit("addition", `addParameter ${name}`, [id], (graph) => {
    graph.add("Parameter", id);
    setName(graph, id, name);
    graph.connect(id, "type", type);
    const ordered = parameters(graph, func);
    ordered.splice(position ?? ordered.length, 0, id);
    setParameters(graph, func, ordered);
  });
}

/** Moves a Parameter to `position` among its Function's Parameters. */
export function moveParameter(session: EditSession, parameter: string, position: number): Edit {
  return session.edit("change", "moveParameter", [parameter], (graph) => {
    const [func] = graph.navigate(parameter, "function");
    if (func === undefined) return;
    const ordered = parameters(graph, func).filter((id) => id !== parameter);
    ordered.splice(position, 0, parameter);
    setParameters(graph, func, ordered);
  });
}

export function setType(session: EditSession, parameter: string, type: string): Edit {
  return session.edit("change", "setType", [parameter], (graph) => {
    graph.disconnect(parameter, "type");
    graph.connect(parameter, "type", type);
  });
}

export function removeParameter(session: EditSession, parameter: string): Edit {
  return session.edit("removal", "removeParameter", [parameter], (graph) => {
    const [func] = graph.navigate(parameter, "function");
    const rest = func === undefined ? [] : parameters(graph, func).filter((id) => id !== parameter);
    removeFromModel(graph, parameter);
    if (func !== undefined) setParameters(graph, func, rest);
  });
}

/** Sets a Function's output Entity, or, without one, makes it give nothing back. */
export function setOutput(session: EditSession, func: string, output: string | undefined): Edit {
  return session.edit("change", "setOutput", [func], (graph) => {
    graph.disconnect(func, "output");
    if (output !== undefined) graph.connect(func, "output", output);
  });
}

/** Renames a Function or a Parameter. */
export function rename(session: EditSession, item: string, name: string): Edit {
  return session.edit("change", `rename ${name}`, [item], (graph) => setName(graph, item, name));
}

/** Removes a Function: an Interaction with every import of it and every Connection left with no What; a Transformation, leaving the Mediations it realized unrealized. */
export function remove(session: EditSession, func: string): Edit {
  return session.edit("removal", "remove Function", [func], (graph) => void removeFromModel(graph, func));
}

const FUNCTION = element("function", "Function", "the Interaction or Transformation");
const PARAMETER = element("parameter", "Parameter", "the Parameter");

export const functionEditor: readonly Operation[] = [
  operation(
    EDITOR,
    "addParameter",
    "addition",
    "Adds a Parameter to an Interaction or a Transformation, at a position or last.",
    [FUNCTION, text("name", "the Parameter's name"), element("type", "Entity", "the Parameter's Entity"), index("position", "where, from 0", true)],
    (s, a) => addParameter(s, str(a, "function"), str(a, "name"), str(a, "type"), a.position as number | undefined),
  ),
  operation(EDITOR, "moveParameter", "change", "Moves a Parameter to a position, from 0.", [PARAMETER, index("position", "where, from 0")], (s, a) =>
    moveParameter(s, str(a, "parameter"), a.position as number),
  ),
  operation(EDITOR, "setType", "change", "Sets a Parameter's Entity.", [PARAMETER, element("type", "Entity", "the Entity")], (s, a) =>
    setType(s, str(a, "parameter"), str(a, "type")),
  ),
  operation(EDITOR, "removeParameter", "removal", "Removes a Parameter.", [PARAMETER], (s, a) => removeParameter(s, str(a, "parameter"))),
  operation(
    EDITOR,
    "setOutput",
    "change",
    "Sets an Interaction's or a Transformation's output Entity; without one, it gives nothing back.",
    [FUNCTION, element("output", "Entity", "the Entity", true)],
    (s, a) => setOutput(s, str(a, "function"), maybe(a, "output")),
  ),
  operation(
    EDITOR,
    "rename",
    "change",
    "Renames an Interaction, a Transformation or a Parameter.",
    [element("item", ["Function", "Parameter"], "the Interaction, Transformation or Parameter"), text("name", "the new name")],
    (s, a) => rename(s, str(a, "item"), str(a, "name")),
  ),
  operation(
    EDITOR,
    "remove",
    "removal",
    "Removes an Interaction (with every import of it, and every Connection left with no What) or a Transformation (Mediations it realized stay, unrealized).",
    [FUNCTION],
    (s, a) => remove(s, str(a, "function")),
  ),
];
