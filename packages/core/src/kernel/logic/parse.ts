/**
 * The syntax of formulas (docs/foundation.md, "The logic"), in its ASCII form. The grammar is
 * the one `schema/check.py` checks the schema's own axioms with.
 *
 *   formula     := disjunction ( "=>" formula )?
 *   disjunction := conjunction ( "or" conjunction )*
 *   conjunction := unary ( "and" unary )*
 *   unary       := "not" unary | "no" path | "some" path
 *                | ( "all" | "some" ) binding ( "," binding )* "." formula
 *                | "(" formula ")" | path ( "==" | "!=" | "in" ) path
 *   binding     := name "in" path
 *   path        := name ( "." ( "^" | "*" )? name )*
 *
 * A "." that joins a path is written without spaces; one followed by a space ends a
 * quantifier's bindings.
 */

export interface Step {
  readonly closure: "^" | "*" | null;
  readonly end: string;
}

export interface Path {
  readonly head: string;
  readonly steps: readonly Step[];
}

export interface Binding {
  readonly name: string;
  readonly path: Path;
}

export type Formula =
  | { readonly kind: "all" | "some"; readonly bindings: readonly Binding[]; readonly body: Formula }
  | { readonly kind: "not"; readonly operand: Formula }
  | { readonly kind: "and" | "or" | "implies"; readonly left: Formula; readonly right: Formula }
  | { readonly kind: "compare"; readonly op: "==" | "!=" | "in"; readonly left: Path; readonly right: Path }
  | { readonly kind: "nonempty" | "empty"; readonly path: Path };

export class FormulaError extends Error {}

const TOKEN = /\s*(?:(=>|==|!=)|(\.(?=[A-Za-z^*]))|(\.)|([(),^*])|([A-Za-z_]\w*))/y;
const KEYWORDS = new Set(["all", "some", "no", "in", "and", "or", "not"]);
const STEP = "\u0000step";
const SEPARATOR = "\u0000sep";

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const source = text.trimEnd();
  let position = 0;
  while (position < source.length) {
    TOKEN.lastIndex = position;
    const match = TOKEN.exec(source);
    if (!match || TOKEN.lastIndex === position) {
      throw new FormulaError(`unexpected character at ${position}: ${JSON.stringify(source.slice(position, position + 10))}`);
    }
    const [, operator, step, separator, punctuation, word] = match;
    tokens.push(operator ?? (step ? STEP : separator ? SEPARATOR : (punctuation ?? word!)));
    position = TOKEN.lastIndex;
  }
  return tokens;
}

export function parse(text: string): Formula {
  const tokens = tokenize(text);
  let index = 0;

  const peek = (offset = 0): string | undefined => tokens[index + offset];
  const take = (expected?: string): string => {
    const token = peek();
    if (token === undefined || (expected !== undefined && token !== expected)) {
      throw new FormulaError(`expected ${describe(expected) ?? "more input"}, got ${describe(token) ?? "end of formula"}`);
    }
    index += 1;
    return token;
  };

  const formula = (): Formula => {
    const left = disjunction();
    if (peek() === "=>") {
      take();
      return { kind: "implies", left, right: formula() };
    }
    return left;
  };

  const disjunction = (): Formula => {
    let left = conjunction();
    while (peek() === "or") {
      take();
      left = { kind: "or", left, right: conjunction() };
    }
    return left;
  };

  const conjunction = (): Formula => {
    let left = unary();
    while (peek() === "and") {
      take();
      left = { kind: "and", left, right: unary() };
    }
    return left;
  };

  const unary = (): Formula => {
    const token = peek();
    if (token === "not") {
      take();
      return { kind: "not", operand: unary() };
    }
    if (token === "no" || (token === "some" && peek(2) !== "in")) {
      take();
      return { kind: token === "no" ? "empty" : "nonempty", path: path() };
    }
    if (token === "all" || token === "some") {
      take();
      const bindings: Binding[] = [];
      do {
        if (bindings.length > 0) take(",");
        const name = take();
        if (KEYWORDS.has(name) || !/^[A-Za-z_]\w*$/.test(name)) throw new FormulaError(`bad variable ${describe(name)}`);
        take("in");
        bindings.push({ name, path: path() });
      } while (peek() === ",");
      take(SEPARATOR);
      return { kind: token, bindings, body: formula() };
    }
    if (token === "(") {
      take();
      const inner = formula();
      take(")");
      return inner;
    }
    const left = path();
    const op = take();
    if (op !== "==" && op !== "!=" && op !== "in") throw new FormulaError(`expected ==, != or in, got ${describe(op)}`);
    return { kind: "compare", op, left, right: path() };
  };

  const path = (): Path => {
    const head = take();
    if (!/^[A-Za-z_]\w*$/.test(head) || KEYWORDS.has(head)) throw new FormulaError(`expected a name, got ${describe(head)}`);
    const steps: Step[] = [];
    while (peek() === STEP) {
      take();
      const closure = peek() === "^" || peek() === "*" ? (take() as "^" | "*") : null;
      steps.push({ closure, end: take() });
    }
    return { head, steps };
  };

  const result = formula();
  if (peek() !== undefined) throw new FormulaError(`unexpected ${describe(peek())}`);
  return result;
}

function describe(token: string | undefined): string | undefined {
  if (token === STEP) return "'.'";
  if (token === SEPARATOR) return "'. '";
  return token === undefined ? undefined : `'${token}'`;
}
