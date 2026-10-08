/** TransformationEditor (Contexts): a Transformation, its Entity and Relationship mappings, and its context. */
import { remove as removeFromModel, setName, type Graph } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { element, elements, freshId, ids, operation, str, text, type Operation } from "../operation.js";

const EDITOR = "TransformationEditor";

/**
 * Maps `source` to `targets` through the mapping of the given kind: the existing mapping of
 * `source`, if there is one, or a new one. Shared with the editors of the layers above.
 */
export function setMapping(graph: Graph, transformation: string, kind: string, entity: string, prefix: string, source: string, targets: readonly string[]): void {
  let mapping = graph.navigate(transformation, kind).find((m) => graph.navigate(m, "source")[0] === source);
  if (mapping === undefined) {
    mapping = freshId(graph, transformation, prefix);
    graph.add(entity, mapping);
    graph.connect(transformation, kind, mapping);
    graph.connect(mapping, "source", source);
  }
  graph.disconnect(mapping, "targets");
  for (const target of targets) graph.connect(mapping, "targets", target);
}

/** Maps an Entity of the source Language to the Entities of the target Language it is represented with. */
export function mapEntity(session: EditSession, transformation: string, source: string, targets: readonly string[]): Edit {
  return session.edit("change", "mapEntity", [transformation, source], (graph) =>
    setMapping(graph, transformation, "entityMappings", "EntityMapping", "em", source, targets),
  );
}

/** Maps a Relationship of the source Language to the Relationships of the target Language it is represented with. */
export function mapRelationship(session: EditSession, transformation: string, source: string, targets: readonly string[]): Edit {
  return session.edit("change", "mapRelationship", [transformation, source], (graph) =>
    setMapping(graph, transformation, "relationshipMappings", "RelationshipMapping", "rm", source, targets),
  );
}

/** Removes the mapping of an Entity or a Relationship. */
export function unmap(session: EditSession, transformation: string, source: string): Edit {
  return session.edit("change", "unmap", [transformation, source], (graph) => {
    const kind = graph.get(source).entity === "Entity" ? "entityMappings" : "relationshipMappings";
    for (const mapping of graph.navigate(transformation, kind)) {
      if (graph.navigate(mapping, "source")[0] === source) removeFromModel(graph, mapping);
    }
  });
}

/** Sets the Entities of its target whose instances must be kept for the Transformation to work: none, by value. */
export function setContext(session: EditSession, transformation: string, context: readonly string[]): Edit {
  return session.edit("change", "setContext", [transformation], (graph) => {
    graph.disconnect(transformation, "context");
    for (const entity of context) graph.connect(transformation, "context", entity);
  });
}

export function rename(session: EditSession, transformation: string, name: string): Edit {
  return session.edit("change", `rename Transformation ${name}`, [transformation], (graph) => setName(graph, transformation, name));
}

export function remove(session: EditSession, transformation: string): Edit {
  return session.edit("removal", "remove Transformation", [transformation], (graph) => void removeFromModel(graph, transformation));
}

const TRANSFORMATION = element("transformation", "Transformation", "the Transformation");

export const transformationEditor: readonly Operation[] = [
  operation(
    EDITOR,
    "mapEntity",
    "change",
    "Maps an Entity of the source Language to the Entities of the target Language it is represented with.",
    [TRANSFORMATION, element("source", "Entity", "the source Entity"), elements("targets", "Entity", "the target Entities")],
    (s, a) => mapEntity(s, str(a, "transformation"), str(a, "source"), ids(a, "targets")),
  ),
  operation(
    EDITOR,
    "mapRelationship",
    "change",
    "Maps a Relationship of the source Language to the Relationships of the target Language it is represented with.",
    [TRANSFORMATION, element("source", "Relationship", "the source Relationship"), elements("targets", "Relationship", "the target Relationships")],
    (s, a) => mapRelationship(s, str(a, "transformation"), str(a, "source"), ids(a, "targets")),
  ),
  operation(
    EDITOR,
    "unmap",
    "change",
    "Removes the mapping of an Entity or a Relationship.",
    [TRANSFORMATION, element("source", ["Entity", "Relationship"], "the mapped Entity or Relationship")],
    (s, a) => unmap(s, str(a, "transformation"), str(a, "source")),
  ),
  operation(
    EDITOR,
    "setContext",
    "change",
    "Sets the Entities of the target whose instances must be kept for the Transformation to work: none for one by value.",
    [TRANSFORMATION, elements("context", "Entity", "the context Entities")],
    (s, a) => setContext(s, str(a, "transformation"), ids(a, "context")),
  ),
  operation(EDITOR, "rename", "change", "Renames a Transformation.", [TRANSFORMATION, text("name", "the new name")], (s, a) =>
    rename(s, str(a, "transformation"), str(a, "name")),
  ),
  operation(EDITOR, "remove", "removal", "Removes a Transformation; Mediations it realized stay, unrealized.", [TRANSFORMATION], (s, a) =>
    remove(s, str(a, "transformation")),
  ),
];
