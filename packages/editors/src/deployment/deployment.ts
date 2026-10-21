/**
 * DeploymentEditor (Deployment): the Deployments of a box — its internal layouts, each kept in a
 * Component: the box itself, or another, such as a plug-in package — their named Instances, the
 * Deployment each Instance runs if fixed, the Connections between them, what each Deployment
 * exposes, and the identities it imports. A Connection is the layout's structure, through
 * interfaces; one that goes out through the box may bring with it the import its Deployment
 * needs, when asked to: a client confirms first, since the Connection may be a mistake.
 */
import {
  identityPath,
  imported,
  nameOf,
  remove as removeFromModel,
  setIdentitySteps,
  setName,
  type Graph,
} from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { addNamed, element, elements, flag, freshId, ids, maybe, operation, range, setBounds, str, text, type Operation } from "../operation.js";
import { importIn, reach } from "../contexts/exports.js";

const EDITOR = "DeploymentEditor";

/**
 * Adds a Deployment of a box — one way to build it — kept in `keeper`: the box itself, unless
 * given. A Deployment kept outside its box imports the box.
 */
export function addDeployment(session: EditSession, component: string, name: string, keeper: string = component): Edit {
  const id = freshId(session.target.graph, keeper, name);
  return session.edit("addition", `addDeployment ${name}`, [id], (graph) => {
    addNamed(graph, "Deployment", id, name, keeper, "kept");
    graph.connect(id, "component", component);
    if (keeper !== component) importIn(graph, id, component);
  });
}

/** Places a named Instance of a box in the Deployment's scope, with a range: `1..1` unless given. */
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

/** Fixes the Deployment of its box an Instance runs, or, with none, leaves it to the Configuration. */
export function setRuns(session: EditSession, instance: string, deployment: string | undefined): Edit {
  return session.edit("change", "setRuns", [instance], (graph) => {
    graph.disconnect(instance, "runs");
    if (deployment !== undefined) graph.connect(instance, "runs", deployment);
  });
}

/** Makes a Deployment expose one of its placements, as an API: identities may go through it. */
export function expose(session: EditSession, deployment: string, instance: string): Edit {
  const graph = session.target.graph;
  const existing = graph.navigate(deployment, "exposes").find((e) => graph.navigate(e, "instance").includes(instance));
  const id = existing ?? freshId(graph, deployment, `exposes ${nameOf(graph, instance) ?? "instance"}`);
  return session.edit("addition", "expose", [id], (graph) => {
    if (existing !== undefined) return;
    graph.add("Export", id);
    graph.connect(deployment, "exposes", id);
    graph.connect(id, "instance", instance);
  });
}

/** Makes a Deployment import an identity: a path of exposed placements from the root down. */
export function importIdentity(session: EditSession, deployment: string, path: readonly string[]): Edit {
  const graph = session.target.graph;
  const id = freshId(graph, deployment, `identity ${path.map((p) => nameOf(graph, p) ?? "").join(" ")}`);
  return session.edit("addition", "importIdentity", [id], (graph) => {
    graph.add("Import", id);
    graph.connect(deployment, "imports", id);
    const steps = path.map((instance, index) => {
      const step = `${id}#${index}`;
      graph.add("Step", step);
      graph.connect(step, "instance", instance);
      return step;
    });
    setIdentitySteps(graph, id, steps);
  });
}

/** The identities a Deployment imports, each with its path. */
export function identities(graph: Graph, deployment: string): { id: string; path: string[] }[] {
  return graph
    .navigate(deployment, "imports")
    .filter((m) => graph.navigate(m, "steps").length > 0)
    .map((id) => ({ id, path: identityPath(graph, id) }));
}

/**
 * What a Connection to `to` with `what` still needs: the Interactions its Deployment must import.
 * Only a Connection out through the box needs any — to an Interaction the box does not offer. A
 * Connection between Instances, or to an identity, needs nothing: it is structure, through the
 * interfaces of what it joins.
 */
export function needs(graph: Graph, deployment: string, to: string, what: readonly string[]): { imports: string[] } {
  const [box] = graph.navigate(deployment, "component");
  if (to !== box || box === undefined) return { imports: [] };
  const offered = new Set([
    ...graph.navigate(box, "interactions"),
    ...graph.navigate(box, "exports").flatMap((e) => graph.navigate(e, "component")).flatMap((api) => graph.navigate(api, "interactions")),
    ...imported(graph, deployment, "Interaction"),
  ]);
  return { imports: what.filter((interaction) => !offered.has(interaction)) };
}

