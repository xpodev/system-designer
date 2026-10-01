/**
 * Removing things from a model (docs/foundation.md, "Deletion"). What goes with a removed
 * instance is said by each layer, as data: the ends through which an instance **owns** others
 * (a Language its Entities), and the Entities that are **dependents** — things that only make
 * sense while everything they refer to exists (a mapping, a Mediation). Removing an instance
 * removes what it owns, and every dependent that referred to it; everything else that referred
 * to it just loses the link.
 */
import type { Graph } from "./graph.js";

export interface Composition {
  /** Entity → the ends through which its instances own others. */
  readonly owning: ReadonlyMap<string, readonly string[]>;
  readonly dependents: ReadonlySet<string>;
}

export function composition(owning: Record<string, readonly string[]>, dependents: readonly string[]): Composition {
  return { owning: new Map(Object.entries(owning)), dependents: new Set(dependents) };
}

/** The layers' compositions together. */
export function compose(...parts: readonly Composition[]): Composition {
  const owning = new Map<string, string[]>();
  for (const part of parts) {
    for (const [entity, ends] of part.owning) owning.set(entity, [...(owning.get(entity) ?? []), ...ends]);
  }
  return { owning, dependents: new Set(parts.flatMap((part) => [...part.dependents])) };
}

/** Removes `roots` and everything that goes with them; returns every removed id, in order. */
export function cascade(graph: Graph, roots: readonly string[], rules: Composition): string[] {
  const removed: string[] = [];
  const pending = [...roots];
  while (pending.length > 0) {
    const id = pending.shift()!;
    if (!graph.has(id)) continue;
    const entity = graph.get(id).entity;
    const ownedEnds = rules.owning.get(entity) ?? [];
    const owned: string[] = [];
    const dependents: string[] = [];
    for (const [end, steps] of graph.vocabulary.reachable(entity)) {
      if (steps.length !== 1) continue;
      const step = steps[0]!;
      const back = step.relationship.ends[1 - step.far]!.name;
      for (const other of graph.navigate(id, end)) {
        const otherEntity = graph.get(other).entity;
        if (ownedEnds.includes(end)) owned.push(other);
        else if ((rules.owning.get(otherEntity) ?? []).includes(back)) continue; // `other` owns `id`
        else if (rules.dependents.has(otherEntity)) dependents.push(other);
      }
    }
    graph.remove(id);
    removed.push(id);
    pending.push(...owned, ...dependents);
  }
  return removed;
}

/** What the Kernel owns: a Language its Entities, Relationships and Formulas; a Relationship its ends. */
export const kernelComposition = composition(
  {
    Language: ["entities", "relationships", "formulas"],
    Relationship: ["ends"],
  },
  [],
);
