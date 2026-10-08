/**
 * ComponentEditor (Contexts): a Component — its children, Languages and Transformations, the
 * Languages it uses, and the Components and Transformations it imports. Adding a Language or
 * a Transformation is here because the Component owns it. What layers above add to a
 * Component — Interactions, Deployments, Mediums — their own editors add.
 */
import { remove as removeFromModel, setName } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { addNamed, element, freshId, operation, str, text, type Operation } from "../operation.js";

const EDITOR = "ComponentEditor";

/** What a Component imports, by the Entity imported, as far as Contexts knows. */
const IMPORTS: Record<string, string> = { Component: "importedComponents", Transformation: "importedTransformations" };

export function addComponent(session: EditSession, parent: string, name: string): Edit {
  const id = freshId(session.target.graph, parent, name);
  return session.edit("addition", `addComponent ${name}`, [id], (graph) => addNamed(graph, "Component", id, name, parent, "components"));
}

export function addLanguage(session: EditSession, component: string, name: string): Edit {
  const id = freshId(session.target.graph, component, name);
  return session.edit("addition", `addLanguage ${name}`, [id], (graph) => addNamed(graph, "Language", id, name, component, "languages"));
}

/** Adds a Transformation from one Language to another, held by the Component. */
export function addTransformation(session: EditSession, component: string, name: string, source: string, target: string): Edit {
  const id = freshId(session.target.graph, component, name);
  return session.edit("addition", `addTransformation ${name}`, [id], (graph) => {
    addNamed(graph, "Transformation", id, name, component, "transformations");
    graph.connect(id, "source", source);
    graph.connect(id, "target", target);
  });
}

export function use(session: EditSession, component: string, language: string): Edit {
  return session.edit("change", "use", [component, language], (graph) => graph.connect(component, "uses", language));
}

/** Stops using a Language. What depended on it stays, and is diagnosed. */
export function unuse(session: EditSession, component: string, language: string): Edit {
  return session.edit("change", "unuse", [component, language], (graph) => graph.disconnect(component, "uses", language));
}

/** Imports a Component or a Transformation. */
export function importItem(session: EditSession, component: string, item: string): Edit {
  return session.edit("change", "import", [component, item], (graph) => graph.connect(component, IMPORTS[graph.get(item).entity]!, item));
}

/** Stops importing a Component or a Transformation. What depended on it stays, and is diagnosed. */
export function unimportItem(session: EditSession, component: string, item: string): Edit {
  return session.edit("change", "unimport", [component, item], (graph) => graph.disconnect(component, IMPORTS[graph.get(item).entity]!, item));
}

/** Nests a Component in another, beside its new siblings. */
export function move(session: EditSession, component: string, parent: string): Edit {
  return session.edit("change", "move", [component, parent], (graph) => {
    graph.disconnect(component, "parent");
    graph.disconnect(component, "system");
    graph.connect(parent, "components", component);
  });
}

export function rename(session: EditSession, component: string, name: string): Edit {
  return session.edit("change", `rename Component ${name}`, [component], (graph) => setName(graph, component, name));
}

/** Removes a Component with everything it owns, its Instances and their Connections. */
export function remove(session: EditSession, component: string): Edit {
  return session.edit("removal", "remove Component", [component], (graph) => void removeFromModel(graph, component));
}

const COMPONENT = element("component", "Component", "the Component");
const IMPORTED = element("item", ["Component", "Transformation"], "the Component or Transformation");

export const componentEditor: readonly Operation[] = [
  operation(EDITOR, "addComponent", "addition", "Adds a child Component.", [element("parent", "Component", "the parent"), text("name", "the child's name")], (s, a) =>
    addComponent(s, str(a, "parent"), str(a, "name")),
  ),
  operation(EDITOR, "addLanguage", "addition", "Adds an empty Language to a Component.", [COMPONENT, text("name", "the Language's name")], (s, a) =>
    addLanguage(s, str(a, "component"), str(a, "name")),
  ),
  operation(
    EDITOR,
    "addTransformation",
    "addition",
    "Adds a Transformation held by a Component, from a source Language to a target Language, both of which it uses.",
    [COMPONENT, text("name", "the Transformation's name"), element("source", "Language", "the source Language"), element("target", "Language", "the target Language")],
    (s, a) => addTransformation(s, str(a, "component"), str(a, "name"), str(a, "source"), str(a, "target")),
  ),
  operation(EDITOR, "use", "change", "Makes a Component use a Language in its scope.", [COMPONENT, element("language", "Language", "the Language")], (s, a) =>
    use(s, str(a, "component"), str(a, "language")),
  ),
  operation(EDITOR, "unuse", "change", "Stops a Component using a Language.", [COMPONENT, element("language", "Language", "the Language")], (s, a) =>
    unuse(s, str(a, "component"), str(a, "language")),
  ),
  operation(EDITOR, "import", "change", "Makes a Component import a Component or a Transformation.", [COMPONENT, IMPORTED], (s, a) =>
    importItem(s, str(a, "component"), str(a, "item")),
  ),
  operation(EDITOR, "unimport", "change", "Stops a Component importing a Component or a Transformation.", [COMPONENT, IMPORTED], (s, a) =>
    unimportItem(s, str(a, "component"), str(a, "item")),
  ),
  operation(EDITOR, "move", "change", "Nests a Component in another.", [COMPONENT, element("parent", "Component", "the new parent")], (s, a) =>
    move(s, str(a, "component"), str(a, "parent")),
  ),
  operation(EDITOR, "rename", "change", "Renames a Component.", [COMPONENT, text("name", "the new name")], (s, a) => rename(s, str(a, "component"), str(a, "name"))),
  operation(EDITOR, "remove", "removal", "Removes a Component: everything it owns, its Instances, and their Connections.", [COMPONENT], (s, a) =>
    remove(s, str(a, "component")),
  ),
];
