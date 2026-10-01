/**
 * StdFormat: what Std adds, as JSON. An Interaction says which of its Parameters is `primary`
 * (or `null`) and which Entities it `compares`; a Transformation lists what it has `deferred`,
 * each deferral naming one `entity`, `relationship` or `interaction`.
 */
import type { Graph } from "@systemathic/core";
import type { Extension } from "./contexts-format.js";
import type { InteractionExtension } from "./operations-format.js";
import { array, FormatError, object, type Reader } from "./reader.js";

export interface DeferredJson { entity?: string; relationship?: string; interaction?: string }

const ITEMS = ["entity", "relationship", "interaction"] as const;

export const stdInteractions: InteractionExtension = {
  readInteraction(reader, interaction, json, at) {
    if (json.primary !== null) reader.refer(interaction, "primary", json.primary, `${at}.primary`);
    array(json.compares, `${at}.compares`).forEach((ref, index) => reader.refer(interaction, "comparedEntities", ref, `${at}.compares[${index}]`));
  },
  writeInteraction: (graph, interaction) => ({
    primary: graph.navigate(interaction, "primary")[0] ?? null,
    compares: graph.navigate(interaction, "comparedEntities"),
  }),
};

export const stdTransformations: Extension = {
  readTransformation(reader, transformation, json, at) {
    array(json.deferred, `${at}.deferred`).forEach((value, index) => {
      const where = `${at}.deferred[${index}]`;
      const deferral = object(value, where);
      const named = ITEMS.filter((item) => deferral[item] !== undefined);
      if (named.length !== 1) throw new FormatError(`${where}: expected exactly one of ${ITEMS.join(", ")}`);
      const id = reader.create("Deferred", `${transformation}#d${index}`, where);
      if (id === undefined) return;
      reader.graph.connect(transformation, "deferred", id);
      reader.refer(id, named[0]!, deferral[named[0]!], `${where}.${named[0]}`);
    });
  },
  writeTransformation: (graph, transformation) => ({ deferred: writeDeferred(graph, transformation) }),
};

function writeDeferred(graph: Graph, transformation: string): DeferredJson[] {
  return graph.navigate(transformation, "deferred").map((deferral) => {
    for (const item of ITEMS) {
      const [id] = graph.navigate(deferral, item);
      if (id !== undefined) return { [item]: id };
    }
    return {};
  });
}
