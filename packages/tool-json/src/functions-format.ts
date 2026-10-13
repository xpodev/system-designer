/**
 * FunctionsFormat: a Function — an Interaction or a Transformation — as JSON: its Parameters,
 * an array in chain order, and its output, or `null` for none.
 */
import { nameOf, parameters, setName, setParameters, type Graph } from "@systemathic/core";
import { array, object, string, type Reader } from "./reader.js";

export interface ParameterJson { id: string; name: string; type: string }
export interface FunctionJson { id: string; name: string; parameters: ParameterJson[]; output: string | null }

/** Creates a Function of `entity`, named, with its Parameters and output; undefined for a duplicate id. */
export function readFunction(reader: Reader, entity: "Interaction" | "Transformation", json: Record<string, unknown>, at: string): string | undefined {
  const graph = reader.graph;
  const id = reader.create(entity, json.id, at);
  if (id === undefined) return undefined;
  setName(graph, id, string(json.name, `${at}.name`));
  const ids: string[] = [];
  array(json.parameters, `${at}.parameters`).forEach((value, index) => {
    const where = `${at}.parameters[${index}]`;
    const parameter = object(value, where);
    const parameterId = reader.create("Parameter", parameter.id, where);
    if (parameterId === undefined) return;
    setName(graph, parameterId, string(parameter.name, `${where}.name`));
    reader.refer(parameterId, "type", parameter.type, `${where}.type`);
    ids.push(parameterId);
  });
  setParameters(graph, id, ids);
  if (json.output !== null) reader.refer(id, "output", json.output, `${at}.output`);
  return id;
}

export function writeFunction(graph: Graph, id: string): Omit<FunctionJson, "id" | "name"> {
  return {
    parameters: parameters(graph, id).map((parameter) => ({
      id: parameter,
      name: nameOf(graph, parameter) ?? "",
      type: graph.navigate(parameter, "type")[0] ?? "",
    })),
    output: graph.navigate(id, "output")[0] ?? null,
  };
}
