/**
 * A Formula is kept as text. What the Kernel sees of it — the Entities and ends it mentions —
 * is derived by type-checking that text against the vocabulary of the Formula's own
 * Language. A Formula that does not parse, or mentions something outside its Language,
 * simply has no mentions; the diagnoser reports why.
 */
import type { Graph } from "./graph.js";
import { FormulaError, parse } from "./logic/parse.js";
import { typecheck } from "./logic/typecheck.js";
import { nameOf } from "./values.js";
import { Vocabulary, type EndSpec, type RelationshipSpec } from "./vocabulary.js";

/** A Language of a model, as a vocabulary: Entities and ends by name, Relationships by instance id. */
export function languageVocabulary(graph: Graph, language: string): { vocabulary: Vocabulary; entityIds: Map<string, string> } {
  const entityIds = new Map<string, string>();
  for (const entity of graph.navigate(language, "entities")) {
    const name = nameOf(graph, entity);
    if (name !== undefined) entityIds.set(name, entity);
  }
  const relationships: RelationshipSpec[] = [];
  for (const relationship of graph.navigate(language, "relationships")) {
    const ends: EndSpec[] = [];
    for (const end of graph.navigate(relationship, "ends")) {
      const [entity] = graph.navigate(end, "entity");
      const entityName = entity === undefined ? undefined : nameOf(graph, entity);
      if (entityName === undefined) break;
      // An unnamed end cannot be navigated to: it gets a name no formula can write.
      ends.push({ name: nameOf(graph, end) ?? UNNAMED, entity: entityName, min: 0, max: null });
    }
    if (ends.length === 2) relationships.push({ id: relationship, ends });
  }
  const vocabulary = new Vocabulary({ entities: [...entityIds.keys()], relationships, axioms: [] });
  return { vocabulary, entityIds };
}

/** What an unnamed end is called inside a vocabulary: nothing a formula's text can spell. */
const UNNAMED = "\u0000unnamed";

export type FormulaAnalysis =
  | { readonly ok: true; readonly entities: string[]; readonly ends: string[] }
  | { readonly ok: false; readonly error: string };

/** Parses and type-checks a Formula's text against its Language; mentions are instance ids. */
export function analyzeFormula(graph: Graph, formula: string): FormulaAnalysis {
  const [language] = graph.navigate(formula, "language");
  if (language === undefined) return { ok: false, error: "the formula belongs to no Language" };
  const { vocabulary, entityIds } = languageVocabulary(graph, language);
  try {
    const mentions = typecheck(parse(String(graph.get(formula).value ?? "")), vocabulary);
    const ends = [...mentions.ends].map((key) => {
      const separator = key.lastIndexOf(":");
      const relationship = key.slice(0, separator);
      return graph.navigate(relationship, "ends")[Number(key.slice(separator + 1))]!;
    });
    return { ok: true, entities: [...mentions.entities].map((name) => entityIds.get(name)!), ends };
  } catch (error) {
    if (error instanceof FormulaError) return { ok: false, error: error.message };
    throw error;
  }
}

/** Makes a Formula's mention links those its text implies, changing only the links that differ. */
export function linkMentions(graph: Graph, formula: string): FormulaAnalysis {
  const analysis = analyzeFormula(graph, formula);
  const wanted = { mentionedEntities: analysis.ok ? analysis.entities : [], mentionedEnds: analysis.ok ? analysis.ends : [] };
  for (const [end, ids] of Object.entries(wanted)) {
    const keep = new Set(ids);
    for (const id of graph.navigate(formula, end)) if (!keep.has(id)) graph.disconnect(formula, end, id);
    for (const id of ids) graph.connect(formula, end, id);
  }
  return analysis;
}
