/**
 * ComponentEditor (Contexts): a Component — a box: its children, Languages and Transformations,
 * the Languages it uses, what it exports, and what it imports, which for a box is vocabulary
 * and for a Deployment its needs. Adding a Language or a Transformation is here because the
 * Component owns it. What layers above add to a Component — Deployments, Mediums — their own
 * editors add; a Medium or a kept Deployment is exported here, like anything else.
 */
import { nameOf, remove as removeFromModel, setName, setParameters } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { addNamed, element, freshId, operation, str, text, type Operation } from "../operation.js";
import { exportIn, follow, importIn, route, take } from "./exports.js";

const EDITOR = "ComponentEditor";

/** What a Component may export: something of its own, a child, or a Deployment it keeps. */
const EXPORTABLE = ["Component", "Language", "Interaction", "Transformation", "Medium", "Deployment"];

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

export function use(session: EditSession, component: string, language: string): Edit {
  return session.edit("change", "use", [component, language], (graph) => graph.connect(component, "uses", language));
}

/** Stops using a Language. What depended on it stays, and is diagnosed. */
export function unuse(session: EditSession, component: string, language: string): Edit {
  return session.edit("change", "unuse", [component, language], (graph) => graph.disconnect(component, "uses", language));
}

/** Makes a Component export something: one of its own, or a child, which others may then place. */
export function exportItem(session: EditSession, component: string, item: string): Edit {
  const graph = session.target.graph;
  const existing = graph.navigate(component, "exports").find((id) => graph.navigate(id, graph.get(item).entity.replace(/^./, (c) => c.toLowerCase())).includes(item));
  const id = existing ?? `${component}:${item}`;
  return session.edit("addition", "export", [id], (graph) => void exportIn(graph, component, item));
}

/** Removes an Export. Imports that took it keep the rest. */
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
 * Makes a Component reach something inside another: its owner exports it, and the Component
 * imports it; a Component it imports as a whole, exported by its parent if it must be to be placed.
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
const IMPORTER = element("component", ["Component", "Deployment"], "the Component, for its vocabulary, or a Deployment, for its needs");

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
    "Makes a Component export one of its own Languages, Interactions, Transformations or Mediums, one of its children, as an API, or a Deployment it keeps. What is exported, any Component may import; what is not, nothing outside it can reach.",
    [COMPONENT, element("item", EXPORTABLE, "what it exports")],
    (s, a) => exportItem(s, str(a, "component"), str(a, "item")),
  ),
  operation(EDITOR, "unexport", "removal", "Removes an Export; Imports that took it keep the rest.", [element("export", "Export", "the Export")], (s, a) =>
    unexport(s, str(a, "export")),
  ),
  operation(
    EDITOR,
    "import",
    "change",
    "Makes a Component import Languages from another, anywhere, or a Deployment import what it needs: an Interaction, a Transformation, a Medium, a Deployment, or a top-level Component as a whole, to place it. Takes an Export in the Import from the Export's Component.",
    [IMPORTER, IMPORTED],
    (s, a) => importItem(s, str(a, "component"), str(a, "item")),
  ),
  operation(EDITOR, "unimport", "change", "Stops a Component or a Deployment importing from a Component, or taking an Export.", [IMPORTER, IMPORTED], (s, a) =>
    unimportItem(s, str(a, "component"), str(a, "item")),
  ),
  operation(
    EDITOR,
    "reach",
    "change",
    "Makes a Component reach a Language, or a Deployment reach what it needs — a Component, Deployment, Interaction, Transformation or Medium: exported by its owner, and imported from it.",
    [IMPORTER, element("item", ["Component", "Deployment", "Language", "Interaction", "Transformation", "Medium"], "what it reaches")],
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
