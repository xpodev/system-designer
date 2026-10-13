/**
 * KernelFormat: a Language — what it extends, its Entities (each with what it extends),
 * Relationships and Formulas — as JSON. Names are text, bounds are numbers with "N" for
 * unbounded, and a Formula is its text; what it mentions is derived from the text, never stored.
 */
import { boundInstance, boundOf, nameOf, setName, type Graph } from "@systemathic/core";
import { array, FormatError, object, string, type Reader } from "./reader.js";

/** An end; `name` is null for an unnamed end, which cannot be navigated to. */
export interface EndJson { id: string; name: string | null; entity: string; min: number; max: number | "N" }
export interface RelationshipJson { id: string; ends: EndJson[] }
export interface FormulaJson { id: string; text: string }
export interface EntityJson { id: string; name: string; extends: string[] }
export interface KernelLanguageJson {
  id: string; name: string; extends: string[];
  entities: EntityJson[]; relationships: RelationshipJson[]; formulas: FormulaJson[];
}

export function readLanguage(reader: Reader, value: unknown, at: string): string | undefined {
  const json = object(value, at);
  const language = reader.create("Language", json.id, at);
  if (language === undefined) return undefined;
  const graph = reader.graph;
  setName(graph, language, string(json.name, `${at}.name`));
  array(json.extends, `${at}.extends`).forEach((ref, index) => reader.refer(language, "extends", ref, `${at}.extends[${index}]`));

  array(json.entities, `${at}.entities`).forEach((value, index) => {
    const where = `${at}.entities[${index}]`;
    const entity = object(value, where);
    const id = reader.create("Entity", entity.id, where);
    if (id === undefined) return;
    setName(graph, id, string(entity.name, `${where}.name`));
    graph.connect(language, "entities", id);
    array(entity.extends, `${where}.extends`).forEach((ref, index) => reader.refer(id, "extends", ref, `${where}.extends[${index}]`));
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
      readRange(reader, endId, end, at);
    });
  });

  array(json.formulas, `${at}.formulas`).forEach((value, index) => {
    const where = `${at}.formulas[${index}]`;
    const formula = object(value, where);
    const id = reader.create("Formula", formula.id, where, string(formula.text, `${where}.text`));
    if (id === undefined) return;
    graph.connect(language, "formulas", id);
  });

  return language;
}

export function writeLanguage(graph: Graph, language: string): KernelLanguageJson {
  return {
    id: language,
    name: nameOf(graph, language) ?? "",
    extends: graph.navigate(language, "extends"),
    entities: graph.navigate(language, "entities").map((id) => ({ id, name: nameOf(graph, id) ?? "", extends: graph.navigate(id, "extends") })),
    relationships: graph.navigate(language, "relationships").map((id) => ({
      id,
      ends: graph.navigate(id, "ends").map((end) => ({
        id: end,
        name: nameOf(graph, end) ?? null,
        entity: graph.navigate(end, "entity")[0] ?? "",
        ...writeRange(graph, end),
      })),
    })),
    formulas: graph.navigate(language, "formulas").map((id) => ({ id, text: String(graph.get(id).value ?? "") })),
  };
}

/** A range — of an End, or of an Instance — as `min` and `max`, with "N" for unbounded. */
export function readRange(reader: Reader, id: string, json: Record<string, unknown>, at: string): void {
  reader.graph.connect(id, "min", boundInstance(reader.graph, natural(json.min, `${at}.min`)));
  if (json.max !== "N") reader.graph.connect(id, "max", boundInstance(reader.graph, natural(json.max, `${at}.max`)));
}

export function writeRange(graph: Graph, id: string): { min: number; max: number | "N" } {
  return { min: boundOf(graph, id, "min") ?? 0, max: boundOf(graph, id, "max") ?? "N" };
}

function natural(value: unknown, at: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new FormatError(`${at}: expected a natural number`);
  return value;
}
