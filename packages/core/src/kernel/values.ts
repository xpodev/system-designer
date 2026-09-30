/**
 * Names and Bounds are Entities of the Kernel, but what they stand for is text and numbers.
 * This is the part of the mediation into a programming language that maps them: one Name
 * instance per distinct text, so comparing names is comparing identities, and one Bound
 * instance per natural number used, linked by `successor`, so ranges can be compared.
 */
import type { Graph } from "./graph.js";

export function nameInstance(graph: Graph, text: string): string {
  const id = `name:${text}`;
  if (!graph.has(id)) graph.add("Name", id, text);
  return id;
}

/** The text of the Name linked to `id` through its `name` end, if any. */
export function nameOf(graph: Graph, id: string): string | undefined {
  const [name] = graph.navigate(id, "name");
  return name === undefined ? undefined : String(graph.get(name).value);
}

export function setName(graph: Graph, id: string, text: string): void {
  graph.disconnect(id, "name");
  graph.connect(id, "name", nameInstance(graph, text));
}

/** The Bound for `n`, materializing `0..n` and their successor links as needed. */
export function boundInstance(graph: Graph, n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error(`a Bound is a natural number, not ${n}`);
  let previous: string | undefined;
  for (let k = 0; k <= n; k++) {
    const id = `bound:${k}`;
    if (!graph.has(id)) {
      graph.add("Bound", id, k);
      if (previous !== undefined) graph.connect(previous, "successor", id);
    }
    previous = id;
  }
  return `bound:${n}`;
}

export function boundOf(graph: Graph, id: string, end: "min" | "max"): number | undefined {
  const [bound] = graph.navigate(id, end);
  return bound === undefined ? undefined : Number(graph.get(bound).value);
}
