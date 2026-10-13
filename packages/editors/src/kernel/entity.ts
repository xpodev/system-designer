/** EntityEditor (Kernel): an Entity, and what it extends. */
import { remove as removeFromModel, setName } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { element, operation, str, text, type Operation } from "../operation.js";

const EDITOR = "EntityEditor";

export function rename(session: EditSession, entity: string, name: string): Edit {
  return session.edit("change", `rename Entity ${name}`, [entity], (graph) => {
    setName(graph, entity, name);
  });
}

/**
 * Makes an Entity extend another — one of a Language its own extends — so it is a projection
 * of it: each of its instances is one of the other's.
 */
export function extend(session: EditSession, entity: string, extended: string): Edit {
  return session.edit("change", "extend", [entity, extended], (graph) => {
    graph.connect(entity, "extends", extended);
  });
}

export function unextend(session: EditSession, entity: string, extended: string): Edit {
  return session.edit("change", "unextend", [entity, extended], (graph) => {
    graph.disconnect(entity, "extends", extended);
  });
}

/** Removes an Entity, the mappings and deferrals naming it; ends and Parameters of it are left without one. */
export function remove(session: EditSession, entity: string): Edit {
  return session.edit("removal", "remove Entity", [entity], (graph) => {
    removeFromModel(graph, entity);
  });
}

const ENTITY = element("entity", "Entity", "the Entity");

export const entityEditor: readonly Operation[] = [
  operation(EDITOR, "rename", "change", "Renames an Entity.", [ENTITY, text("name", "the new name")], (s, a) => rename(s, str(a, "entity"), str(a, "name"))),
  operation(EDITOR, "extend", "change", "Makes an Entity extend an Entity of a Language its own extends.", [ENTITY, element("extended", "Entity", "the Entity extended")], (s, a) =>
    extend(s, str(a, "entity"), str(a, "extended")),
  ),
  operation(EDITOR, "unextend", "change", "Stops an Entity extending another.", [ENTITY, element("extended", "Entity", "the Entity extended")], (s, a) =>
    unextend(s, str(a, "entity"), str(a, "extended")),
  ),
  operation(EDITOR, "remove", "removal", "Removes an Entity, and the mappings and deferrals that name it.", [ENTITY], (s, a) => remove(s, str(a, "entity"))),
];
