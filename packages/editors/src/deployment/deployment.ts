/**
 * DeploymentEditor (Deployment): a Component's Deployments, their named Instances, and the
 * Connections between them. A Connection may bring with it what it needs — the import of an
 * Interaction its Component cannot reach yet, the use of a Language it does not speak yet —
 * when asked to: a client confirms first, since the Connection may be a mistake.
 */
import { accessibleInteractions, extendedLanguages, nameOf, remove as removeFromModel, setName, type Graph } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { addNamed, element, elements, flag, freshId, ids, operation, range, setBounds, str, text, type Operation } from "../operation.js";
import { reach } from "../contexts/exports.js";

const EDITOR = "DeploymentEditor";

export function addDeployment(session: EditSession, component: string, name: string): Edit {
  const id = freshId(session.target.graph, component, name);
  return session.edit("addition", `addDeployment ${name}`, [id], (graph) => addNamed(graph, "Deployment", id, name, component, "deployments"));
}

/** Places a named Instance of a child of the deployed Component, or of a Component it imports, with a range: `1..1` unless given. */
export function addInstance(session: EditSession, deployment: string, component: string, name: string, occupants = "1..1"): Edit {
  const id = freshId(session.target.graph, deployment, name);
  return session.edit("addition", `addInstance ${name}`, [id], (graph) => {
    addNamed(graph, "Instance", id, name, deployment, "instances");
    graph.connect(id, "of", component);
    setBounds(graph, id, occupants);
  });
}

/** Sets how many occupy an Instance: `1..1`, `0..1`, `0..N`, … */
export function setRange(session: EditSession, instance: string, occupants: string): Edit {
  return session.edit("change", `setRange ${occupants}`, [instance], (graph) => setBounds(graph, instance, occupants));
}

/** What a Connection from `instance` with `what` still needs: Interactions to import, and Languages to use. */
export function needs(graph: Graph, instance: string, what: readonly string[]): { imports: string[]; uses: string[] } {
  const [component] = graph.navigate(instance, "of");
  if (component === undefined) return { imports: [], uses: [] };
  const reachable = new Set(accessibleInteractions(graph, component));
  const spoken = new Set(graph.navigate(component, "uses").flatMap((language) => extendedLanguages(graph, language)));
  const imports = what.filter((interaction) => !reachable.has(interaction));
  const uses = [...new Set(what.flatMap((interaction) => graph.navigate(interaction, "language")))].filter((language) => !spoken.has(language));
  return { imports, uses };
}

export interface ConnectOptions {
  /** Also make the Component the Connection goes from reach each Interaction of its What it cannot reach yet (see `reach`). */
  readonly addImports?: boolean;
  /** Also make that Component use each Language of its What it does not speak. */
  readonly addUses?: boolean;
}

/** Connects an Instance to what offers `what`: another Instance, or the deployed Component itself. */
export function connect(session: EditSession, deployment: string, from: string, to: string, what: readonly string[], options: ConnectOptions = {}): Edit {
  const graph = session.target.graph;
  const id = freshId(graph, deployment, `${nameOf(graph, from) ?? "from"}-${nameOf(graph, what[0] ?? "") ?? "uses"}`);
  return session.edit("addition", "connect", [id], (graph) => {
    const missing = needs(graph, from, what);
    const [component] = graph.navigate(from, "of");
    graph.add("Connection", id);
    graph.connect(deployment, "connections", id);
    graph.connect(id, "from", from);
    graph.connect(id, graph.get(to).entity === "Instance" ? "to" : "toComponent", to);
    for (const interaction of what) graph.connect(id, "what", interaction);
    if (component === undefined) return;
    if (options.addImports) for (const interaction of missing.imports) reach(graph, component, interaction);
    if (options.addUses) for (const language of missing.uses) graph.connect(component, "uses", language);
  });
}

/** Sets the Interactions a Connection carries. */
export function setWhat(session: EditSession, connection: string, what: readonly string[]): Edit {
  return session.edit("change", "setWhat", [connection], (graph) => {
    graph.disconnect(connection, "what");
    for (const interaction of what) graph.connect(connection, "what", interaction);
  });
}

/** Renames a Deployment or an Instance. */
export function rename(session: EditSession, item: string, name: string): Edit {
  return session.edit("change", `rename ${name}`, [item], (graph) => setName(graph, item, name));
}

/** Removes a Deployment, an Instance or a Connection, with what goes with it. */
export function remove(session: EditSession, item: string): Edit {
  return session.edit("removal", "remove", [item], (graph) => void removeFromModel(graph, item));
}

const DEPLOYMENT = element("deployment", "Deployment", "the Deployment");

export const deploymentEditor: readonly Operation[] = [
  operation(EDITOR, "addDeployment", "addition", "Adds a Deployment — one way to put it together — to a Component.", [element("component", "Component", "the Component"), text("name", "the Deployment's name")], (s, a) =>
    addDeployment(s, str(a, "component"), str(a, "name")),
  ),
  operation(
    EDITOR,
    "addInstance",
    "addition",
    "Places a named Instance of a child of the deployed Component, or of a Component it imports, with how many occupy it (1..1 unless given).",
    [
      DEPLOYMENT,
      element("of", "Component", "the Component placed"),
      text("name", "the Instance's name, unique in the Deployment"),
      { ...range("range", "how many occupy it, such as 1..1 or 0..N"), optional: true },
    ],
    (s, a) => addInstance(s, str(a, "deployment"), str(a, "of"), str(a, "name"), (a.range as string | undefined) ?? "1..1"),
  ),
  operation(EDITOR, "setRange", "change", "Sets how many occupy an Instance: 1..1, 0..1, 0..N, …", [element("instance", "Instance", "the Instance"), range("range", "how many occupy it")], (s, a) =>
    setRange(s, str(a, "instance"), str(a, "range")),
  ),
  operation(
    EDITOR,
    "connect",
    "addition",
    "Connects an Instance to what offers some Interactions: another Instance, or the deployed Component. Optionally also imports the Interactions, and uses their Language, where the Instance's Component does not yet.",
    [
      DEPLOYMENT,
      element("from", "Instance", "the Instance that uses the What"),
      element("to", ["Instance", "Component"], "the Instance offering the What, or the deployed Component"),
      elements("what", "Interaction", "the Interactions, all over one Language"),
      flag("addImports", "also import what the Instance's Component cannot reach", true),
      flag("addUses", "also use the Language the Instance's Component does not speak", true),
    ],
    (s, a) => connect(s, str(a, "deployment"), str(a, "from"), str(a, "to"), ids(a, "what"), { addImports: a.addImports === true, addUses: a.addUses === true }),
  ),
  operation(EDITOR, "setWhat", "change", "Sets the Interactions a Connection carries.", [element("connection", "Connection", "the Connection"), elements("what", "Interaction", "the Interactions")], (s, a) =>
    setWhat(s, str(a, "connection"), ids(a, "what")),
  ),
  operation(EDITOR, "rename", "change", "Renames a Deployment or an Instance.", [element("item", ["Deployment", "Instance"], "the Deployment or Instance"), text("name", "the new name")], (s, a) =>
    rename(s, str(a, "item"), str(a, "name")),
  ),
  operation(
    EDITOR,
    "remove",
    "removal",
    "Removes a Deployment, an Instance or a Connection: an Instance with its Connections, a Deployment with its Instances and Connections.",
    [element("item", ["Deployment", "Instance", "Connection"], "what to remove")],
    (s, a) => remove(s, str(a, "item")),
  ),
];
