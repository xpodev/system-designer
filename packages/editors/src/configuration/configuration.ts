/**
 * ConfigurationEditor (Configuration): a System's Configurations, each a tree of choices — a
 * Deployment of the root first, and below a choice, a Deployment for each Instance of the
 * Deployment chosen there.
 */
import { remove as removeFromModel, setName } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { addNamed, element, freshId, operation, str, text, type Operation } from "../operation.js";

const EDITOR = "ConfigurationEditor";

/** Adds a Configuration that starts with a Deployment of the root. */
export function addConfiguration(session: EditSession, system: string, name: string, deployment: string): Edit {
  const id = freshId(session.target.graph, system, name);
  return session.edit("addition", `addConfiguration ${name}`, [id], (graph) => {
    addNamed(graph, "Configuration", id, name, system, "configurations");
    const root = `${id}#root`;
    graph.add("Choice", root);
    graph.connect(id, "root", root);
    graph.connect(root, "deployment", deployment);
  });
}

/**
 * Chooses a Deployment for an Instance below a choice. A different Deployment than before
 * drops what was chosen beneath, which was for the old one's Instances.
 */
export function choose(session: EditSession, choice: string, instance: string, deployment: string): Edit {
  const graph = session.target.graph;
  const existing = graph.navigate(choice, "choices").find((child) => graph.navigate(child, "instance").includes(instance));
  const id = existing ?? freshId(graph, choice, "choice");
  return session.edit("change", "choose", [id], (graph) => {
    if (existing === undefined) {
      graph.add("Choice", id);
      graph.connect(choice, "choices", id);
      graph.connect(id, "instance", instance);
    } else if (!graph.navigate(id, "deployment").includes(deployment)) {
      for (const beneath of graph.navigate(id, "choices")) removeFromModel(graph, beneath);
    }
    graph.disconnect(id, "deployment");
    graph.connect(id, "deployment", deployment);
  });
}

/** Leaves an Instance's Deployment open again, with everything chosen beneath it. */
export function unchoose(session: EditSession, choice: string): Edit {
  return session.edit("removal", "unchoose", [choice], (graph) => void removeFromModel(graph, choice));
}

export function rename(session: EditSession, configuration: string, name: string): Edit {
  return session.edit("change", `rename Configuration ${name}`, [configuration], (graph) => setName(graph, configuration, name));
}

export function remove(session: EditSession, configuration: string): Edit {
  return session.edit("removal", "remove Configuration", [configuration], (graph) => void removeFromModel(graph, configuration));
}

const CONFIGURATION = element("configuration", "Configuration", "the Configuration");

export const configurationEditor: readonly Operation[] = [
  operation(
    EDITOR,
    "addConfiguration",
    "addition",
    "Adds a Configuration to a System, starting with a Deployment of its root.",
    [element("system", "System", "the System"), text("name", "the Configuration's name"), element("deployment", "Deployment", "a Deployment of the root")],
    (s, a) => addConfiguration(s, str(a, "system"), str(a, "name"), str(a, "deployment")),
  ),
  operation(
    EDITOR,
    "choose",
    "change",
    "Chooses a Deployment for an Instance of the Deployment chosen at a choice.",
    [element("choice", "Choice", "the choice above"), element("instance", "Instance", "the Instance"), element("deployment", "Deployment", "a Deployment of the Instance's Component")],
    (s, a) => choose(s, str(a, "choice"), str(a, "instance"), str(a, "deployment")),
  ),
  operation(EDITOR, "unchoose", "removal", "Leaves an Instance's Deployment open again.", [element("choice", "Choice", "the choice")], (s, a) => unchoose(s, str(a, "choice"))),
  operation(EDITOR, "rename", "change", "Renames a Configuration.", [CONFIGURATION, text("name", "the new name")], (s, a) => rename(s, str(a, "configuration"), str(a, "name"))),
  operation(EDITOR, "remove", "removal", "Removes a Configuration.", [CONFIGURATION], (s, a) => remove(s, str(a, "configuration"))),
];
