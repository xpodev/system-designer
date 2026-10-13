/**
 * Removing things from a model (docs/foundation.md, "Deletion"). What goes with a removed
 * instance is said by each layer, as data:
 *
 * - the ends through which an instance **owns** others (a Language its Entities);
 * - the Entities that are **dependents** — things that only make sense while everything they
 *   refer to exists (a mapping);
 * - what an Entity **requires**: groups of ends, each of which must lead somewhere for it to
 *   exist at all (a Transformation its source; a Connection something to go to).
 *
 * Removing an instance removes what it owns, and every dependent that referred to it. Then
 * whatever met its requirements before the removal and no longer does goes too, and so on.
 * Everything else that referred to a removed instance just loses the link — and something
 * that was already ill-formed stays, for the diagnoser to show.
 */
import type { Graph } from "./graph.js";

export interface Composition {
  /** Entity → the ends through which its instances own others. */
  readonly owning: ReadonlyMap<string, readonly string[]>;
  readonly dependents: ReadonlySet<string>;
  /** Entity → groups of ends; each group must lead somewhere through at least one of its ends. */
  readonly requires: ReadonlyMap<string, readonly (readonly string[])[]>;
}

export function composition(
  owning: Record<string, readonly string[]>,
  dependents: readonly string[],
  requires: Record<string, readonly (readonly string[])[]> = {},
): Composition {
  return { owning: new Map(Object.entries(owning)), dependents: new Set(dependents), requires: new Map(Object.entries(requires)) };
}

/** The layers' compositions together. */
export function compose(...parts: readonly Composition[]): Composition {
  const owning = new Map<string, string[]>();
  const requires = new Map<string, (readonly string[])[]>();
  for (const part of parts) {
    for (const [entity, ends] of part.owning) owning.set(entity, [...(owning.get(entity) ?? []), ...ends]);
    for (const [entity, groups] of part.requires) requires.set(entity, [...(requires.get(entity) ?? []), ...groups]);
  }
  return { owning, dependents: new Set(parts.flatMap((part) => [...part.dependents])), requires };
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
        else if (back !== null && (rules.owning.get(otherEntity) ?? []).includes(back)) continue; // `other` owns `id`
        else if (rules.dependents.has(otherEntity)) dependents.push(other);
      }
    }
    graph.remove(id);
    removed.push(id);
    pending.push(...owned, ...dependents);
  }
  return removed;
}

/** Whether `id` meets every requirement of its Entity. */
function satisfied(graph: Graph, id: string, rules: Composition): boolean {
  const groups = rules.requires.get(graph.get(id).entity) ?? [];
  return groups.every((group) => group.some((end) => graph.navigate(id, end).length > 0));
}

/** Removes `roots` with their cascade, then whatever the removal left without something it requires. */
export function removeAll(graph: Graph, roots: readonly string[], rules: Composition): string[] {
  const met = [...rules.requires.keys()].flatMap((entity) => graph.ofEntity(entity)).filter((id) => satisfied(graph, id, rules));
  const removed = cascade(graph, roots, rules);
  for (;;) {
    const lost = met.filter((id) => graph.has(id) && !satisfied(graph, id, rules));
    if (lost.length === 0) return removed;
    removed.push(...cascade(graph, lost, rules));
  }
}

/** What the Kernel owns: a Language its Entities, Relationships and Formulas; a Relationship its ends. */
export const kernelComposition = composition(
  {
    Language: ["entities", "relationships", "formulas"],
    Relationship: ["ends"],
  },
  [],
);
