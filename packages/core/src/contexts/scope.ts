/**
 * Scope, as functions on a model (docs/foundation.md, *Component*, *Export*, *Import* and
 * *Deployment*). These are conveniences for clients — what to offer in a list, what to show as
 * reachable — and say nothing the axioms do not: well-formedness is checked by evaluating the
 * axioms.
 */
import { chain, setChain, type ChainEnds } from "../kernel/chain.js";
import type { Graph } from "../kernel/graph.js";

/** The ends through which an Export refers to what it exports; `medium` is Mediation's, `deployment` and `instance` Deployment's. */
const TARGETS = ["component", "interaction", "transformation", "language", "medium", "deployment", "instance"] as const;

/** `C.*parent`: a Component and every Component it is nested in, nearest first. */
export function ancestry(graph: Graph, component: string): string[] {
  const found: string[] = [];
  let current: string | undefined = component;
  while (current !== undefined && graph.has(current) && !found.includes(current)) {
    found.push(current);
    [current] = graph.navigate(current, "parent");
  }
  return found;
}

/** The Components beside `component`: its parent's other children; for the root and the packages, each other. */
export function siblings(graph: Graph, component: string): string[] {
  const [parent] = graph.navigate(component, "parent");
  return (parent !== undefined ? graph.navigate(parent, "components") : topLevel(graph)).filter((id) => id !== component);
}

/** The Components nested in none: every System's root and packages. */
export function topLevel(graph: Graph): string[] {
  return graph.ofEntity("System").flatMap((system) => [...graph.navigate(system, "root"), ...graph.navigate(system, "packages")]);
}

/** `e.<target>`: what an Export makes reachable. */
export function resolve(graph: Graph, exported: string): string | undefined {
  if (!graph.has(exported)) return undefined;
  const ends = graph.vocabulary.reachable(graph.get(exported).entity);
  for (const end of TARGETS) {
    const [target] = ends.has(end) ? graph.navigate(exported, end) : [];
    if (target !== undefined) return target;
  }
  return undefined;
}

/** Of `ids`, the distinct ones whose Entity is `entity`, or all of them. */
function ofEntity(graph: Graph, ids: Iterable<string | undefined>, entity?: string): string[] {
  const found = new Set<string>();
  for (const id of ids) if (id !== undefined && graph.has(id) && (entity === undefined || graph.get(id).entity === entity)) found.add(id);
  return [...found];
}

/** What a Component exports, resolved: its API, of one Entity or of all. */
export function offered(graph: Graph, component: string, entity?: string): string[] {
  return ofEntity(graph, graph.navigate(component, "exports").map((id) => resolve(graph, id)), entity);
}

/** `X.imports.exports`: what the Imports of a Component or a Deployment take, of one Entity or of all. */
export function imported(graph: Graph, owner: string, entity?: string): string[] {
  const exports = graph.navigate(owner, "imports").flatMap((id) => graph.navigate(id, "exports"));
  return ofEntity(graph, exports.map((id) => resolve(graph, id)), entity);
}

/** The Components a Component or a Deployment imports from, and those its Imports take as wholes. */
export function importedComponents(graph: Graph, owner: string): string[] {
  const from = graph.navigate(owner, "imports").flatMap((id) => graph.navigate(id, "from"));
  return ofEntity(graph, [...from, ...imported(graph, owner, "Component")]);
}

/** `scope(C) = (C.*parent).languages ∪ C.imports.exports.language`: the Languages a Component may use. */
export function scope(graph: Graph, component: string): string[] {
  const found = new Set<string>();
  for (const owner of ancestry(graph, component)) for (const language of graph.navigate(owner, "languages")) found.add(language);
  for (const language of imported(graph, component, "Language")) found.add(language);
  return [...found];
}

/** The Components a Component may import from: every other one, wherever it is. Exports are not scoped. */
export function importable(graph: Graph, component: string): string[] {
  return graph.ofEntity("Component").filter((id) => id !== component);
}

