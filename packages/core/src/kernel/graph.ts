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

/** One change to a graph. A list of them, in order, is a Delta: what an edit did. */
export type Change =
  | { readonly op: "add" | "remove"; readonly entity: string; readonly id: string; readonly value?: string | number }
  | { readonly op: "set"; readonly id: string; readonly value: string | number; readonly previous: string | number | undefined }
  | {
      readonly op: "link" | "unlink";
      readonly relationship: string;
      readonly a: string;
      readonly b: string;
      /** Where the link stood among `a`'s and among `b`'s links, so undoing an unlink puts it back in place. */
      readonly at?: readonly [number, number];
    };

export type Delta = readonly Change[];

/** The Delta that undoes `delta`: each change flipped, in reverse order. */
export function invert(delta: Delta): Change[] {
  return [...delta].reverse().map((change): Change => {
    switch (change.op) {
      case "add":
        return { ...change, op: "remove" };
      case "remove":
        return { ...change, op: "add" };
      case "set":
        return { op: "set", id: change.id, value: change.previous ?? "", previous: change.value };
      case "link":
        return { ...change, op: "unlink" };
      case "unlink":
        return { ...change, op: "link" };
    }
  });
}

export class Graph {
  private readonly instances = new Map<string, Instance>();
  private readonly byEntity = new Map<string, Set<string>>();
  /** relationship id → instance at end 0 → instances at end 1, and the reverse. */
  private readonly forward: Index = new Map();
  private readonly backward: Index = new Map();
  private journal: Change[] | undefined;

  constructor(readonly vocabulary: Vocabulary) {}

  add(entity: string, id: string, value?: string | number): Instance {
    if (!this.vocabulary.entities.has(entity)) throw new Error(`unknown Entity ${entity}`);
    if (this.instances.has(id)) throw new Error(`duplicate instance id ${id}`);
    const instance: Instance = value === undefined ? { id, entity } : { id, entity, value };
    this.instances.set(id, instance);
    let ids = this.byEntity.get(entity);
    if (!ids) this.byEntity.set(entity, (ids = new Set()));
    ids.add(id);
    this.journal?.push({ op: "add", ...instance });
    return instance;
  }

  /** Removes an instance and every link it is part of. Removing nothing is a no-op. */
  remove(id: string): void {
    const instance = this.instances.get(id);
    if (!instance) return;
    for (const relationship of this.vocabulary.spec.relationships) {
      for (const b of [...(this.forward.get(relationship.id)?.get(id) ?? [])]) this.unlink(relationship.id, id, b);
      for (const a of [...(this.backward.get(relationship.id)?.get(id) ?? [])]) this.unlink(relationship.id, a, id);
    }
    this.instances.delete(id);
    this.byEntity.get(instance.entity)?.delete(id);
    this.journal?.push({ op: "remove", ...instance });
  }

  /** Changes the primitive a value-backed instance stands for (a Formula's text). */
  setValue(id: string, value: string | number): void {
    const instance = this.get(id);
    if (instance.value === value) return;
    this.instances.set(id, { id, entity: instance.entity, value });
    this.journal?.push({ op: "set", id, value, previous: instance.value });
  }

  /** Runs `change` and returns everything it did to the graph, in order. */
  record(change: (graph: this) => void): Change[] {
    const outer = this.journal;
    const journal: Change[] = [];
    this.journal = journal;
    try {
      change(this);
    } finally {
      this.journal = outer;
      outer?.push(...journal);
    }
    return journal;
  }

  /**
   * Applies a Delta as far as it still applies: adding what exists, removing or unlinking what
   * is gone, or linking what is missing is skipped. Returns what was actually done.
   */
  apply(delta: Delta): Change[] {
    return this.record(() => {
      for (const change of delta) {
        switch (change.op) {
          case "add":
            if (!this.has(change.id)) this.add(change.entity, change.id, change.value);
            break;
          case "remove":
            this.remove(change.id);
            break;
          case "set":
            if (this.has(change.id)) this.setValue(change.id, change.value);
            break;
          case "link":
            if (this.has(change.a) && this.has(change.b)) this.link(change.relationship, change.a, change.b, change.at);
            break;
          case "unlink":
            this.unlink(change.relationship, change.a, change.b);
            break;
        }
      }
    });
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

  /**
   * Links `a` (at the Relationship's end 0) with `b` (at end 1), last among their links unless
   * `at` says where. Linking twice is a no-op.
   */
  link(relationshipId: string, a: string, b: string, at?: readonly [number, number]): void {
    const relationship = this.vocabulary.relationship(relationshipId);
    if (!relationship) throw new Error(`unknown Relationship ${relationshipId}`);
    for (const [id, end] of [[a, relationship.ends[0]], [b, relationship.ends[1]]] as const) {
      const entity = this.get(id).entity;
      if (entity !== end?.entity) throw new Error(`${id} is ${entity}, but end '${end?.name}' is ${end?.entity}`);
    }
    if (!insert(this.forward, relationshipId, a, b, at?.[0])) return;
    insert(this.backward, relationshipId, b, a, at?.[1]);
    this.journal?.push({ op: "link", relationship: relationshipId, a, b });
  }

  unlink(relationshipId: string, a: string, b: string): void {
    const forward = erase(this.forward, relationshipId, a, b);
    if (forward < 0) return;
    const backward = erase(this.backward, relationshipId, b, a);
    this.journal?.push({ op: "unlink", relationship: relationshipId, a, b, at: [forward, backward] });
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
    // Both indexes are copied as they are: re-linking would keep the order of one direction only.
    for (const [from, to] of [[this.forward, copy.forward], [this.backward, copy.backward]] as const) {
      for (const [relationship, table] of from) to.set(relationship, new Map([...table].map(([key, values]) => [key, new Set(values)])));
    }
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

/** Adds a link to an index, at `position` or last; false if it was already there. */
function insert(index: Index, relationship: string, key: string, value: string, position?: number): boolean {
  let table = index.get(relationship);
  if (!table) index.set(relationship, (table = new Map()));
  let values = table.get(key);
  if (!values) table.set(key, (values = new Set()));
  if (values.has(value)) return false;
  if (position === undefined || position >= values.size) {
    values.add(value);
  } else {
    const ordered = [...values];
    ordered.splice(position, 0, value);
    table.set(key, new Set(ordered));
  }
  return true;
}

/** Removes a link from an index; where it stood, or -1 if it was not there. */
function erase(index: Index, relationship: string, key: string, value: string): number {
  const values = index.get(relationship)?.get(key);
  if (!values?.has(value)) return -1;
  const position = [...values].indexOf(value);
  values.delete(value);
  if (values.size === 0) index.get(relationship)!.delete(key);
  return position;
}
