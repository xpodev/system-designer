/**
 * Scope and witnesses (docs/foundation.md, W4 and W6) as functions on a model: a Domain's
 * effective Languages, whether a Transformation is in scope of its holder, and whether a
 * Mediation is witnessed by its mediator.
 */
import type { Graph } from "../kernel/graph.js";

/** `langs*(D) = (D.*references).languages` */
export function effectiveLanguages(graph: Graph, domain: string): Set<string> {
  const languages = new Set<string>();
  const seen = new Set<string>();
  const pending = [domain];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (seen.has(current) || !graph.has(current)) continue;
    seen.add(current);
    for (const language of graph.navigate(current, "languages")) languages.add(language);
    pending.push(...graph.navigate(current, "references"));
  }
  return languages;
}

/** W4: both Languages of a Transformation are in scope of its holder. */
export function inScope(graph: Graph, transformation: string): boolean {
  const [holder] = graph.navigate(transformation, "holder");
  if (holder === undefined) return false;
  const scope = effectiveLanguages(graph, holder);
  return ["source", "target"].every((end) => graph.navigate(transformation, end).every((language) => scope.has(language)));
}

/** W6: the mediator holds a reversible Transformation from the what's Languages to the how's. */
export function witnessed(graph: Graph, mediation: string): boolean {
  const [what] = graph.navigate(mediation, "what");
  const [how] = graph.navigate(mediation, "how");
  const [mediator] = graph.navigate(mediation, "mediator");
  if (what === undefined || how === undefined || mediator === undefined) return false;
  const whats = effectiveLanguages(graph, what);
  const hows = effectiveLanguages(graph, how);
  return graph.navigate(mediator, "transformations").some((transformation) => {
    const [source] = graph.navigate(transformation, "source");
    const [target] = graph.navigate(transformation, "target");
    if (source === undefined || target === undefined) return false;
    return graph.navigate(transformation, "reverse").length > 0 && whats.has(source) && hows.has(target);
  });
}
