/**
 * Specification (docs/tool-design.md): a design, exported as a contract for validators. A
 * Statement is a design fact — a Language's vocabulary, what a Domain may use, which crossings
 * exist; a Requirement is a design rule, from the profile the design was verified against; an
 * Obligation is what an implementation must satisfy that no design check can (foundation.md,
 * O1–O3), for specific Subjects. Every part has an id that stays the same as long as the
 * Elements it is about do, so a validator can refer to it.
 */
import { effectiveLanguages, nameOf, parameters, type Graph } from "@systemathic/core";
import type { SystemContext } from "@systemathic/tool";
import type { Profile } from "@systemathic/verifier";

export interface Statement {
  readonly id: string;
  readonly text: string;
  /** Ids of the Elements it is about. */
  readonly subjects: readonly string[];
}

export interface Section {
  readonly id: string;
  readonly title: string;
  readonly statements: readonly Statement[];
  readonly sections: readonly Section[];
}

export interface Requirement {
  readonly id: string;
  readonly rule: string;
  readonly severity: "error" | "warning";
  readonly about: string;
  readonly script: string;
}

export type ObligationKind = "O1" | "O2" | "O3";

export interface Obligation {
  readonly id: string;
  readonly kind: ObligationKind;
  readonly text: string;
  readonly subjects: readonly string[];
}

export interface Specification {
  readonly system: string;
  readonly sections: readonly Section[];
  readonly requirements: readonly Requirement[];
  readonly obligations: readonly Obligation[];
}

const name = (graph: Graph, id: string | undefined) => (id === undefined ? "?" : (nameOf(graph, id) ?? id));
const names = (graph: Graph, ids: readonly string[]) => ids.map((id) => name(graph, id)).join(", ") || "none";
const statement = (id: string, text: string, ...subjects: string[]): Statement => ({ id, text, subjects });

function range(graph: Graph, end: string): string {
  const [min] = graph.navigate(end, "min");
  const [max] = graph.navigate(end, "max");
  return `${min === undefined ? "?" : graph.get(min).value}..${max === undefined ? "N" : graph.get(max).value}`;
}

function language(graph: Graph, id: string): Section {
  const statements: Statement[] = [];
  for (const entity of graph.navigate(id, "entities")) statements.push(statement(`entity:${entity}`, `Entity ${name(graph, entity)}.`, entity));
  for (const relationship of graph.navigate(id, "relationships")) {
    const ends = graph.navigate(relationship, "ends");
    const sides = ends.map((end) => `${name(graph, graph.navigate(end, "entity")[0])} (end '${name(graph, end)}', ${range(graph, end)})`);
    statements.push(statement(`relationship:${relationship}`, `Relationship ${sides.join(" <——> ")}.`, relationship, ...ends));
  }
  for (const interaction of graph.navigate(id, "interactions")) {
    const params = parameters(graph, interaction);
    const signature = params.map((p) => `${name(graph, p)}: ${name(graph, graph.navigate(p, "type")[0])}`).join(", ");
    const [primary] = graph.navigate(interaction, "primary");
    const action = primary === undefined ? "" : ` It is an Action on '${name(graph, primary)}'.`;
    statements.push(
      statement(`interaction:${interaction}`, `Interaction ${name(graph, interaction)}(${signature}) → ${name(graph, graph.navigate(interaction, "output")[0])}.${action}`, interaction),
    );
  }
  for (const entity of graph.navigate(id, "entities")) {
    const [comparison] = graph.navigate(entity, "comparison");
    if (comparison !== undefined) {
      statements.push(statement(`comparison:${entity}`, `${name(graph, entity)}s are compared by ${name(graph, comparison)}.`, entity, comparison));
    }
  }
  for (const formula of graph.navigate(id, "formulas")) {
    statements.push(statement(`axiom:${formula}`, `Axiom: ${String(graph.get(formula).value ?? "")}`, formula));
  }
  return { id: `language:${id}`, title: `Language ${name(graph, id)}`, statements, sections: [] };
}

