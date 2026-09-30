/**
 * Type-checking a formula against a vocabulary: every name bound, every step a reachable end,
 * both sides of a comparison of one Entity, closures that stay on their Entity. What the
 * check walks through is exactly what the formula mentions.
 */
import type { Vocabulary } from "../vocabulary.js";
import { FormulaError, type Formula, type Path } from "./parse.js";

export interface Mentions {
  /** Entities named in the formula or reached by it. */
  readonly entities: ReadonlySet<string>;
  /** Ends navigated, as `relationshipId:endIndex`. */
  readonly ends: ReadonlySet<string>;
}

export function typecheck(formula: Formula, vocabulary: Vocabulary): Mentions {
  const entities = new Set<string>();
  const ends = new Set<string>();

  const path = (p: Path, env: ReadonlyMap<string, string>): string => {
    const bound = env.get(p.head);
    if (bound === undefined && !vocabulary.entities.has(p.head)) throw new FormulaError(`unbound name '${p.head}'`);
    let kind: string = bound ?? p.head;
    entities.add(kind);
    for (const step of p.steps) {
      const reachable = vocabulary.reachable(kind).get(step.end);
      if (!reachable || reachable.length === 0) throw new FormulaError(`${kind} has no end '${step.end}'`);
      if (reachable.length > 1) throw new FormulaError(`${kind}.${step.end} is ambiguous`);
      const target = reachable[0]!;
      if (step.closure && target.end.entity !== kind) {
        throw new FormulaError(`closure over ${kind}.${step.end} leaves ${kind}`);
      }
      ends.add(`${target.relationship.id}:${target.far}`);
      kind = target.end.entity;
      entities.add(kind);
    }
    return kind;
  };

  const check = (f: Formula, env: ReadonlyMap<string, string>): void => {
    switch (f.kind) {
      case "all":
      case "some": {
        const inner = new Map(env);
        for (const binding of f.bindings) inner.set(binding.name, path(binding.path, inner));
        check(f.body, inner);
        return;
      }
      case "not":
        check(f.operand, env);
        return;
      case "and":
      case "or":
      case "implies":
        check(f.left, env);
        check(f.right, env);
        return;
      case "compare": {
        const left = path(f.left, env);
        const right = path(f.right, env);
        if (left !== right) throw new FormulaError(`compares ${left} with ${right}`);
        return;
      }
      case "nonempty":
      case "empty":
        path(f.path, env);
        return;
    }
  };

  check(formula, new Map());
  return { entities, ends };
}
