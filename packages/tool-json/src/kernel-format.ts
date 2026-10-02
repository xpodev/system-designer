/**
 * KernelFormat: a Language — its Entities, Relationships and Formulas — as JSON. Names are
 * text, bounds are numbers with "N" for unbounded, and a Formula is its text; its mentions are
 * derived from the text once the whole file is read.
 */
import { boundInstance, boundOf, linkMentions, nameOf, setName, type Graph } from "@systemathic/core";
import { array, FormatError, object, string, type Reader } from "./reader.js";

/** An end; `name` is null for an unnamed end, which cannot be navigated to. */
export interface EndJson { id: string; name: string | null; entity: string; min: number; max: number | "N" }
export interface RelationshipJson { id: string; ends: EndJson[] }
export interface FormulaJson { id: string; text: string; constrains?: string }
export interface EntityJson { id: string; name: string }
export interface KernelLanguageJson { id: string; name: string; entities: EntityJson[]; relationships: RelationshipJson[]; formulas: FormulaJson[] }

export function readLanguage(reader: Reader, value: unknown, at: string): string | undefined {
  const json = object(value, at);
  const language = reader.create("Language", json.id, at);
  if (language === undefined) return undefined;
  const graph = reader.graph;
  setName(graph, language, string(json.name, `${at}.name`));

  array(json.entities, `${at}.entities`).forEach((value, index) => {
    const where = `${at}.entities[${index}]`;
    const entity = object(value, where);
    const id = reader.create("Entity", entity.id, where);
    if (id === undefined) return;
    setName(graph, id, string(entity.name, `${where}.name`));
    graph.connect(language, "entities", id);
  });

  array(json.relationships, `${at}.relationships`).forEach((value, index) => {
    const where = `${at}.relationships[${index}]`;
    const relationship = object(value, where);
    const id = reader.create("Relationship", relationship.id, where);
    if (id === undefined) return;
    graph.connect(language, "relationships", id);
    array(relationship.ends, `${where}.ends`).forEach((value, index) => {
      const at = `${where}.ends[${index}]`;
      const end = object(value, at);
      const endId = reader.create("End", end.id, at);
      if (endId === undefined) return;
      if (end.name !== null) setName(graph, endId, string(end.name, `${at}.name`));
      graph.connect(id, "ends", endId);
      reader.refer(endId, "entity", end.entity, `${at}.entity`);
      graph.connect(endId, "min", boundInstance(graph, natural(end.min, `${at}.min`)));
      if (end.max !== "N") graph.connect(endId, "max", boundInstance(graph, natural(end.max, `${at}.max`)));
    });
  });

  array(json.formulas, `${at}.formulas`).forEach((value, index) => {
    const where = `${at}.formulas[${index}]`;
    const formula = object(value, where);
    const id = reader.create("Formula", formula.id, where, string(formula.text, `${where}.text`));
    if (id === undefined) return;
    graph.connect(language, "formulas", id);
    if (formula.constrains !== undefined) reader.refer(id, "constrains", formula.constrains, `${where}.constrains`);
    reader.finally(() => linkMentions(graph, id));
  });

  return language;
}

export function writeLanguage(graph: Graph, language: string): KernelLanguageJson {
  return {
    id: language,
    name: nameOf(graph, language) ?? "",
    entities: graph.navigate(language, "entities").map((id) => ({ id, name: nameOf(graph, id) ?? "" })),
    relationships: graph.navigate(language, "relationships").map((id) => ({
      id,
      ends: graph.navigate(id, "ends").map((end) => ({
        id: end,
        name: nameOf(graph, end) ?? null,
        entity: graph.navigate(end, "entity")[0] ?? "",
        min: boundOf(graph, end, "min") ?? 0,
        max: boundOf(graph, end, "max") ?? "N",
      })),
    })),
    formulas: graph.navigate(language, "formulas").map((id) => {
      const [constrains] = graph.navigate(id, "constrains");
      const text = String(graph.get(id).value ?? "");
      return constrains === undefined ? { id, text } : { id, text, constrains };
    }),
  };
}

function natural(value: unknown, at: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new FormatError(`${at}: expected a natural number`);
  return value;
}