export interface ConnectOptions {
  /** Also make the Deployment import each Interaction a Connection out through its box needs (see `reach`). */
  readonly addImports?: boolean;
}

/** Connects an Instance to what offers `what`: another Instance, an identity the Deployment imports, or the box itself. */
export function connect(session: EditSession, deployment: string, from: string, to: string, what: readonly string[], options: ConnectOptions = {}): Edit {
  const graph = session.target.graph;
  const id = freshId(graph, deployment, `${nameOf(graph, from) ?? "from"}-${nameOf(graph, what[0] ?? "") ?? "uses"}`);
  return session.edit("addition", "connect", [id], (graph) => {
    const missing = needs(graph, deployment, to, what);
    graph.add("Connection", id);
    graph.connect(deployment, "connections", id);
    graph.connect(id, "from", from);
    const entity = graph.get(to).entity;
    graph.connect(id, entity === "Instance" ? "to" : entity === "Import" ? "toIdentity" : "toComponent", to);
    for (const interaction of what) graph.connect(id, "what", interaction);
    if (options.addImports) for (const interaction of missing.imports) reach(graph, deployment, interaction);
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

/** Removes a Deployment, an Instance, a Connection, an exposure or an identity, with what goes with it. */
export function remove(session: EditSession, item: string): Edit {
  return session.edit("removal", "remove", [item], (graph) => void removeFromModel(graph, item));
}

const DEPLOYMENT = element("deployment", "Deployment", "the Deployment");

export const deploymentEditor: readonly Operation[] = [
  operation(
    EDITOR,
    "addDeployment",
    "addition",
    "Adds a Deployment of a box — one way to build it — kept in the box itself, or in another Component, such as a plug-in package, which then imports the box.",
    [element("component", "Component", "the box"), text("name", "the Deployment's name"), element("keeper", "Component", "where it is kept: the box itself unless given", true)],
    (s, a) => addDeployment(s, str(a, "component"), str(a, "name"), maybe(a, "keeper") ?? str(a, "component")),
  ),
  operation(
    EDITOR,
    "addInstance",
    "addition",
    "Places a named Instance of a box in the Deployment's scope — a child of its box or keeper, or of theirs, or a top-level Component it imports — with how many occupy it (1..1 unless given).",
    [
      DEPLOYMENT,
      element("of", "Component", "the box placed"),
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
    "setRuns",
    "change",
    "Fixes which Deployment of its box an Instance runs, or, with none, leaves the choice to the Configuration.",
    [element("instance", "Instance", "the Instance"), element("deployment", "Deployment", "a Deployment of the Instance's box", true)],
    (s, a) => setRuns(s, str(a, "instance"), maybe(a, "deployment")),
  ),
  operation(
    EDITOR,
    "expose",
    "addition",
    "Makes a Deployment expose one of its placements, as an API: an identity may go through it.",
    [DEPLOYMENT, element("instance", "Instance", "a placement of the Deployment")],
    (s, a) => expose(s, str(a, "deployment"), str(a, "instance")),
  ),
  operation(
    EDITOR,
    "importIdentity",
    "addition",
    "Makes a Deployment import an identity: a real object, named by its path of exposed placements from the System's root down.",
    [DEPLOYMENT, elements("path", "Instance", "the placements, from the root down")],
    (s, a) => importIdentity(s, str(a, "deployment"), ids(a, "path")),
  ),
  operation(
    EDITOR,
    "connect",
    "addition",
    "Connects an Instance to what offers some Interactions: another Instance, an identity the Deployment imports, or the box itself. Optionally also imports what a Connection out through the box needs.",
    [
      DEPLOYMENT,
      element("from", "Instance", "the Instance that uses the What"),
      element("to", ["Instance", "Import", "Component"], "the Instance offering the What, an identity, or the Deployment's box"),
      elements("what", "Interaction", "the Interactions, all over one Language"),
      flag("addImports", "also import what a Connection out through the box needs", true),
    ],
    (s, a) => connect(s, str(a, "deployment"), str(a, "from"), str(a, "to"), ids(a, "what"), { addImports: a.addImports === true }),
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
    "Removes a Deployment, an Instance, a Connection, an exposure or an identity: an Instance with its Connections, a Deployment with its Instances and Connections.",
    [element("item", ["Deployment", "Instance", "Connection", "Export", "Import"], "what to remove")],
    (s, a) => remove(s, str(a, "item")),
  ),
];