function transformationStatements(graph: Graph, t: string): Statement[] {
  const [source] = graph.navigate(t, "source");
  const [target] = graph.navigate(t, "target");
  const [reverse] = graph.navigate(t, "reverse");
  const context = reverse === undefined ? [] : graph.navigate(reverse, "context");
  const kind =
    reverse === undefined
      ? "a projection: one-way, with no reverse"
      : context.length === 0
        ? "a mediation with a reverse by value"
        : `a mediation with a reverse by reference, keeping ${names(graph, context)} as context`;
  const statements = [statement(`transformation:${t}`, `Transformation ${name(graph, t)}: ${name(graph, source)} → ${name(graph, target)}, ${kind}.`, t)];
  for (const end of ["entityMappings", "relationshipMappings", "interactionMappings"]) {
    for (const mapping of graph.navigate(t, end)) {
      const [from] = graph.navigate(mapping, "source");
      const targets = graph.navigate(mapping, "targets");
      const describe = (id: string | undefined) => (id !== undefined && graph.get(id).entity === "Relationship" ? `Relationship ${id}` : name(graph, id));
      statements.push(statement(`mapping:${mapping}`, `${describe(from)} is represented with ${targets.map(describe).join(", ") || "nothing"}.`, mapping, ...(from ? [from] : []), ...targets));
    }
  }
  for (const deferral of graph.navigate(t, "deferred")) {
    const item = ["entity", "relationship", "interaction"].flatMap((end) => graph.navigate(deferral, end))[0];
    statements.push(statement(`deferred:${deferral}`, `${item === undefined ? "?" : name(graph, item)} is deliberately left unmapped.`, deferral, ...(item ? [item] : [])));
  }
  return statements;
}

function domain(graph: Graph, id: string): Section {
  const own = graph.navigate(id, "languages");
  const references = graph.navigate(id, "references");
  const scope = [...effectiveLanguages(graph, id)];
  const statements = [
    statement(`uses:${id}`, `Uses the Languages ${names(graph, own)}.`, id, ...own),
    statement(`references:${id}`, `References the Domains ${names(graph, references)}.`, id, ...references),
    statement(`scope:${id}`, `May use exactly the Languages ${names(graph, scope)}, and nothing else.`, id, ...scope),
    ...graph.navigate(id, "transformations").flatMap((t) => transformationStatements(graph, t)),
  ];
  return { id: `domain:${id}`, title: `Domain ${name(graph, id)}`, statements, sections: [] };
}

function mediation(graph: Graph, id: string): Statement {
  const [what, how, mediator] = ["what", "how", "mediator"].map((role) => graph.navigate(id, role)[0]);
  return statement(
    `mediation:${id}`,
    `${name(graph, what)} is carried out over ${name(graph, how)}; only ${name(graph, mediator)} knows both.`,
    id,
    ...[what, how, mediator].filter((x): x is string => x !== undefined),
  );
}

function obligations(graph: Graph, system: string): Obligation[] {
  const found: Obligation[] = [];
  for (const language of graph.navigate(system, "languages")) {
    found.push({ id: `O1:${language}`, kind: "O1", text: `Every instance of ${name(graph, language)} satisfies its ranges and axioms.`, subjects: [language] });
  }
  for (const holder of graph.navigate(system, "domains")) {
    for (const t of graph.navigate(holder, "transformations")) {
      const [source] = graph.navigate(t, "source");
      if (graph.navigate(t, "reverse").length > 0) {
        found.push({ id: `O2:${t}`, kind: "O2", text: `${name(graph, t)}: reading back what it represents gives back an equivalent ${name(graph, source)} instance.`, subjects: [t] });
      }
      if (source !== undefined && graph.navigate(source, "formulas").length > 0) {
        found.push({ id: `O3:${t}`, kind: "O3", text: `${name(graph, t)} preserves the axioms of ${name(graph, source)}.`, subjects: [t, source] });
      }
    }
  }
  return found;
}

/** The Specification of a system context, with the Requirements of the profile it is verified against, if any. */
export function specify(context: SystemContext, profile?: Profile): Specification {
  const graph = context.design;
  const [system] = graph.ofEntity("System");
  if (system === undefined) throw new Error("the design has no System");
  const sections: Section[] = [
    { id: "languages", title: "Languages", statements: [], sections: graph.navigate(system, "languages").map((l) => language(graph, l)) },
    { id: "domains", title: "Domains", statements: [], sections: graph.navigate(system, "domains").map((d) => domain(graph, d)) },
    { id: "mediations", title: "Mediations", statements: graph.navigate(system, "mediations").map((m) => mediation(graph, m)), sections: [] },
  ];
  const requirements = (profile?.rules ?? []).map((rule) => ({ id: `R:${rule.name}`, rule: rule.name, severity: rule.severity, about: rule.about, script: rule.script }));
  return { system: name(graph, system), sections, requirements, obligations: obligations(graph, system) };
}
