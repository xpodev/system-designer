/** EntityEditor (Kernel): an Entity. */
import { remove as removeFromModel, setName } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { element, operation, relinkFormulas, str, text, type Operation } from "../operation.js";

const EDITOR = "EntityEditor";

export function rename(session: EditSession, entity: string, name: string): Edit {
  return session.edit("change", `rename Entity ${name}`, [entity], (graph) => {
    setName(graph, entity, name);
    relinkFormulas(graph);
  });
}

/** Removes an Entity, the mappings and deferrals naming it; ends and Parameters of it are left without one. */
export function remove(session: EditSession, entity: string): Edit {
  return session.edit("removal", "remove Entity", [entity], (graph) => {
    removeFromModel(graph, entity);
    relinkFormulas(graph);
  });
}

const ENTITY = element("entity", "Entity", "the Entity");

export const entityEditor: readonly Operation[] = [
  operation(EDITOR, "rename", "change", "Renames an Entity.", [ENTITY, text("name", "the new name")], (s, a) => rename(s, str(a, "entity"), str(a, "name"))),
  operation(EDITOR, "remove", "removal", "Removes an Entity, and the mappings and deferrals that name it.", [ENTITY], (s, a) => remove(s, str(a, "entity"))),
];
