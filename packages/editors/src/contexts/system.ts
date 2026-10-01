/** SystemEditor (Contexts): a System, and which Languages, Domains and Mediations it has. */
import { copy, setName, type Graph } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { addNamed, element, freshId, operation, str, text, type Operation } from "../operation.js";

const EDITOR = "SystemEditor";

export function addLanguage(session: EditSession, system: string, name: string): Edit {
  const id = freshId(session.target.graph, "lang", name);
  return session.edit("addition", `addLanguage ${name}`, [id], (graph) => addNamed(graph, "Language", id, name, system, "languages"));
}

export function addDomain(session: EditSession, system: string, name: string): Edit {
  const id = freshId(session.target.graph, "domain", name);
  return session.edit("addition", `addDomain ${name}`, [id], (graph) => addNamed(graph, "Domain", id, name, system, "domains"));
}

export function addMediation(session: EditSession, system: string, what: string, how: string, mediator: string): Edit {
  const id = freshId(session.target.graph, "mediation", `${what}-over-${how}`);
  return session.edit("addition", "addMediation", [id], (graph) => {
    graph.add("Mediation", id);
    graph.connect(system, "mediations", id);
    graph.connect(id, "what", what);
    graph.connect(id, "how", how);
    graph.connect(id, "mediator", mediator);
  });
}

export function rename(session: EditSession, system: string, name: string): Edit {
  return session.edit("change", `rename System ${name}`, [system], (graph) => setName(graph, system, name));
}

/**
 * Adds a copy of a Language, Domain or Mediation of another model, as `addLanguage`,
 * `addDomain` or `addMediation` would, with everything it owns. Its references reach only what
 * `copied` says was brought in before; `copied` is extended with what this brings in.
 */
export function addCopy(session: EditSession, system: string, source: Graph, item: string, copied: Map<string, string>): Edit {
  const entity = source.get(item).entity;
  const end = { Language: "languages", Domain: "domains", Mediation: "mediations" }[entity];
  if (end === undefined) throw new Error(`only Languages, Domains and Mediations are added to a System, not a ${entity}`);
  return session.edit("addition", `add${entity} ${item}`, [], (graph) => {
    const [id] = copy(source, graph, [item], copied);
    if (id !== undefined) graph.connect(system, end, id);
  });
}

const SYSTEM = element("system", "System", "the System");

export const systemEditor: readonly Operation[] = [
  operation(EDITOR, "addLanguage", "addition", "Adds an empty Language to a System.", [SYSTEM, text("name", "the Language's name")], (s, a) =>
    addLanguage(s, str(a, "system"), str(a, "name")),
  ),
  operation(EDITOR, "addDomain", "addition", "Adds an empty Domain to a System.", [SYSTEM, text("name", "the Domain's name")], (s, a) =>
    addDomain(s, str(a, "system"), str(a, "name")),
  ),
  operation(
    EDITOR,
    "addMediation",
    "addition",
    "Declares a Mediation: the what of one Domain carried out over the how of another, witnessed by a mediator Domain.",
    [
      SYSTEM,
      element("what", "Domain", "the Domain carried out"),
      element("how", "Domain", "the Domain carrying it out"),
      element("mediator", "Domain", "the Domain holding the witnessing Transformation"),
    ],
    (s, a) => addMediation(s, str(a, "system"), str(a, "what"), str(a, "how"), str(a, "mediator")),
  ),
  operation(EDITOR, "rename", "change", "Renames a System.", [SYSTEM, text("name", "the new name")], (s, a) => rename(s, str(a, "system"), str(a, "name"))),
];
