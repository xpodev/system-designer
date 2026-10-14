/**
 * MediationFormat: the Mediums a Component defines, an Export's `medium`, and a Connection's stack of
 * Mediations, as JSON. Mediations are in stack order, the top one over the Connection's What;
 * each has its id, names its Medium and, if realized, its `down` and `up`, or `null`.
 */
import { mediationStack, nameOf, setMediationStack, setName, type Graph } from "@systemathic/core";
import type { Extension } from "./contexts-format.js";
import type { ConnectionExtension } from "./deployment-format.js";
import { array, object, string, type Reader } from "./reader.js";

export interface MediumJson { id: string; name: string; language: string; call: string }
export interface MediationJson { id: string; how: string; down: string | null; up: string | null }

/** The Mediation layer of a Component and an Export: `mediums`, and an Export's `medium`. */
export const mediums: Extension = {
  readComponent(reader, component, json, at) {
    const graph = reader.graph;
    array(json.mediums, `${at}.mediums`).forEach((value, index) => {
      const where = `${at}.mediums[${index}]`;
      const medium = object(value, where);
      const id = reader.create("Medium", medium.id, where);
      if (id === undefined) return;
      setName(graph, id, string(medium.name, `${where}.name`));
      graph.connect(component, "mediums", id);
      reader.refer(id, "language", medium.language, `${where}.language`);
      reader.refer(id, "call", medium.call, `${where}.call`);
    });
  },
  writeComponent: (graph, component) => ({
    mediums: graph.navigate(component, "mediums").map((id) => ({
      id,
      name: nameOf(graph, id) ?? "",
      language: graph.navigate(id, "language")[0] ?? "",
      call: graph.navigate(id, "call")[0] ?? "",
    })),
  }),
  readExport(reader, exported, json, at) {
    if (json.medium !== undefined) reader.refer(exported, "medium", json.medium, `${at}.medium`);
  },
  writeExport(graph, exported): Record<string, string> {
    const [medium] = graph.navigate(exported, "medium");
    return medium === undefined ? {} : { medium };
  },
};

/** The Mediation layer of a Connection: `mediations`. */
export const mediations: ConnectionExtension = {
  readConnection(reader, connection, json, at) {
    const ids: string[] = [];
    array(json.mediations, `${at}.mediations`).forEach((value, index) => {
      const where = `${at}.mediations[${index}]`;
      const mediation = object(value, where);
      const id = reader.create("Mediation", mediation.id, where);
      if (id === undefined) return;
      ids.push(id);
      reader.refer(id, "how", mediation.how, `${where}.how`);
      if (mediation.down !== null) reader.refer(id, "down", mediation.down, `${where}.down`);
      if (mediation.up !== null) reader.refer(id, "up", mediation.up, `${where}.up`);
    });
    setMediationStack(reader.graph, connection, ids);
  },
  writeConnection: (graph: Graph, connection: string) => ({
    mediations: mediationStack(graph, connection).map((id): MediationJson => ({
      id,
      how: graph.navigate(id, "how")[0] ?? "",
      down: graph.navigate(id, "down")[0] ?? null,
      up: graph.navigate(id, "up")[0] ?? null,
    })),
  }),
};
