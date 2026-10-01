/**
 * DomainEditor (Contexts): a Domain — what it references, its name, and the Transformations
 * it holds. Adding a Transformation is here because the Domain holds it.
 */
import { remove as removeFromModel, setName } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { addNamed, element, freshId, operation, str, text, type Operation } from "../operation.js";

const EDITOR = "DomainEditor";

/** References a Language or a Domain. */
export function reference(session: EditSession, domain: string, referenced: string): Edit {
  return session.edit("change", "reference", [domain, referenced], (graph) => {
    graph.connect(domain, graph.get(referenced).entity === "Language" ? "languages" : "references", referenced);
  });
}

/** Stops referencing a Language or a Domain. What falls out of scope stays, and is diagnosed. */
export function unreference(session: EditSession, domain: string, referenced: string): Edit {
  return session.edit("change", "unreference", [domain, referenced], (graph) => {
    graph.disconnect(domain, graph.get(referenced).entity === "Language" ? "languages" : "references", referenced);
  });
}

export function rename(session: EditSession, domain: string, name: string): Edit {
  return session.edit("change", `rename Domain ${name}`, [domain], (graph) => setName(graph, domain, name));
}

/** Adds a Transformation from one Language to another, held by the Domain: a projection, until it is given a reverse. */
export function addTransformation(session: EditSession, domain: string, name: string, source: string, target: string): Edit {
  const id = freshId(session.target.graph, domain, name);
  return session.edit("addition", `addTransformation ${name}`, [id], (graph) => {
    addNamed(graph, "Transformation", id, name, domain, "transformations");
    graph.connect(id, "source", source);
    graph.connect(id, "target", target);
  });
}

/** Removes a Domain with the cascade the foundation defines. */
export function remove(session: EditSession, domain: string): Edit {
  return session.edit("removal", "remove Domain", [domain], (graph) => void removeFromModel(graph, domain));
}

const DOMAIN = element("domain", "Domain", "the Domain");
const REFERENCED = element("referenced", ["Language", "Domain"], "the Language or Domain");

export const domainEditor: readonly Operation[] = [
  operation(EDITOR, "reference", "change", "Makes a Domain reference a Language, or another Domain.", [DOMAIN, REFERENCED], (s, a) =>
    reference(s, str(a, "domain"), str(a, "referenced")),
  ),
  operation(EDITOR, "unreference", "change", "Stops a Domain referencing a Language or a Domain.", [DOMAIN, REFERENCED], (s, a) =>
    unreference(s, str(a, "domain"), str(a, "referenced")),
  ),
  operation(EDITOR, "rename", "change", "Renames a Domain.", [DOMAIN, text("name", "the new name")], (s, a) => rename(s, str(a, "domain"), str(a, "name"))),
  operation(
    EDITOR,
    "addTransformation",
    "addition",
    "Adds a Transformation held by a Domain, from a source Language to a target Language.",
    [DOMAIN, text("name", "the Transformation's name"), element("source", "Language", "the source Language"), element("target", "Language", "the target Language")],
    (s, a) => addTransformation(s, str(a, "domain"), str(a, "name"), str(a, "source"), str(a, "target")),
  ),
  operation(
    EDITOR,
    "remove",
    "removal",
    "Removes a Domain: its Transformations, every Mediation naming it, every reference to it, and what falls out of scope as a result.",
    [DOMAIN],
    (s, a) => remove(s, str(a, "domain")),
  ),
];
