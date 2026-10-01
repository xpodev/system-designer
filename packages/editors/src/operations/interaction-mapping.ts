/**
 * InteractionMappingEditor (Operations): a Transformation's Interaction mappings. It is its own
 * editor, not part of the TransformationEditor, because Contexts knows nothing of Interactions.
 */
import { remove as removeFromModel } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { setMapping } from "../contexts/transformation.js";
import { element, elements, ids, operation, str, type Operation } from "../operation.js";

const EDITOR = "InteractionMappingEditor";

/** Maps an Interaction of the source Language to the Interactions of the target Language it is carried out with. */
export function mapInteraction(session: EditSession, transformation: string, source: string, targets: readonly string[]): Edit {
  return session.edit("change", "mapInteraction", [transformation, source], (graph) =>
    setMapping(graph, transformation, "interactionMappings", "InteractionMapping", "im", source, targets),
  );
}

export function unmap(session: EditSession, transformation: string, source: string): Edit {
  return session.edit("change", "unmap Interaction", [transformation, source], (graph) => {
    for (const mapping of graph.navigate(transformation, "interactionMappings")) {
      if (graph.navigate(mapping, "source")[0] === source) removeFromModel(graph, mapping);
    }
  });
}

const TRANSFORMATION = element("transformation", "Transformation", "the Transformation");

export const interactionMappingEditor: readonly Operation[] = [
  operation(
    EDITOR,
    "mapInteraction",
    "change",
    "Maps an Interaction of the source Language to the Interactions of the target Language it is carried out with.",
    [TRANSFORMATION, element("source", "Interaction", "the source Interaction"), elements("targets", "Interaction", "the target Interactions")],
    (s, a) => mapInteraction(s, str(a, "transformation"), str(a, "source"), ids(a, "targets")),
  ),
  operation(
    EDITOR,
    "unmap",
    "change",
    "Removes the mapping of an Interaction.",
    [TRANSFORMATION, element("source", "Interaction", "the mapped Interaction")],
    (s, a) => unmap(s, str(a, "transformation"), str(a, "source")),
  ),
];
