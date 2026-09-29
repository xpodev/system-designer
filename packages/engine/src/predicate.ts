/**
 * A minimal boolean-expression evaluator for RelationshipConstraint.expression
 * strings, e.g. "(child.parent == self)". There's no separate "instantiation"
 * concept in this AST (unlike the spec's graph-instantiation language), so a
 * constraint is evaluated once, statically, against the two entities a
 * Relationship already connects: `self` (the owning entity) and `child` (the
 * entity at targetEntityId). Grammar: identifiers with dotted paths, ==, !=,
 * &&, ||, parentheses, string/number/boolean literals.
 */

export class PredicateError extends Error {}

type Token =
  | { kind: "ident"; value: string }
  | { kind: "op"; value: "==" | "!=" | "&&" | "||" | "(" | ")" }
  | { kind: "literal"; value: string | number | boolean };

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const src = expression.trim();

  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "(" || ch === ")") {
      tokens.push({ kind: "op", value: ch });
      i++;
      continue;
    }
    if (src.startsWith("==", i)) {
      tokens.push({ kind: "op", value: "==" });
      i += 2;
      continue;
    }
    if (src.startsWith("!=", i)) {
      tokens.push({ kind: "op", value: "!=" });
      i += 2;
      continue;
    }
    if (src.startsWith("&&", i)) {
      tokens.push({ kind: "op", value: "&&" });
      i += 2;
      continue;
    }
    if (src.startsWith("||", i)) {
      tokens.push({ kind: "op", value: "||" });
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let value = "";
      while (j < src.length && src[j] !== quote) {
        value += src[j];
        j++;
      }
      if (src[j] !== quote) throw new PredicateError(`Unterminated string literal in: ${expression}`);
      tokens.push({ kind: "literal", value });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      tokens.push({ kind: "literal", value: Number(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_.]/.test(src[j])) j++;
      const word = src.slice(i, j);
      if (word === "true" || word === "false") {
        tokens.push({ kind: "literal", value: word === "true" });
      } else {
        tokens.push({ kind: "ident", value: word });
      }
      i = j;
      continue;
    }
    throw new PredicateError(`Unexpected character '${ch}' in expression: ${expression}`);
  }

  return tokens;
}

type Node =
  | { type: "or"; left: Node; right: Node }
  | { type: "and"; left: Node; right: Node }
  | { type: "cmp"; op: "==" | "!="; left: Node; right: Node }
  | { type: "ident"; path: string }
  | { type: "literal"; value: string | number | boolean };

function parse(tokens: Token[], expression: string): Node {
  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }
  function next(): Token {
    const t = tokens[pos];
    if (!t) throw new PredicateError(`Unexpected end of expression: ${expression}`);
    pos++;
    return t;
  }

  function parseOr(): Node {
    let left = parseAnd();
    while (peek()?.kind === "op" && peek()!.value === "||") {
      next();
      left = { type: "or", left, right: parseAnd() };
    }
    return left;
  }

  function parseAnd(): Node {
    let left = parseCmp();
    while (peek()?.kind === "op" && peek()!.value === "&&") {
      next();
      left = { type: "and", left, right: parseCmp() };
    }
    return left;
  }

  function parseCmp(): Node {
    const left = parsePrimary();
    const t = peek();
    if (t?.kind === "op" && (t.value === "==" || t.value === "!=")) {
      next();
      const right = parsePrimary();
      return { type: "cmp", op: t.value, left, right };
    }
    return left;
  }

  function parsePrimary(): Node {
    const t = next();
    if (t.kind === "op" && t.value === "(") {
      const inner = parseOr();
      const closing = next();
      if (!(closing.kind === "op" && closing.value === ")")) {
        throw new PredicateError(`Expected ')' in expression: ${expression}`);
      }
      return inner;
    }
    if (t.kind === "ident") return { type: "ident", path: t.value };
    if (t.kind === "literal") return { type: "literal", value: t.value };
    throw new PredicateError(`Unexpected token in expression: ${expression}`);
  }

  const result = parseOr();
  if (pos !== tokens.length) throw new PredicateError(`Trailing tokens in expression: ${expression}`);
  return result;
}

function resolvePath(path: string, context: Record<string, unknown>): unknown {
  const parts = path.split(".");
  let current: unknown = context;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      throw new PredicateError(`Unknown property '${path}' — no value at '${part}'.`);
    }
    if (!(part in (current as Record<string, unknown>))) {
      throw new PredicateError(`Unknown property '${path}' — no value at '${part}'.`);
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function evaluateNode(node: Node, context: Record<string, unknown>): unknown {
  switch (node.type) {
    case "or":
      return Boolean(evaluateNode(node.left, context)) || Boolean(evaluateNode(node.right, context));
    case "and":
      return Boolean(evaluateNode(node.left, context)) && Boolean(evaluateNode(node.right, context));
    case "cmp": {
      const left = evaluateNode(node.left, context);
      const right = evaluateNode(node.right, context);
      return node.op === "==" ? left === right : left !== right;
    }
    case "ident":
      return resolvePath(node.path, context);
    case "literal":
      return node.value;
  }
}

/** Throws `PredicateError` on a malformed expression or an unresolvable
 *  property path; otherwise returns the expression's boolean value. */
export function evaluatePredicate(expression: string, context: Record<string, unknown>): boolean {
  const tokens = tokenize(expression);
  const ast = parse(tokens, expression);
  return Boolean(evaluateNode(ast, context));
}
