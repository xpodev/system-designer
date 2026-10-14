/**
 * InteractionEditor (Contexts): adding an Interaction to a Component, and the Language it is
 * over. Its Parameters and output are the FunctionEditor's; exporting and importing it, the
 * ComponentEditor's.
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
];
