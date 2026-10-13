/**
 * InteractionEditor (Contexts): adding an Interaction to a Component, the Language it is over,
 * and the Interactions a Component imports. Its Parameters and output are the FunctionEditor's.
 */
import type { Edit, EditSession } from "@systemathic/editing";
import { addNamed, element, freshId, maybe, operation, str, text, type Operation } from "../operation.js";

const EDITOR = "InteractionEditor";

/** Adds an Interaction to a Component, over one of the Languages it uses, with its output Entity, or none. */
export function addInteraction(session: EditSession, component: string, language: string, name: string, output?: string): Edit {
  const id = freshId(session.target.graph, component, name);
  return session.edit("addition", `addInteraction ${name}`, [id], (graph) => {
    addNamed(graph, "Interaction", id, name, component, "interactions");
    graph.connect(id, "language", language);
    if (output !== undefined) graph.connect(id, "output", output);
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

const INTERACTION = element("interaction", "Interaction", "the Interaction");

export const interactionEditor: readonly Operation[] = [
  operation(
    EDITOR,
    "addInteraction",
    "addition",
    "Adds an Interaction to a Component, over one of the Languages it uses, with its output Entity or none; Parameters are added one by one.",
    [
      element("component", "Component", "the Component offering it"),
      element("language", "Language", "the Language it is over"),
      text("name", "the Interaction's name"),
      element("output", "Entity", "the output Entity; none for an Interaction that gives nothing back", true),
    ],
    (s, a) => addInteraction(s, str(a, "component"), str(a, "language"), str(a, "name"), maybe(a, "output")),
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
];
