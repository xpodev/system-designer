/** RelationshipEditor (Kernel): a Relationship, its Ends and their Bounds. */
import { remove as removeFromModel, setName } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { element, maybe, operation, range, relinkFormulas, setBounds, str, text, type Operation } from "../operation.js";

const EDITOR = "RelationshipEditor";

export function setEntity(session: EditSession, end: string, entity: string): Edit {
  return session.edit("change", "setEntity", [end], (graph) => {
    graph.disconnect(end, "entity");
    graph.connect(end, "entity", entity);
    relinkFormulas(graph);
  });
}

/**
 * Names an end, or, without a name, leaves it unnamed: then nothing at the other end can
 * navigate to it, and the Relationship is navigable one way only.
 */
export function renameEnd(session: EditSession, end: string, name: string | undefined): Edit {
  return session.edit("change", name === undefined ? "unnameEnd" : `renameEnd ${name}`, [end], (graph) => {
    if (name === undefined) graph.disconnect(end, "name");
    else setName(graph, end, name);
    relinkFormulas(graph);
  });
}

export function setRange(session: EditSession, end: string, value: string): Edit {
  return session.edit("change", `setRange ${value}`, [end], (graph) => setBounds(graph, end, value));
}

export function remove(session: EditSession, relationship: string): Edit {
  return session.edit("removal", "remove Relationship", [relationship], (graph) => {
    removeFromModel(graph, relationship);
    relinkFormulas(graph);
  });
}

const END = element("end", "End", "the end");

export const relationshipEditor: readonly Operation[] = [
  operation(EDITOR, "setEntity", "change", "Sets the Entity an end is at.", [END, element("entity", "Entity", "the Entity")], (s, a) =>
    setEntity(s, str(a, "end"), str(a, "entity")),
  ),
  operation(
    EDITOR,
    "renameEnd",
    "change",
    "Renames an end — the name the other end's Entity navigates by. Without a name the end is unnamed, and cannot be navigated to.",
    [END, text("name", "the new name; none to leave it unnamed", true)],
    (s, a) => renameEnd(s, str(a, "end"), maybe(a, "name")),
  ),
  operation(EDITOR, "setRange", "change", "Sets an end's range, such as 0..1 or 1..N.", [END, range("range", "the range")], (s, a) =>
    setRange(s, str(a, "end"), str(a, "range")),
  ),
  operation(
    EDITOR,
    "remove",
    "removal",
    "Removes a Relationship and its ends.",
    [element("relationship", "Relationship", "the Relationship")],
    (s, a) => remove(s, str(a, "relationship")),
  ),
];
