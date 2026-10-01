/**
 * An editor operation, as data: its name, what it does, and its parameters. Every operation
 * takes the EditSession it acts in and returns the Edit it made. Clients — a UI's forms, an MCP
 * server's tools, a command line — are built from these descriptors, so a new operation, or a
 * new editor, needs no change to any client.
 */
import { boundInstance, linkMentions, setName, type Graph } from "@systemathic/core";
import type { Edit, EditKind, EditSession } from "@systemathic/editing";

/** An argument: an Element of some Entity, several, a name or text, a range, a position, or a choice. */
export type ParameterKind = "element" | "elements" | "text" | "range" | "index" | "flag";

export interface ParameterSpec {
  readonly name: string;
  readonly kind: ParameterKind;
  /** For `element` and `elements`: the Entities an argument may be an instance of. */
  readonly of?: readonly string[];
  readonly optional?: boolean;
  readonly about: string;
}

export interface Operation {
  readonly editor: string;
  readonly name: string;
  readonly about: string;
  readonly kind: EditKind;
  readonly parameters: readonly ParameterSpec[];
  /** Runs the operation with arguments by parameter name. Throws ArgumentError on arguments of the wrong shape. */
  run(session: EditSession, args: Readonly<Record<string, unknown>>): Edit;
}

/** Arguments that do not fit an operation's parameters. Ill-formed results are never refused; malformed requests are. */
export class ArgumentError extends Error {}

export type Arguments = Readonly<Record<string, unknown>>;

/** Declares an operation whose body receives checked arguments. */
export function operation(
  editor: string,
  name: string,
  kind: EditKind,
  about: string,
  parameters: readonly ParameterSpec[],
  body: (session: EditSession, args: Arguments) => Edit,
): Operation {
  return {
    editor,
    name,
    about,
    kind,
    parameters,
    run(session, args) {
      for (const parameter of parameters) check(session.target.graph, parameter, args[parameter.name]);
      return body(session, args);
    },
  };
}

export const element = (name: string, of: string | readonly string[], about: string, optional = false): ParameterSpec => ({
  name,
  kind: "element",
  of: typeof of === "string" ? [of] : of,
  about,
  ...(optional ? { optional } : {}),
});
export const elements = (name: string, of: string | readonly string[], about: string): ParameterSpec => ({
  name,
  kind: "elements",
  of: typeof of === "string" ? [of] : of,
  about,
});
export const text = (name: string, about: string, optional = false): ParameterSpec => ({ name, kind: "text", about, ...(optional ? { optional } : {}) });
export const range = (name: string, about: string): ParameterSpec => ({ name, kind: "range", about });
export const index = (name: string, about: string, optional = false): ParameterSpec => ({ name, kind: "index", about, ...(optional ? { optional } : {}) });
export const flag = (name: string, about: string): ParameterSpec => ({ name, kind: "flag", about });

function check(graph: Graph, parameter: ParameterSpec, value: unknown): void {
  const fail = (expected: string) => {
    throw new ArgumentError(`${parameter.name}: expected ${expected}, got ${JSON.stringify(value)}`);
  };
  if (value === undefined || value === null) {
    if (!parameter.optional) fail(describeKind(parameter));
    return;
  }
  const isElement = (id: unknown) => typeof id === "string" && graph.has(id) && (parameter.of ?? []).includes(graph.get(id).entity);
  switch (parameter.kind) {
    case "element":
      if (!isElement(value)) fail(describeKind(parameter));
      return;
    case "elements":
      if (!Array.isArray(value) || !value.every(isElement)) fail(describeKind(parameter));
      return;
    case "text":
      if (typeof value !== "string") fail("text");
      return;
    case "range":
      if (typeof value !== "string" || parseRange(value) === undefined) fail("a range such as 0..1 or 1..N");
      return;
    case "index":
      if (typeof value !== "number" || !Number.isInteger(value) || value < 0) fail("a position, from 0");
      return;
    case "flag":
      if (typeof value !== "boolean") fail("true or false");
      return;
  }
}

function describeKind(parameter: ParameterSpec): string {
  const of = (parameter.of ?? []).join(" or ");
  const article = /^[AEIOU]/.test(of) ? "an" : "a";
  return parameter.kind === "element" ? `the id of ${article} ${of}` : parameter.kind === "elements" ? `ids of ${of}s` : parameter.kind;
}

/** `min..max`, with `N` for unbounded; malformed text is undefined. An ill-formed range (`2..1`) parses. */
export function parseRange(value: string): { min: number; max: number | null } | undefined {
  const match = /^(\d+)\.\.(\d+|N)$/.exec(value.trim());
  if (!match) return undefined;
  return { min: Number(match[1]), max: match[2] === "N" ? null : Number(match[2]) };
}

/** A fresh, readable id under `parent`: `parent.slug`, `parent.slug-2`, … */
export function freshId(graph: Graph, parent: string, name: string): string {
  const slug = name.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "item";
  const base = `${parent}.${slug}`;
  let id = base;
  for (let n = 2; graph.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** Adds a named instance owned by `owner` through `end`. */
export function addNamed(graph: Graph, entity: string, id: string, name: string, owner: string, end: string): void {
  graph.add(entity, id);
  setName(graph, id, name);
  graph.connect(owner, end, id);
}

/** Sets an End's range: `min`, and `max` unless unbounded. */
export function setBounds(graph: Graph, end: string, value: string): void {
  const { min, max } = parseRange(value)!;
  graph.disconnect(end, "min");
  graph.disconnect(end, "max");
  graph.connect(end, "min", boundInstance(graph, min));
  if (max !== null) graph.connect(end, "max", boundInstance(graph, max));
}

/**
 * Formulas are kept as text; which Entities and ends they mention follows from it, so after a
 * change to a vocabulary every Formula's mentions are derived again.
 */
export function relinkFormulas(graph: Graph): void {
  for (const formula of graph.ofEntity("Formula")) linkMentions(graph, formula);
}

export const str = (args: Arguments, name: string): string => args[name] as string;
export const ids = (args: Arguments, name: string): string[] => [...((args[name] as string[] | undefined) ?? [])];
export const maybe = (args: Arguments, name: string): string | undefined => (args[name] ?? undefined) as string | undefined;
