/**
 * A model of a vocabulary: instances, each of one Entity, and links, each an instance of one
 * Relationship. Nothing here enforces ranges or axioms — a graph can hold an ill-formed
 * model, and saying what is wrong with it is the diagnoser's job.
 */
import type { Vocabulary } from "./vocabulary.js";

export interface Instance {
  readonly id: string;
  readonly entity: string;
  /** The primitive a value-backed instance stands for: a Name's text, a Bound's number, a Formula's text. */
  readonly value?: string | number;
}

type Index = Map<string, Map<string, Set<string>>>;

export class Graph {
  private readonly instances = new Map<string, Instance>();
  private readonly byEntity = new Map<string, Set<string>>();
  /** relationship id → instance at end 0 → instances at end 1, and the reverse. */
  private readonly forward: Index = new Map();
  private readonly backward: Index = new Map();

  constructor(readonly vocabulary: Vocabulary) {}

  add(entity: string, id: string, value?: string | number): Instance {
    if (!this.vocabulary.entities.has(entity)) throw new Error(`unknown Entity ${entity}`);
    if (this.instances.has(id)) throw new Error(`duplicate instance id ${id}`);
    const instance: Instance = value === undefined ? { id, entity } : { id, entity, value };
    this.instances.set(id, instance);
    let ids = this.byEntity.get(entity);
    if (!ids) this.byEntity.set(entity, (ids = new Set()));
    ids.add(id);
    return instance;
  }

  has(id: string): boolean {
    return this.instances.has(id);
  }

  get(id: string): Instance {
    const instance = this.instances.get(id);
    if (!instance) throw new Error(`no instance ${id}`);
    return instance;
  }

  all(): IterableIterator<Instance> {
    return this.instances.values();
  }

  ofEntity(entity: string): string[] {
    return [...(this.byEntity.get(entity) ?? [])];
  }

  /** Links `a` (at the Relationship's end 0) with `b` (at end 1). Linking twice is a no-op. */
  link(relationshipId: string, a: string, b: string): void {
    if (!this.vocabulary.relationship(relationshipId)) throw new Error(`unknown Relationship ${relationshipId}`);
    this.get(a);
    this.get(b);
    insert(this.forward, relationshipId, a, b);
    insert(this.backward, relationshipId, b, a);
  }

  unlink(relationshipId: string, a: string, b: string): void {
    erase(this.forward, relationshipId, a, b);
    erase(this.backward, relationshipId, b, a);
  }

  /** Links `from` to `to` through the end named `endName`, as seen from `from`. */
  connect(from: string, endName: string, to: string): void {
    const step = this.stepFrom(from, endName);
    if (step.far === 1) this.link(step.relationship.id, from, to);
    else this.link(step.relationship.id, to, from);
  }

  /** Removes the links from `from` through `endName` — to `to` only, if given. */
  disconnect(from: string, endName: string, to?: string): void {
    const step = this.stepFrom(from, endName);
    for (const other of to === undefined ? this.navigate(from, endName) : [to]) {
      if (step.far === 1) this.unlink(step.relationship.id, from, other);
      else this.unlink(step.relationship.id, other, from);
    }
  }

  /** The instances linked to `from` through the end named `endName`, in link order. */
  navigate(from: string, endName: string): string[] {
    const step = this.stepFrom(from, endName);
    const index = step.far === 1 ? this.forward : this.backward;
    return [...(index.get(step.relationship.id)?.get(from) ?? [])];
  }

  /** An independent copy: same instances, same links, in the same order. */
  clone(): Graph {
    const copy = new Graph(this.vocabulary);
    for (const instance of this.instances.values()) copy.add(instance.entity, instance.id, instance.value);
    for (const relationship of this.forward.keys())
      for (const [a, b] of this.links(relationship)) copy.link(relationship, a, b);
    return copy;
  }

  /** Every link of a Relationship, as [end 0, end 1] pairs. */
  links(relationshipId: string): [string, string][] {
    const pairs: [string, string][] = [];
    for (const [a, bs] of this.forward.get(relationshipId) ?? []) for (const b of bs) pairs.push([a, b]);
    return pairs;
  }

  private stepFrom(from: string, endName: string) {
    const entity = this.get(from).entity;
    const step = this.vocabulary.step(entity, endName);
    if (!step) throw new Error(`${entity} has no end ${endName}`);
    return step;
  }
}

function insert(index: Index, relationship: string, key: string, value: string): void {
  let table = index.get(relationship);
  if (!table) index.set(relationship, (table = new Map()));
  let values = table.get(key);
  if (!values) table.set(key, (values = new Set()));
  values.add(value);
}

function erase(index: Index, relationship: string, key: string, value: string): void {
  const values = index.get(relationship)?.get(key);
  if (!values) return;
  values.delete(value);
  if (values.size === 0) index.get(relationship)!.delete(key);
}
