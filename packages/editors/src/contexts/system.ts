/**
 * SystemEditor (Contexts): a System — its name, and the packages it brings in beside its root.
 * Everything the design says is inside the root, which the ComponentEditor edits.
 */
import { copy, setName, type Graph } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { element, operation, str, text, type Operation } from "../operation.js";

const EDITOR = "SystemEditor";

export function rename(session: EditSession, system: string, name: string): Edit {
  return session.edit("change", `rename System ${name}`, [system], (graph) => setName(graph, system, name));
}

/**
 * Brings a Component of another model in beside the root, as a package, with everything it
 * owns. Its references reach only what `copied` says was brought in before; `copied` is
 * extended with what this brings in.
 */
export function addPackage(session: EditSession, system: string, source: Graph, component: string, copied: Map<string, string>): Edit {
  const entity = source.get(component).entity;
  if (entity !== "Component") throw new Error(`only Components are brought into a System, not a ${entity}`);
  return session.edit("addition", `addPackage ${component}`, [], (graph) => {
    const [id] = copy(source, graph, [component], copied);
    if (id !== undefined) graph.connect(system, "packages", id);
  });
}

const SYSTEM = element("system", "System", "the System");

export const systemEditor: readonly Operation[] = [
  operation(EDITOR, "rename", "change", "Renames a System.", [SYSTEM, text("name", "the new name")], (s, a) => rename(s, str(a, "system"), str(a, "name"))),
];
