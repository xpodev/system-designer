/**
 * Statistics about a System: counts, depths, fan-in and fan-out. A Metric is one Measure of
 * one Subject.
 */
import { ancestry, importedComponents, mediationStack, offered, parameters, type Graph } from "@systemathic/core";

export type Measure =
  | "packages"
  | "components"
  | "languages"
  | "entities"
  | "relationships"
  | "formulas"
  | "extends"
  | "interactions"
  | "imports"
  | "exports"
  | "nesting depth"
  | "fan-in"
  | "fan-out"
  | "deployments"
  | "instances"
  | "connections"
  | "mediations"
  | "transformations"
  | "implements"
  | "parameters";

export interface Metric {
  readonly subject: string;
  readonly measure: Measure;
  readonly value: number;
}

export function metrics(graph: Graph): Metric[] {
  const found: Metric[] = [];
  const count = (subject: string, measure: Measure, value: number) => found.push({ subject, measure, value });
  for (const system of graph.ofEntity("System")) {
    count(system, "packages", graph.navigate(system, "packages").length);
  }
  for (const language of graph.ofEntity("Language")) {
    for (const measure of ["entities", "relationships", "formulas", "extends"] as const) count(language, measure, graph.navigate(language, measure).length);
  }
  const importedFrom = new Map<string, Set<string>>();
  for (const component of graph.ofEntity("Component")) {
    const from = new Set(importedComponents(graph, component));
    importedFrom.set(component, from);
    for (const measure of ["languages", "components", "interactions", "deployments", "transformations", "implements"] as const) {
      count(component, measure, graph.navigate(component, measure).length);
    }
    count(component, "imports", graph.navigate(component, "imports").length);
    count(component, "exports", offered(graph, component).length);
    count(component, "nesting depth", ancestry(graph, component).length - 1);
    count(component, "fan-out", from.size);
  }
  for (const component of graph.ofEntity("Component")) {
    count(component, "fan-in", [...importedFrom.values()].filter((from) => from.has(component)).length);
  }
  for (const deployment of graph.ofEntity("Deployment")) {
    for (const measure of ["instances", "connections"] as const) count(deployment, measure, graph.navigate(deployment, measure).length);
  }
  for (const connection of graph.ofEntity("Connection")) count(connection, "mediations", mediationStack(graph, connection).length);
  for (const func of graph.ofEntity("Function")) count(func, "parameters", parameters(graph, func).length);
  return found;
}
