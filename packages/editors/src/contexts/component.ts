/**
 * ComponentEditor (Contexts): a Component — its children, Languages and Transformations, the
 * Languages it uses, what it exports and imports, and the Components it implements. Adding a
 * Language or a Transformation is here because the Component owns it. What layers above add
 * to a Component — Deployments, Mediums — their own editors add; a Medium is exported and
 * imported here, like anything else a Component offers.
 */
import { nameOf, remove as removeFromModel, setName, setParameters } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { addNamed, element, freshId, operation, str, text, type Operation } from "../operation.js";
import { exportIn, follow, importIn, route, take } from "./exports.js";

const EDITOR = "ComponentEditor";

/** What a Component may export: something of its own, a child, or a child's Export. */
const EXPORTABLE = ["Component", "Language", "Interaction", "Transformation", "Medium", "Export"];

export function addComponent(session: EditSession, parent: string, name: string): Edit {
  const id = freshId(session.target.graph, parent, name);
  return session.edit("addition", `addComponent ${name}`, [id], (graph) => addNamed(graph, "Component", id, name, parent, "components"));
}

export function addLanguage(session: EditSession, component: string, name: string): Edit {
  const id = freshId(session.target.graph, component, name);
  return session.edit("addition", `addLanguage ${name}`, [id], (graph) => addNamed(graph, "Language", id, name, component, "languages"));
}

/**
 * Adds a Transformation held by the Component: from an input of one Language to an output of
 * another. More inputs, all of the input's Language, are the FunctionEditor's to add.
 */
export function addTransformation(session: EditSession, component: string, name: string, input: string, output: string): Edit {
  const graph = session.target.graph;
  const id = freshId(graph, component, name);
  const inputName = (nameOf(graph, input) ?? "input").replace(/^./, (c) => c.toLowerCase());
  const parameter = freshId(graph, id, inputName);
  return session.edit("addition", `addTransformation ${name}`, [id], (graph) => {
    addNamed(graph, "Transformation", id, name, component, "transformations");
    graph.add("Parameter", parameter);
    setName(graph, parameter, inputName);
    graph.connect(parameter, "type", input);
    setParameters(graph, id, [parameter]);
    graph.connect(id, "output", output);
  });
}

/** Makes a Component an implementation of another: it imports it, and may stand wherever it is placed. */
export function implement(session: EditSession, component: string, implemented: string): Edit {
  const way = route(session.target.graph, component, implemented);
  return session.edit("change", "implement", [component, implemented], (graph) => {
    graph.connect(component, "implements", implemented);
    follow(graph, component, way);
  });
}

/** Stops a Component implementing another; the import stays. */
export function unimplement(session: EditSession, component: string, implemented: string): Edit {
  return session.edit("change", "unimplement", [component, implemented], (graph) => graph.disconnect(component, "implements", implemented));
}

export function use(session: EditSession, component: string, language: string): Edit {
  return session.edit("change", "use", [component, language], (graph) => graph.connect(component, "uses", language));
}

/** Stops using a Language. What depended on it stays, and is diagnosed. */
export function unuse(session: EditSession, component: string, language: string): Edit {
  return session.edit("change", "unuse", [component, language], (graph) => graph.disconnect(component, "uses", language));
}

/** Makes a Component export something: one of its own, a child, or a child's Export, to re-export it. */
export function exportItem(session: EditSession, component: string, item: string): Edit {
  const graph = session.target.graph;
  const existing = graph.navigate(component, "exports").find((id) => graph.navigate(id, graph.get(item).entity.replace(/^./, (c) => c.toLowerCase())).includes(item));
  const id = existing ?? `${component}:${item}`;
  return session.edit("addition", "export", [id], (graph) => void exportIn(graph, component, item));
}

/** Removes an Export, with its re-exports. Imports that took it keep the rest. */
export function unexport(session: EditSession, exported: string): Edit {
  return session.edit("removal", "unexport", [exported], (graph) => void removeFromModel(graph, exported));
}

/** Imports from a Component — to place it, and to take its Exports — or takes an Export, in the Import from its exporter. */
export function importItem(session: EditSession, component: string, item: string): Edit {
  return session.edit("change", "import", [component, item], (graph) => {
    if (graph.get(item).entity === "Export") take(graph, component, item);
    else importIn(graph, component, item);
  });
}

/** Stops importing from a Component, or stops taking an Export. What depended on it stays, and is diagnosed. */
export function unimportItem(session: EditSession, component: string, item: string): Edit {
  return session.edit("change", "unimport", [component, item], (graph) => {
    const imports = graph.navigate(component, "imports");
    if (graph.get(item).entity === "Export") for (const id of imports) graph.disconnect(id, "exports", item);
    else removeFromModel(graph, ...imports.filter((id) => graph.navigate(id, "from").includes(item)));
  });
}

