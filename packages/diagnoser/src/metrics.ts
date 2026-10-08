/**
 * Statistics about a System (docs/tool-design.md, Diagnostics: Metric and Measure): counts,
 * depths, fan-in and fan-out. A Metric is one Measure of one Subject.
 */
import { ancestry, mediationStack, type Graph } from "@systemathic/core";

export type Measure =
  | "components"
  | "configurations"
  | "languages"
  | "entities"
  | "relationships"
  | "formulas"
  | "extends"
  | "interactions"
  | "imports"
  | "nesting depth"
  | "fan-in"
  | "fan-out"
  | "deployments"
  | "instances"
  | "connections"
  | "mediations"
  | "transformations"
  | "mappings";

export interface Metric {
  readonly subject: string;
  readonly measure: Measure;
  readonly value: number;
}

/** The ends through which a Component imports, and how to find the Component that offers what it imports. */
const IMPORTS: readonly (readonly [end: string, owner: string | null])[] = [
  ["importedComponents", null],
  ["importedInteractions", "component"],
  ["importedTransformations", "holder"],
  ["importedMediums", "definer"],
];

export function metrics(graph: Graph): Metric[] {
  const found: Metric[] = [];
  const count = (subject: string, measure: Measure, value: number) => found.push({ subject, measure, value });
  for (const system of graph.ofEntity("System")) {
    for (const measure of ["components", "configurations"] as const) count(system, measure, graph.navigate(system, measure).length);
  }
  for (const language of graph.ofEntity("Language")) {
    for (const measure of ["entities", "relationships", "formulas", "extends"] as const) count(language, measure, graph.navigate(language, measure).length);
  }
  const importedFrom = new Map<string, Set<string>>();
  for (const component of graph.ofEntity("Component")) {
    const from = new Set<string>();
    let imports = 0;
    for (const [end, owner] of IMPORTS) {
      for (const item of graph.navigate(component, end)) {
        imports++;
        for (const offering of owner === null ? [item] : graph.navigate(item, owner)) from.add(offering);
      }
    }
    importedFrom.set(component, from);
    for (const measure of ["languages", "components", "interactions", "deployments", "transformations"] as const) {
      count(component, measure, graph.navigate(component, measure).length);
    }
    count(component, "imports", imports);
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
  for (const transformation of graph.ofEntity("Transformation")) {
    count(transformation, "mappings", graph.navigate(transformation, "entityMappings").length + graph.navigate(transformation, "relationshipMappings").length);
  }
  return found;
}
