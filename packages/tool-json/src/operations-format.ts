/**
 * OperationsFormat: a Component's Interactions, and the Interactions it imports, as JSON.
 * Parameters are an array; its order is the first/next chain. Layers above Operations add
 * their parts of an Interaction through the extension hooks.
 */
import { nameOf, parameters, setName, setParameters, type Graph } from "@systemathic/core";
import type { Extension } from "./contexts-format.js";
import { array, object, string, type Reader } from "./reader.js";

export interface ParameterJson { id: string; name: string; type: string }
export interface InteractionJson { id: string; name: string; language: string; parameters: ParameterJson[]; output: string }

/** What a layer above Operations reads into, and writes from, an Interaction. */
export interface InteractionExtension {
  readInteraction(reader: Reader, interaction: string, json: Record<string, unknown>, at: string): void;
  writeInteraction(graph: Graph, interaction: string): Record<string, unknown>;
}

/** The Operations layer of a Component: `imports.interactions`, and `interactions`. */
export function operations(extensions: readonly InteractionExtension[] = []): Extension {
  return {
    readComponent(reader, component, json, at) {
      const imports = object(json.imports, `${at}.imports`);
      array(imports.interactions, `${at}.imports.interactions`).forEach((ref, i) =>
        reader.refer(component, "importedInteractions", ref, `${at}.imports.interactions[${i}]`),
      );
      readInteractions(reader, component, json.interactions, `${at}.interactions`, extensions);
    },
    writeComponent: (graph, component) => ({
      imports: { interactions: graph.navigate(component, "importedInteractions") },
      interactions: writeInteractions(graph, component, extensions),
    }),
  };
}

function readInteractions(reader: Reader, component: string, value: unknown, at: string, extensions: readonly InteractionExtension[]): void {
  const graph = reader.graph;
  array(value, at).forEach((value, index) => {
    const where = `${at}[${index}]`;
    const json = object(value, where);
    const interaction = reader.create("Interaction", json.id, where);
    if (interaction === undefined) return;
    setName(graph, interaction, string(json.name, `${where}.name`));
    graph.connect(component, "interactions", interaction);
    reader.refer(interaction, "language", json.language, `${where}.language`);
    const ids: string[] = [];
    array(json.parameters, `${where}.parameters`).forEach((value, index) => {
      const at = `${where}.parameters[${index}]`;
      const parameter = object(value, at);
      const id = reader.create("Parameter", parameter.id, at);
      if (id === undefined) return;
      setName(graph, id, string(parameter.name, `${at}.name`));
      reader.refer(id, "type", parameter.type, `${at}.type`);
      ids.push(id);
    });
    setParameters(graph, interaction, ids);
    reader.refer(interaction, "output", json.output, `${where}.output`);
    for (const extension of extensions) extension.readInteraction(reader, interaction, json, where);
  });
}

function writeInteractions(graph: Graph, component: string, extensions: readonly InteractionExtension[]): InteractionJson[] {
  return graph.navigate(component, "interactions").map((id) =>
    Object.assign(
      {
        id,
        name: nameOf(graph, id) ?? "",
        language: graph.navigate(id, "language")[0] ?? "",
        parameters: parameters(graph, id).map((parameter) => ({
          id: parameter,
          name: nameOf(graph, parameter) ?? "",
          type: graph.navigate(parameter, "type")[0] ?? "",
        })),
        output: graph.navigate(id, "output")[0] ?? "",
      },
      ...extensions.map((extension) => extension.writeInteraction(graph, id)),
    ),
  );
}