/**
 * Makes a Component reach something inside another: its owner exports it, each Component
 * the owner is nested in re-exports it, up to one the Component may import from, and the
 * Component imports it from there.
 */
export function reachItem(session: EditSession, component: string, item: string): Edit {
  const way = route(session.target.graph, component, item);
  return session.edit("change", "reach", [component, item], (graph) => follow(graph, component, way));
}

/** Nests a Component in another, beside its new siblings. */
export function move(session: EditSession, component: string, parent: string): Edit {
  return session.edit("change", "move", [component, parent], (graph) => {
    graph.disconnect(component, "parent");
    for (const system of graph.ofEntity("System")) graph.disconnect(system, "packages", component);
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
const IMPORTED = element("item", ["Component", "Export"], "the Component imported from, or the Export taken");

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
    "Adds a Transformation held by a Component, from an input Entity of one Language it uses to an output Entity of another.",
    [COMPONENT, text("name", "the Transformation's name"), element("input", "Entity", "the input's Entity"), element("output", "Entity", "the output Entity")],
    (s, a) => addTransformation(s, str(a, "component"), str(a, "name"), str(a, "input"), str(a, "output")),
  ),
  operation(
    EDITOR,
    "implement",
    "change",
    "Makes a Component implement another: an alternative to it, wherever it is placed. It imports what it implements.",
    [COMPONENT, element("implemented", "Component", "the Component implemented")],
    (s, a) => implement(s, str(a, "component"), str(a, "implemented")),
  ),
  operation(EDITOR, "unimplement", "change", "Stops a Component implementing another.", [COMPONENT, element("implemented", "Component", "the Component implemented")], (s, a) =>
    unimplement(s, str(a, "component"), str(a, "implemented")),
  ),
  operation(EDITOR, "use", "change", "Makes a Component use a Language in its scope.", [COMPONENT, element("language", "Language", "the Language")], (s, a) =>
    use(s, str(a, "component"), str(a, "language")),
  ),
  operation(EDITOR, "unuse", "change", "Stops a Component using a Language.", [COMPONENT, element("language", "Language", "the Language")], (s, a) =>
    unuse(s, str(a, "component"), str(a, "language")),
  ),
  operation(
    EDITOR,
    "export",
    "addition",
    "Makes a Component export one of its own Languages, Interactions, Transformations or Mediums, one of its children, or a child's Export (a re-export). What a Component does not export, nothing outside it can reach.",
    [COMPONENT, element("item", EXPORTABLE, "what it exports")],
    (s, a) => exportItem(s, str(a, "component"), str(a, "item")),
  ),
  operation(EDITOR, "unexport", "removal", "Removes an Export, with its re-exports; Imports that took it keep the rest.", [element("export", "Export", "the Export")], (s, a) =>
    unexport(s, str(a, "export")),
  ),
  operation(
    EDITOR,
    "import",
    "change",
    "Makes a Component import from another — a sibling, one a Component it is nested in imports from, or one it reaches through an Export — or take an Export, in its Import from the Export's Component.",
    [COMPONENT, IMPORTED],
    (s, a) => importItem(s, str(a, "component"), str(a, "item")),
  ),
  operation(EDITOR, "unimport", "change", "Stops a Component importing from a Component, or taking an Export.", [COMPONENT, IMPORTED], (s, a) =>
    unimportItem(s, str(a, "component"), str(a, "item")),
  ),
  operation(
    EDITOR,
    "reach",
    "change",
    "Makes a Component reach a Component, Language, Interaction, Transformation or Medium: exported by its owner, re-exported up to a Component it may import from, and imported from there.",
    [COMPONENT, element("item", ["Component", "Language", "Interaction", "Transformation", "Medium"], "what it reaches")],
    (s, a) => reachItem(s, str(a, "component"), str(a, "item")),
  ),
  operation(EDITOR, "move", "change", "Nests a Component in another.", [COMPONENT, element("parent", "Component", "the new parent")], (s, a) =>
    move(s, str(a, "component"), str(a, "parent")),
  ),
  operation(EDITOR, "rename", "change", "Renames a Component.", [COMPONENT, text("name", "the new name")], (s, a) => rename(s, str(a, "component"), str(a, "name"))),
  operation(EDITOR, "remove", "removal", "Removes a Component: everything it owns, its Instances, and their Connections.", [COMPONENT], (s, a) =>
    remove(s, str(a, "component")),
  ),
];
