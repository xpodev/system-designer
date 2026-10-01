/**
 * Statistics about a System (docs/tool-design.md, Diagnostics: Metric and Measure): counts,
 * depths, fan-in and fan-out. A Metric is one Measure of one Subject.
 */
import { effectiveLanguages, type Graph } from "@systemathic/core";

export type Measure =
  | "languages"
  | "domains"
  | "mediations"
  | "entities"
  | "relationships"
  | "formulas"
  | "interactions"
  | "effective languages"
  | "reference depth"
  | "fan-in"
  | "fan-out"
  | "transformations"
  | "mappings";

export interface Metric {
  readonly subject: string;
  readonly measure: Measure;
  readonly value: number;
}

export function metrics(graph: Graph): Metric[] {
  const found: Metric[] = [];
  const count = (subject: string, measure: Measure, value: number) => found.push({ subject, measure, value });
  for (const system of graph.ofEntity("System")) {
    for (const measure of ["languages", "domains", "mediations"] as const) count(system, measure, graph.navigate(system, measure).length);
  }
  for (const language of graph.ofEntity("Language")) {
    for (const measure of ["entities", "relationships", "formulas", "interactions"] as const) count(language, measure, graph.navigate(language, measure).length);
  }
  const depth = depths(graph);
  for (const domain of graph.ofEntity("Domain")) {
    count(domain, "languages", graph.navigate(domain, "languages").length);
    count(domain, "effective languages", effectiveLanguages(graph, domain).size);
    count(domain, "reference depth", depth.get(domain) ?? 0);
    count(domain, "fan-in", graph.navigate(domain, "referencedBy").length);
    count(domain, "fan-out", graph.navigate(domain, "references").length);
    count(domain, "transformations", graph.navigate(domain, "transformations").length);
  }
  for (const transformation of graph.ofEntity("Transformation")) {
    const mappings = ["entityMappings", "relationshipMappings", "interactionMappings"].reduce((sum, end) => sum + graph.navigate(transformation, end).length, 0);
    count(transformation, "mappings", mappings);
  }
  return found;
}

/** The longest chain of references from each Domain; a cycle counts each Domain once. */
function depths(graph: Graph): Map<string, number> {
  const memo = new Map<string, number>();
  const visit = (domain: string, path: Set<string>): number => {
    const known = memo.get(domain);
    if (known !== undefined) return known;
    path.add(domain);
    let deepest = 0;
    for (const referenced of graph.navigate(domain, "references")) {
      if (!path.has(referenced)) deepest = Math.max(deepest, 1 + visit(referenced, path));
    }
    path.delete(domain);
    memo.set(domain, deepest);
    return deepest;
  };
  for (const domain of graph.ofEntity("Domain")) visit(domain, new Set());
  return memo;
}
