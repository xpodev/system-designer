/**
 * OperationsFormat: a Language's Interactions and a Transformation's Interaction mappings as
 * JSON. Parameters are an array; its order is the first/next chain.
 */
import { nameOf, parameters, setName, setParameters, type Graph } from "@systemathic/core";
import { array, object, string, type Reader } from "./reader.js";

export interface ParameterJson { id: string; name: string; type: string }
export interface InteractionJson { id: string; name: string; parameters: ParameterJson[]; output: string }
export interface InteractionMappingJson { source: string; targets: string[] }

export function readInteractions(reader: Reader, language: string, value: unknown, at: string): void {
  const graph = reader.graph;
  array(value, at).forEach((value, index) => {
    const where = `${at}[${index}]`;
    const json = object(value, where);
    const interaction = reader.create("Interaction", json.id, where);
    if (interaction === undefined) return;
    setName(graph, interaction, string(json.name, `${where}.name`));
    graph.connect(language, "interactions", interaction);
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
  });
}

export function writeInteractions(graph: Graph, language: string): InteractionJson[] {
  return graph.navigate(language, "interactions").map((id) => ({
    id,
    name: nameOf(graph, id) ?? "",
    parameters: parameters(graph, id).map((parameter) => ({
      id: parameter,
      name: nameOf(graph, parameter) ?? "",
      type: graph.navigate(parameter, "type")[0] ?? "",
    })),
    output: graph.navigate(id, "output")[0] ?? "",
  }));
}

export function readInteractionMappings(reader: Reader, transformation: string, value: unknown, at: string): void {
  array(value, at).forEach((value, index) => {
    const where = `${at}[${index}]`;
    const json = object(value, where);
    const mapping = reader.create("InteractionMapping", `${transformation}#im${index}`, where);
    if (mapping === undefined) return;
    reader.graph.connect(transformation, "interactionMappings", mapping);
    reader.refer(mapping, "source", json.source, `${where}.source`);
    array(json.targets, `${where}.targets`).forEach((target, index) => reader.refer(mapping, "targets", target, `${where}.targets[${index}]`));
  });
}

export function writeInteractionMappings(graph: Graph, transformation: string): InteractionMappingJson[] {
  return graph.navigate(transformation, "interactionMappings").map((mapping) => ({
    source: graph.navigate(mapping, "source")[0] ?? "",
    targets: graph.navigate(mapping, "targets"),
  }));
}
