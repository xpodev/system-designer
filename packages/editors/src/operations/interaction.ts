/**
 * InteractionEditor (Operations): an Interaction, its Language and its Parameters, and the
 * Interactions a Component imports. Adding an Interaction is here, not in the
 * ComponentEditor, because Contexts knows nothing of Interactions.
 */
import { parameters, remove as removeFromModel, setName, setParameters } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { addNamed, element, freshId, index, operation, str, text, type Operation } from "../operation.js";

const EDITOR = "InteractionEditor";

/** Adds an Interaction to a Component, over one of the Languages it uses, with its output Entity. */
export function addInteraction(session: EditSession, component: string, language: string, name: string, output: string): Edit {
  const id = freshId(session.target.graph, component, name);
  return session.edit("addition", `addInteraction ${name}`, [id], (graph) => {
    addNamed(graph, "Interaction", id, name, component, "interactions");
    graph.connect(id, "language", language);
    graph.connect(id, "output", output);
  });
}

export function setLanguage(session: EditSession, interaction: string, language: string): Edit {
  return session.edit("change", "setLanguage", [interaction], (graph) => {
    graph.disconnect(interaction, "language");
    graph.connect(interaction, "language", language);
  });
}

/** Makes a Component import an Interaction: one of a sibling's, or one a Component it is nested in imports. */
export function importInteraction(session: EditSession, component: string, interaction: string): Edit {
  return session.edit("change", "importInteraction", [component, interaction], (graph) => graph.connect(component, "importedInteractions", interaction));
}

/** Stops a Component importing an Interaction. Connections that used it stay, and are diagnosed. */
export function unimportInteraction(session: EditSession, component: string, interaction: string): Edit {
  return session.edit("change", "unimportInteraction", [component, interaction], (graph) => graph.disconnect(component, "importedInteractions", interaction));
}

/** Adds a Parameter, at `position` or last. */
export function addParameter(session: EditSession, interaction: string, name: string, type: string, position?: number): Edit {
  const id = freshId(session.target.graph, interaction, name);
  return session.edit("addition", `addParameter ${name}`, [id], (graph) => {
    graph.add("Parameter", id);
    setName(graph, id, name);
    graph.connect(id, "type", type);
    const ordered = parameters(graph, interaction);
    ordered.splice(position ?? ordered.length, 0, id);
    setParameters(graph, interaction, ordered);
  });
}

/** Moves a Parameter to `position` among its Interaction's Parameters. */
export function moveParameter(session: EditSession, parameter: string, position: number): Edit {
  return session.edit("change", "moveParameter", [parameter], (graph) => {
    const [interaction] = graph.navigate(parameter, "interaction");
    if (interaction === undefined) return;
    const ordered = parameters(graph, interaction).filter((id) => id !== parameter);
    ordered.splice(position, 0, parameter);
    setParameters(graph, interaction, ordered);
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
    const [interaction] = graph.navigate(parameter, "interaction");
    const rest = interaction === undefined ? [] : parameters(graph, interaction).filter((id) => id !== parameter);
    removeFromModel(graph, parameter);
    if (interaction !== undefined) setParameters(graph, interaction, rest);
  });
}

export function setOutput(session: EditSession, interaction: string, output: string): Edit {
  return session.edit("change", "setOutput", [interaction], (graph) => {
    graph.disconnect(interaction, "output");
    graph.connect(interaction, "output", output);
  });
}

/** Renames an Interaction or a Parameter. */
export function rename(session: EditSession, item: string, name: string): Edit {
  return session.edit("change", `rename ${name}`, [item], (graph) => setName(graph, item, name));
}

export function remove(session: EditSession, interaction: string): Edit {
  return session.edit("removal", "remove Interaction", [interaction], (graph) => void removeFromModel(graph, interaction));
}

const INTERACTION = element("interaction", "Interaction", "the Interaction");
const PARAMETER = element("parameter", "Parameter", "the Parameter");

export const interactionEditor: readonly Operation[] = [
  operation(
    EDITOR,
    "addInteraction",
    "addition",
    "Adds an Interaction to a Component, over one of the Languages it uses, with its output Entity; Parameters are added one by one.",
    [
      element("component", "Component", "the Component offering it"),
      element("language", "Language", "the Language it is over"),
      text("name", "the Interaction's name"),
      element("output", "Entity", "the output Entity"),
    ],
    (s, a) => addInteraction(s, str(a, "component"), str(a, "language"), str(a, "name"), str(a, "output")),
  ),
  operation(EDITOR, "setLanguage", "change", "Sets the Language an Interaction is over.", [INTERACTION, element("language", "Language", "the Language")], (s, a) =>
    setLanguage(s, str(a, "interaction"), str(a, "language")),
  ),
  operation(
    EDITOR,
    "importInteraction",
    "change",
    "Makes a Component import an Interaction of a sibling, or one a Component it is nested in imports.",
    [element("component", "Component", "the importing Component"), INTERACTION],
    (s, a) => importInteraction(s, str(a, "component"), str(a, "interaction")),
  ),
  operation(
    EDITOR,
    "unimportInteraction",
    "change",
    "Stops a Component importing an Interaction.",
    [element("component", "Component", "the importing Component"), INTERACTION],
    (s, a) => unimportInteraction(s, str(a, "component"), str(a, "interaction")),
  ),
  operation(
    EDITOR,
    "addParameter",
    "addition",
    "Adds a Parameter to an Interaction, at a position or last.",
    [INTERACTION, text("name", "the Parameter's name"), element("type", "Entity", "the Parameter's Entity"), index("position", "where, from 0", true)],
    (s, a) => addParameter(s, str(a, "interaction"), str(a, "name"), str(a, "type"), a.position as number | undefined),
  ),
  operation(EDITOR, "moveParameter", "change", "Moves a Parameter to a position, from 0.", [PARAMETER, index("position", "where, from 0")], (s, a) =>
    moveParameter(s, str(a, "parameter"), a.position as number),
  ),
  operation(EDITOR, "setType", "change", "Sets a Parameter's Entity.", [PARAMETER, element("type", "Entity", "the Entity")], (s, a) =>
    setType(s, str(a, "parameter"), str(a, "type")),
  ),
  operation(EDITOR, "removeParameter", "removal", "Removes a Parameter.", [PARAMETER], (s, a) => removeParameter(s, str(a, "parameter"))),
  operation(EDITOR, "setOutput", "change", "Sets an Interaction's output Entity.", [INTERACTION, element("output", "Entity", "the Entity")], (s, a) =>
    setOutput(s, str(a, "interaction"), str(a, "output")),
  ),
  operation(
    EDITOR,
    "rename",
    "change",
    "Renames an Interaction or a Parameter.",
    [element("item", ["Interaction", "Parameter"], "the Interaction or Parameter"), text("name", "the new name")],
    (s, a) => rename(s, str(a, "item"), str(a, "name")),
  ),
  operation(EDITOR, "remove", "removal", "Removes an Interaction, its Parameters, every import of it, and every Connection left with no What.", [INTERACTION], (s, a) => remove(s, str(a, "interaction"))),
];
