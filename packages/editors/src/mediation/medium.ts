/**
 * MediumEditor (Mediation): a Medium — its Language, and its call, an Interaction of the
 * Component that defines it over that Language — and the Mediums a Component imports. The
 * Language comes first; the call is then one of its Component's Interactions over it, or a new
 * one.
 */
import { remove as removeFromModel, setName } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { addNamed, element, freshId, maybe, operation, str, text, type Operation } from "../operation.js";

const EDITOR = "MediumEditor";

/** Adds a Medium defined by a Component, over one of the Languages it uses; its call may be chosen later. */
export function addMedium(session: EditSession, component: string, name: string, language: string, call?: string): Edit {
  const id = freshId(session.target.graph, component, name);
  return session.edit("addition", `addMedium ${name}`, [id], (graph) => {
    addNamed(graph, "Medium", id, name, component, "mediums");
    graph.connect(id, "language", language);
    if (call !== undefined) graph.connect(id, "call", call);
  });
}

/** Sets a Medium's Language. A call over another Language stays, and is diagnosed. */
export function setLanguage(session: EditSession, medium: string, language: string): Edit {
  return session.edit("change", "setLanguage", [medium], (graph) => {
    graph.disconnect(medium, "language");
    graph.connect(medium, "language", language);
  });
}

export function setCall(session: EditSession, medium: string, call: string): Edit {
  return session.edit("change", "setCall", [medium], (graph) => {
    graph.disconnect(medium, "call");
    graph.connect(medium, "call", call);
  });
}

/** Creates the call: a new Interaction of the Medium's Component, over its Language, with an output Entity. */
export function createCall(session: EditSession, medium: string, name: string, output: string): Edit {
  const graph = session.target.graph;
  const [component] = graph.navigate(medium, "component");
  const id = freshId(graph, component ?? medium, name);
  return session.edit("addition", `createCall ${name}`, [id], (graph) => {
    const [definer] = graph.navigate(medium, "component");
    const [language] = graph.navigate(medium, "language");
    if (definer === undefined) return;
    addNamed(graph, "Interaction", id, name, definer, "interactions");
    if (language !== undefined) graph.connect(id, "language", language);
    graph.connect(id, "output", output);
    graph.disconnect(medium, "call");
    graph.connect(medium, "call", id);
  });
}

export function rename(session: EditSession, medium: string, name: string): Edit {
  return session.edit("change", `rename Medium ${name}`, [medium], (graph) => setName(graph, medium, name));
}

/** Removes a Medium. Mediations over it stay in their stacks, broken. */
export function remove(session: EditSession, medium: string): Edit {
  return session.edit("removal", "remove Medium", [medium], (graph) => void removeFromModel(graph, medium));
}

const MEDIUM = element("medium", "Medium", "the Medium");

export const mediumEditor: readonly Operation[] = [
  operation(
    EDITOR,
    "addMedium",
    "addition",
    "Adds a Medium defined by a Component: what a What can be passed over, in one of the Languages the Component uses, through a call.",
    [
      element("component", "Component", "the Component defining the medium"),
      text("name", "the Medium's name"),
      element("language", "Language", "the Medium's Language"),
      element("call", "Interaction", "the call: an Interaction of the Component over that Language", true),
    ],
    (s, a) => addMedium(s, str(a, "component"), str(a, "name"), str(a, "language"), maybe(a, "call")),
  ),
  operation(EDITOR, "setLanguage", "change", "Sets a Medium's Language.", [MEDIUM, element("language", "Language", "the Language")], (s, a) =>
    setLanguage(s, str(a, "medium"), str(a, "language")),
  ),
  operation(EDITOR, "setCall", "change", "Sets a Medium's call.", [MEDIUM, element("call", "Interaction", "the call")], (s, a) => setCall(s, str(a, "medium"), str(a, "call"))),
  operation(
    EDITOR,
    "createCall",
    "addition",
    "Creates a Medium's call: a new Interaction of its Component, over its Language.",
    [MEDIUM, text("name", "the call's name"), element("output", "Entity", "the call's output Entity")],
    (s, a) => createCall(s, str(a, "medium"), str(a, "name"), str(a, "output")),
  ),
  operation(EDITOR, "rename", "change", "Renames a Medium.", [MEDIUM, text("name", "the new name")], (s, a) => rename(s, str(a, "medium"), str(a, "name"))),
  operation(EDITOR, "remove", "removal", "Removes a Medium; Mediations over it stay, broken.", [MEDIUM], (s, a) => remove(s, str(a, "medium"))),
];
