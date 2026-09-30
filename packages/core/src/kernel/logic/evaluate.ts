/**
 * Evaluating a formula on a finite model (docs/foundation.md, "The logic"). Paths denote sets
 * of instances; `==` is equality of those sets (identity, on single instances), `in` is
 * inclusion, and `some`/`no` test emptiness. Evaluation always terminates.
 */
import type { Graph } from "../graph.js";
import type { Formula, Path } from "./parse.js";

export type Environment = ReadonlyMap<string, string>;

export function holds(formula: Formula, graph: Graph, env: Environment = new Map()): boolean {
  switch (formula.kind) {
    case "all":
    case "some": {
      const wanted = formula.kind === "all";
      let result = wanted;
      assignments(formula.bindings, graph, env, (inner) => {
        if (holds(formula.body, graph, inner) !== wanted) {
          result = !wanted;
          return false;
        }
        return true;
      });
      return result;
    }
    case "not":
      return !holds(formula.operand, graph, env);
    case "and":
      return holds(formula.left, graph, env) && holds(formula.right, graph, env);
    case "or":
      return holds(formula.left, graph, env) || holds(formula.right, graph, env);
    case "implies":
      return !holds(formula.left, graph, env) || holds(formula.right, graph, env);
    case "compare": {
      const left = evaluate(formula.left, graph, env);
      const right = evaluate(formula.right, graph, env);
      const included = [...left].every((id) => right.has(id));
      if (formula.op === "in") return included;
      const equal = included && left.size === right.size;
      return formula.op === "==" ? equal : !equal;
    }
    case "nonempty":
      return evaluate(formula.path, graph, env).size > 0;
    case "empty":
      return evaluate(formula.path, graph, env).size === 0;
  }
}

/**
 * The assignments that falsify a formula. For `all x in X, y in Y. body`, each failing
 * assignment of the bound variables; for any other formula that is false, one empty one.
 */
export function counterexamples(formula: Formula, graph: Graph, limit = 100): Environment[] {
  if (formula.kind !== "all") return holds(formula, graph) ? [] : [new Map()];
  const found: Environment[] = [];
  assignments(formula.bindings, graph, new Map(), (env) => {
    if (!holds(formula.body, graph, env)) found.push(env);
    return found.length < limit;
  });
  return found;
}

export function evaluate(path: Path, graph: Graph, env: Environment): Set<string> {
  const bound = env.get(path.head);
  let current = new Set(bound === undefined ? graph.ofEntity(path.head) : [bound]);
  for (const step of path.steps) {
    const next = new Set<string>();
    for (const id of current) {
      if (step.closure === null) {
        for (const other of graph.navigate(id, step.end)) next.add(other);
        continue;
      }
      if (step.closure === "*") next.add(id);
      const frontier = graph.navigate(id, step.end);
      const seen = new Set<string>();
      while (frontier.length > 0) {
        const other = frontier.pop()!;
        if (seen.has(other)) continue;
        seen.add(other);
        next.add(other);
        frontier.push(...graph.navigate(other, step.end));
      }
    }
    current = next;
  }
  return current;
}

/** Visits every assignment of the bindings, in order; `visit` returns false to stop. */
function assignments(
  bindings: readonly { name: string; path: Path }[],
  graph: Graph,
  env: Environment,
  visit: (env: Environment) => boolean,
): boolean {
  const [first, ...rest] = bindings;
  if (!first) return visit(env);
  for (const id of evaluate(first.path, graph, env)) {
    const inner = new Map(env).set(first.name, id);
    if (!assignments(rest, graph, inner, visit)) return false;
  }
  return true;
}