/** A box with no Deployment: an interface, whose implementation is undefined. */
export function isInterface(graph: Graph, component: string): boolean {
  return graph.navigate(component, "deployments").length === 0;
}

/** The box a Deployment lays out. */
export function boxOf(graph: Graph, deployment: string): string | undefined {
  return graph.navigate(deployment, "component")[0];
}

/** The Component a Deployment is kept in: its box, or another, such as a plug-in package. */
export function keeperOf(graph: Graph, deployment: string): string | undefined {
  return graph.navigate(deployment, "keeper")[0];
}

/**
 * Whether a Deployment may place an Instance of `component` (W10): a child of its box or of the
 * box's ancestors, a child of its keeper or of the keeper's ancestors, or a top-level Component
 * the Deployment imports.
 */
export function placeable(graph: Graph, deployment: string, component: string): boolean {
  return placeableIn(graph, deployment).includes(component);
}

/** Every Component a Deployment may place (see `placeable`). */
export function placeableIn(graph: Graph, deployment: string): string[] {
  const found = new Set<string>();
  for (const anchor of [boxOf(graph, deployment), keeperOf(graph, deployment)]) {
    if (anchor === undefined) continue;
    for (const owner of ancestry(graph, anchor)) for (const child of graph.navigate(owner, "components")) found.add(child);
  }
  for (const from of graph.navigate(deployment, "imports").flatMap((id) => graph.navigate(id, "from"))) {
    if (graph.navigate(from, "parent").length === 0) found.add(from);
  }
  return [...found];
}

/** What a Component may export: its own Languages, Interactions, Transformations and Mediums, its children, and the Deployments it keeps. */
export function exportable(graph: Graph, component: string): string[] {
  const ends = graph.vocabulary.reachable("Component");
  return ["languages", "interactions", "transformations", "mediums", "components", "kept"].flatMap((end) => (ends.has(end) ? graph.navigate(component, end) : []));
}

/**
 * What a Component has access to of one kind, named by the end through which a Component
 * owns it (`interactions`) and by its Entity (`Interaction`): its own and its ancestors'
 * (direct access), and what its Imports take.
 */
export function access(graph: Graph, component: string, owning: string, entity: string): string[] {
  const found = new Set<string>();
  for (const owner of ancestry(graph, component)) for (const id of graph.navigate(owner, owning)) found.add(id);
  for (const id of imported(graph, component, entity)) found.add(id);
  return [...found];
}

/**
 * What a Deployment has access to of one kind: what its box and the box's ancestors own, what
 * its keeper and the keeper's ancestors own, and what its own Imports take (its needs).
 */
export function deploymentAccess(graph: Graph, deployment: string, owning: string, entity: string): string[] {
  const found = new Set<string>();
  for (const anchor of [boxOf(graph, deployment), keeperOf(graph, deployment)]) {
    if (anchor === undefined) continue;
    for (const owner of ancestry(graph, anchor)) for (const id of graph.navigate(owner, owning)) found.add(id);
  }
  for (const id of imported(graph, deployment, entity)) found.add(id);
  return [...found];
}

/** The Transformations a Deployment has access to: the realizations its Mediations may use. */
export function accessibleTransformations(graph: Graph, deployment: string): string[] {
  return deploymentAccess(graph, deployment, "transformations", "Transformation");
}

const STEPS: ChainEnds = { members: "steps", previous: "previous", next: "next" };

/** An identity's placements, from the root down: the Instances of its Steps, in order. */
export function identityPath(graph: Graph, identity: string): string[] {
  return chain(graph, identity, STEPS).flatMap((step) => graph.navigate(step, "instance"));
}

/** Makes `steps` an identity's Steps, in this order. */
export function setIdentitySteps(graph: Graph, identity: string, steps: readonly string[]): void {
  setChain(graph, identity, STEPS, steps);
}

/** The placement an identity names: its last Step's Instance. */
export function identityTarget(graph: Graph, identity: string): string | undefined {
  return identityPath(graph, identity).at(-1);
}
