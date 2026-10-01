/** StdEditor (Std): an Action's primary Parameter, an Entity's comparison, and deliberate gaps in a Transformation. */
import { remove as removeFromModel } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { element, freshId, maybe, operation, str, type Operation } from "../operation.js";

const EDITOR = "StdEditor";

const ITEM_END: Record<string, string> = { Entity: "entity", Relationship: "relationship", Interaction: "interaction" };

/** Makes a Parameter the primary one of its Interaction — an Action — or, without one, makes it no Action. */
export function setPrimary(session: EditSession, interaction: string, parameter: string | undefined): Edit {
  return session.edit("change", "setPrimary", [interaction], (graph) => {
    graph.disconnect(interaction, "primary");
    if (parameter !== undefined) graph.connect(interaction, "primary", parameter);
  });
}

/** Designates an Interaction as an Entity's comparison, or, without one, takes it away. */
export function setComparison(session: EditSession, entity: string, interaction: string | undefined): Edit {
  return session.edit("change", "setComparison", [entity], (graph) => {
    graph.disconnect(entity, "comparison");
    if (interaction !== undefined) graph.connect(entity, "comparison", interaction);
  });
}

/** Records that a Transformation deliberately leaves an Entity, Relationship or Interaction unmapped. */
export function defer(session: EditSession, transformation: string, item: string): Edit {
  const id = freshId(session.target.graph, transformation, "deferred");
  return session.edit("addition", "defer", [id, item], (graph) => {
    graph.add("Deferred", id);
    graph.connect(transformation, "deferred", id);
    graph.connect(id, ITEM_END[graph.get(item).entity]!, item);
  });
}

export function undefer(session: EditSession, transformation: string, item: string): Edit {
  return session.edit("removal", "undefer", [transformation, item], (graph) => {
    const end = ITEM_END[graph.get(item).entity]!;
    for (const deferral of graph.navigate(transformation, "deferred")) {
      if (graph.navigate(deferral, end).includes(item)) removeFromModel(graph, deferral);
    }
  });
}

const TRANSFORMATION = element("transformation", "Transformation", "the Transformation");
const ITEM = element("item", ["Entity", "Relationship", "Interaction"], "the item left unmapped");

export const stdEditor: readonly Operation[] = [
  operation(
    EDITOR,
    "setPrimary",
    "change",
    "Makes a Parameter its Interaction's primary one (an Action); without one, makes it no Action.",
    [element("interaction", "Interaction", "the Interaction"), element("parameter", "Parameter", "the primary Parameter", true)],
    (s, a) => setPrimary(s, str(a, "interaction"), maybe(a, "parameter")),
  ),
  operation(
    EDITOR,
    "setComparison",
    "change",
    "Designates an Interaction as an Entity's own notion of sameness; without one, takes it away.",
    [element("entity", "Entity", "the Entity"), element("interaction", "Interaction", "the comparison", true)],
    (s, a) => setComparison(s, str(a, "entity"), maybe(a, "interaction")),
  ),
  operation(EDITOR, "defer", "addition", "Records that a Transformation deliberately leaves an item unmapped.", [TRANSFORMATION, ITEM], (s, a) =>
    defer(s, str(a, "transformation"), str(a, "item")),
  ),
  operation(EDITOR, "undefer", "removal", "Takes back a deferral.", [TRANSFORMATION, ITEM], (s, a) => undefer(s, str(a, "transformation"), str(a, "item"))),
];
