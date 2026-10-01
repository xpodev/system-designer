/** LanguageEditor (Kernel): a Language, and which Entities, Relationships and Formulas it has. */
import { remove as removeFromModel, setName } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import {
  addNamed,
  element,
  freshId,
  maybe,
  operation,
  range,
  relinkFormulas,
  setBounds,
  str,
  text,
  type Operation,
} from "../operation.js";

const EDITOR = "LanguageEditor";

/** One side of a new Relationship: the end's Entity, its name and its range. */
export interface EndInput {
  readonly entity: string;
  readonly name: string;
  readonly range: string;
}

export function addEntity(session: EditSession, language: string, name: string): Edit {
  const id = freshId(session.target.graph, language, name);
  return session.edit("addition", `addEntity ${name}`, [id], (graph) => {
    addNamed(graph, "Entity", id, name, language, "entities");
    relinkFormulas(graph);
  });
}

export function addRelationship(session: EditSession, language: string, a: EndInput, b: EndInput): Edit {
  const id = freshId(session.target.graph, language, `${a.name}-${b.name}`);
  return session.edit("addition", `addRelationship ${a.name} <——> ${b.name}`, [id], (graph) => {
    graph.add("Relationship", id);
    graph.connect(language, "relationships", id);
    for (const end of [a, b]) {
      const endId = freshId(graph, id, end.name);
      addNamed(graph, "End", endId, end.name, id, "ends");
      graph.connect(endId, "entity", end.entity);
      setBounds(graph, endId, end.range);
    }
    relinkFormulas(graph);
  });
}

export function addFormula(session: EditSession, language: string, formula: string, constrains?: string): Edit {
  const id = freshId(session.target.graph, language, "formula");
  return session.edit("addition", `addFormula ${formula}`, [id], (graph) => {
    graph.add("Formula", id, formula);
    graph.connect(language, "formulas", id);
    if (constrains !== undefined) graph.connect(id, "constrains", constrains);
    relinkFormulas(graph);
  });
}

export function rename(session: EditSession, language: string, name: string): Edit {
  return session.edit("change", `rename Language ${name}`, [language], (graph) => setName(graph, language, name));
}

/** Removes a Language with the cascade the foundation defines. */
export function remove(session: EditSession, language: string): Edit {
  return session.edit("removal", `remove Language`, [language], (graph) => {
    removeFromModel(graph, language);
    relinkFormulas(graph);
  });
}

const LANGUAGE = element("language", "Language", "the Language");

export const languageEditor: readonly Operation[] = [
  operation(EDITOR, "addEntity", "addition", "Adds an Entity to a Language.", [LANGUAGE, text("name", "the Entity's name")], (s, a) =>
    addEntity(s, str(a, "language"), str(a, "name")),
  ),
  operation(
    EDITOR,
    "addRelationship",
    "addition",
    "Adds a Relationship between two Entities of a Language: the end named `aName`, with range `aRange`, is at `aEntity`.",
    [
      LANGUAGE,
      element("aEntity", "Entity", "the Entity at the first end"),
      text("aName", "the first end's name"),
      range("aRange", "the first end's range"),
      element("bEntity", "Entity", "the Entity at the second end"),
      text("bName", "the second end's name"),
      range("bRange", "the second end's range"),
    ],
    (s, a) =>
      addRelationship(
        s,
        str(a, "language"),
        { entity: str(a, "aEntity"), name: str(a, "aName"), range: str(a, "aRange") },
        { entity: str(a, "bEntity"), name: str(a, "bName"), range: str(a, "bRange") },
      ),
  ),
  operation(
    EDITOR,
    "addFormula",
    "addition",
    "Adds a Formula (an axiom) to a Language, optionally as a constraint of one of its Relationships.",
    [LANGUAGE, text("text", "the formula, in the ASCII syntax"), element("constrains", "Relationship", "the Relationship it constrains", true)],
    (s, a) => addFormula(s, str(a, "language"), str(a, "text"), maybe(a, "constrains")),
  ),
  operation(EDITOR, "rename", "change", "Renames a Language.", [LANGUAGE, text("name", "the new name")], (s, a) =>
    rename(s, str(a, "language"), str(a, "name")),
  ),
  operation(
    EDITOR,
    "remove",
    "removal",
    "Removes a Language: its contents, every mapping naming them, every Transformation from or to it with the Mediations they witnessed, and every reference to it.",
    [LANGUAGE],
    (s, a) => remove(s, str(a, "language")),
  ),
];
