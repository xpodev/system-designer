/**
 * Reading a file into a graph, in two phases: every instance is created first, then every
 * reference is resolved. A reference that leads nowhere, or to the wrong kind of thing, is a
 * load problem — the reverse of the mediation failing, which is the mediator's to report —
 * and the link is dropped. A file whose shape is not the format at all is a FormatError.
 */
import type { Graph } from "@systemathic/core";

export interface LoadProblem {
  /** Where in the file, as a JSON path. */
  readonly at: string;
  readonly message: string;
}

export class FormatError extends Error {}

export class Reader {
  readonly problems: LoadProblem[] = [];
  private readonly references: (() => void)[] = [];
  private readonly finishers: (() => void)[] = [];

  constructor(readonly graph: Graph) {}

  /** Creates an instance; a duplicate id is a problem, and the duplicate is skipped. */
  create(entity: string, id: unknown, at: string, value?: string | number): string | undefined {
    const key = string(id, `${at}.id`);
    if (this.graph.has(key)) {
      this.problems.push({ at, message: `duplicate id '${key}'` });
      return undefined;
    }
    this.graph.add(entity, key, value);
    return key;
  }

  /** Links `from` through `endName` to the instance with id `target`, once everything exists. */
  refer(from: string, endName: string, target: unknown, at: string): void {
    const id = string(target, at);
    this.references.push(() => {
      if (!this.graph.has(id)) {
        this.problems.push({ at, message: `refers to '${id}', which does not exist` });
        return;
      }
      const expected = this.graph.vocabulary.step(this.graph.get(from).entity, endName)?.end.entity;
      const actual = this.graph.get(id).entity;
      if (actual !== expected) {
        this.problems.push({ at, message: `refers to ${actual} '${id}', where a ${expected} is expected` });
        return;
      }
      this.graph.connect(from, endName, id);
    });
  }

  /** Runs once every reference is resolved. */
  finally(step: () => void): void {
    this.finishers.push(step);
  }

  finish(): void {
    for (const resolve of this.references) resolve();
    for (const step of this.finishers) step();
  }
}

export function object(value: unknown, at: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new FormatError(`${at}: expected an object`);
  return value as Record<string, unknown>;
}

export function array(value: unknown, at: string): unknown[] {
  if (!Array.isArray(value)) throw new FormatError(`${at}: expected an array`);
  return value;
}

export function string(value: unknown, at: string): string {
  if (typeof value !== "string") throw new FormatError(`${at}: expected a string`);
  return value;
}
