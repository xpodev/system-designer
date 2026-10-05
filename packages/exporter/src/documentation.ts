/**
 * Documentation: a design written up for the people who build on it and with it. Every
 * Language, Domain and Mediation, in the System's order, with what it contains and the
 * Description of each thing (from the Documentation tool context), and the rules the design is
 * verified against with their own
 * documentation. Unlike a Specification it is not a contract: it has no ids to cite and does not
 * read back. It says the same facts in prose — a Relationship as what each side has of the other.
 */
import { boundOf, describe as describeElement, nameOf, parameters, type Graph } from "@systemathic/core";
import { descriptions } from "@systemathic/documentation";
import type { SystemContext } from "@systemathic/tool";
import type { Profile } from "@systemathic/verifier";

/** Something documented: what it is called, and its Description if it has one. */
export interface Documented {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
}

/** One way through a Relationship: from an Entity, by the far end's name, to how many of the far end's Entity. */
export interface Navigation {
  /** The end navigated to. */
  readonly end: string;
  readonly from: string;
  /** Null for an unnamed end, which cannot be navigated to. */
  readonly by: string | null;
  readonly to: string;
  readonly min: number;
  /** Null for unbounded. */
  readonly max: number | null;
  /** The navigation in a sentence: `Each Player has any number of Monsters, as prey.` */
  readonly reading: string;
}

export interface RelationshipDoc extends Documented {
  /** Both ways through it, each from the Entity at one end. */
  readonly navigations: readonly Navigation[];
}

export interface InteractionDoc extends Documented {
  readonly signature: string;
  /** The primary Parameter's name, when it is an Action. */
  readonly action?: string;
}

export interface AxiomDoc {
  readonly id: string;
  readonly text: string;
  readonly description?: string;
  /** How the Relationship it constrains reads, if it constrains one. */
  readonly constrains?: string;
}

export interface LanguageDoc extends Documented {
  readonly entities: readonly (Documented & { comparedBy?: string })[];
  readonly relationships: readonly RelationshipDoc[];
  readonly interactions: readonly InteractionDoc[];
  readonly axioms: readonly AxiomDoc[];
  /** The Domains that use it. */
  readonly usedBy: readonly string[];
}

export interface TransformationDoc extends Documented {
  readonly source: string;
  readonly target: string;
  readonly kind: "projection" | "mediation";
  /** `Monster ↦ Targetable, Attacker`, for every mapping. */
  readonly mappings: readonly string[];
  readonly deferred: readonly string[];
}

export interface DomainDoc extends Documented {
  readonly languages: readonly string[];
  readonly references: readonly string[];
  readonly transformations: readonly TransformationDoc[];
}

export interface MediationDoc extends Documented {
  readonly what: string;
  readonly how: string;
  readonly mediator: string;
}

export interface RuleDoc {
  readonly name: string;
  readonly severity: "error" | "warning";
  readonly about: string;
  /** The rule's documentation, as its script writes it. */
  readonly doc?: string;
  readonly script: string;
}

export interface Documentation {
  readonly system: Documented;
  readonly languages: readonly LanguageDoc[];
  readonly domains: readonly DomainDoc[];
  readonly mediations: readonly MediationDoc[];
  /** The rules of the profile the System is verified against, if it has been. */
  readonly rules: readonly RuleDoc[];
}

const name = (graph: Graph, id: string | undefined) => (id === undefined ? "?" : (nameOf(graph, id) ?? describeElement(graph, id)));
const first = (graph: Graph, id: string, end: string) => graph.navigate(id, end)[0];

/** A design's graph, with the Descriptions of what is in it. */
interface Described {
  readonly graph: Graph;
  readonly descriptions: ReadonlyMap<string, string>;
}

function documented({ graph, descriptions }: Described, id: string, label = name(graph, id)): Documented {
  const description = descriptions.get(id);
  return description === undefined ? { id, name: label } : { id, name: label, description };
}

/** How many, in words: `exactly one`, `at most one`, `any number of`, `one or more`, `2 to 5`. */
export function quantity(min: number, max: number | null): string {
  const word = (n: number) => (n === 1 ? "one" : String(n));
  if (max === null) return min === 0 ? "any number of" : `${word(min)} or more`;
  if (min === max) return `exactly ${word(min)}`;
  if (min === 0) return `at most ${word(max)}`;
  return `${word(min)} to ${word(max)}`;
}

/** An Entity's name for `max` of it: `Monster` for at most one, `Monsters` otherwise. */
export function counted(entity: string, max: number | null): string {
  if (max !== null && max <= 1) return entity;
  if (/(s|x|z|ch|sh)$/.test(entity)) return `${entity}es`;
  if (/[^aeiou]y$/.test(entity)) return `${entity.slice(0, -1)}ies`;
  return `${entity}s`;
}

/** `Each Player has any number of Monsters, as prey.` */
export function reading(from: string, by: string | null, to: string, min: number, max: number | null): string {
  const has = `Each ${from} has ${quantity(min, max)} ${counted(to, max)}`;
  return by === null ? `${has}, but cannot navigate to ${max === 1 ? "it" : "them"}.` : `${has}, as ${by}.`;
}

function navigations(graph: Graph, relationship: string): Navigation[] {
  const ends = graph.navigate(relationship, "ends");
  // Each end is reached from the other end's Entity; the second end is read first, as in `Player.prey ⟷ Monster.hunters`.
  return [...ends].reverse().map((end) => {
    const near = ends.find((e) => e !== end);
    const from = name(graph, near === undefined ? undefined : first(graph, near, "entity"));
    const to = name(graph, first(graph, end, "entity"));
    const by = nameOf(graph, end) ?? null;
    const min = boundOf(graph, end, "min") ?? 0;
    const max = boundOf(graph, end, "max") ?? null;
    return { end, from, by, to, min, max, reading: reading(from, by, to, min, max) };
  });
}

function relationshipLabel(navigations: readonly Navigation[]): string {
  return navigations.map((n) => `${n.from}.${n.by ?? "(unnamed)"}`).join(" ⟷ ");
}

function language(described: Described, id: string, system: string): LanguageDoc {
  const { graph } = described;
  const signature = (interaction: string) => {
    const params = parameters(graph, interaction).map((p) => `${name(graph, p)}: ${name(graph, first(graph, p, "type"))}`);
    return `${name(graph, interaction)}(${params.join(", ")}) → ${name(graph, first(graph, interaction, "output"))}`;
  };
  const relationships = graph.navigate(id, "relationships").map((r) => {
    const ways = navigations(graph, r);
    return { ...documented(described, r, relationshipLabel(ways)), navigations: ways };
  });
  return {
    ...documented(described, id),
    entities: graph.navigate(id, "entities").map((e) => {
      const comparison = first(graph, e, "comparison");
      return comparison === undefined ? documented(described, e) : { ...documented(described, e), comparedBy: name(graph, comparison) };
    }),
    relationships,
    interactions: graph.navigate(id, "interactions").map((i) => {
      const primary = first(graph, i, "primary");
      const doc = { ...documented(described, i), signature: signature(i) };
      return primary === undefined ? doc : { ...doc, action: name(graph, primary) };
    }),
    axioms: graph.navigate(id, "formulas").map((f) => {
      const constrains = first(graph, f, "constrains");
      const description = described.descriptions.get(f);
      return {
        id: f,
        text: String(graph.get(f).value ?? ""),
        ...(description === undefined ? {} : { description }),
        ...(constrains === undefined ? {} : { constrains: relationships.find((r) => r.id === constrains)?.name ?? name(graph, constrains) }),
      };
    }),
    usedBy: graph.navigate(system, "domains").filter((d) => graph.navigate(d, "languages").includes(id)).map((d) => name(graph, d)),
  };
}

function transformation(described: Described, id: string): TransformationDoc {
  const { graph } = described;
  const mappings = ["entityMappings", "relationshipMappings", "interactionMappings"].flatMap((end) =>
    graph.navigate(id, end).map((m) => `${name(graph, first(graph, m, "source"))} ↦ ${graph.navigate(m, "targets").map((t) => name(graph, t)).join(", ") || "nothing"}`),
  );
  const deferred = graph.navigate(id, "deferred").map((d) => name(graph, ["entity", "relationship", "interaction"].flatMap((end) => graph.navigate(d, end))[0]));
  return {
    ...documented(described, id),
    source: name(graph, first(graph, id, "source")),
    target: name(graph, first(graph, id, "target")),
    kind: graph.navigate(id, "reverse").length > 0 ? "mediation" : "projection",
    mappings,
    deferred,
  };
}

/** The Documentation of a system context, with the rules of the profile it is verified against, if any. */
export function document(context: SystemContext, profile?: Profile): Documentation {
  const graph = context.design;
  const [system] = graph.ofEntity("System");
  if (system === undefined) throw new Error("the design has no System");
  const described: Described = { graph, descriptions: descriptions(context) };
  return {
    system: documented(described, system),
    languages: graph.navigate(system, "languages").map((l) => language(described, l, system)),
    domains: graph.navigate(system, "domains").map((d) => ({
      ...documented(described, d),
      languages: graph.navigate(d, "languages").map((l) => name(graph, l)),
      references: graph.navigate(d, "references").map((r) => name(graph, r)),
      transformations: graph.navigate(d, "transformations").map((t) => transformation(described, t)),
    })),
    mediations: graph.navigate(system, "mediations").map((m) => {
      const [what, how, mediator] = ["what", "how", "mediator"].map((role) => name(graph, first(graph, m, role)));
      return { ...documented(described, m, `${what} / ${how}`), what: what!, how: how!, mediator: mediator! };
    }),
    rules: (profile?.rules ?? []).map((rule) => ({ name: rule.name, severity: rule.severity, about: rule.about, ...(rule.doc ? { doc: rule.doc } : {}), script: rule.script })),
  };
}

/** The Documentation as a Markdown document, to read anywhere Markdown is. */
export function documentationMarkdown(doc: Documentation): string {
  const out: string[] = [];
  const line = (...text: string[]) => out.push(...text);
  const prose = (description?: string) => description && line(description.trim(), "");
  /** A list item whose Description may run to several paragraphs: they continue under it. */
  const item = (head: string, description?: string) => {
    const [firstParagraph, ...rest] = (description?.trim() ?? "").split(/\n\s*\n/);
    line(firstParagraph ? `- ${head} — ${indent(firstParagraph)}` : `- ${head}`);
    for (const paragraph of rest) line("", `  ${indent(paragraph)}`);
  };
  const heading = (depth: number, text: string) => line(`${"#".repeat(depth)} ${text}`, "");
  const list = (label: string, values: readonly string[]) => line(`- ${label}: ${values.length ? values.join(", ") : "none"}`);

  heading(1, doc.system.name);
  prose(doc.system.description);
  const counts = [
    `${doc.languages.length} Language${doc.languages.length === 1 ? "" : "s"}`,
    `${doc.domains.length} Domain${doc.domains.length === 1 ? "" : "s"}`,
    `${doc.mediations.length} Mediation${doc.mediations.length === 1 ? "" : "s"}`,
  ];
  line(`This System has ${counts.join(", ")}.`, "");

  if (doc.languages.length) heading(2, "Languages");
  for (const language of doc.languages) {
    heading(3, language.name);
    prose(language.description);
    line(language.usedBy.length ? `Used by ${language.usedBy.join(", ")}.` : "No Domain uses it yet.", "");
    if (language.entities.length) {
      heading(4, "Entities");
      for (const entity of language.entities) item(`**${entity.name}**${entity.comparedBy ? ` (compared by \`${entity.comparedBy}\`)` : ""}`, entity.description);
      line("");
    }
    if (language.relationships.length) {
      heading(4, "Relationships");
      for (const relationship of language.relationships) {
        line(`**${relationship.name}**`, "");
        prose(relationship.description);
        for (const navigation of relationship.navigations) line(`- ${navigation.reading} \`${navigation.min}..${navigation.max ?? "N"}\``);
        line("");
      }
    }
    if (language.interactions.length) {
      heading(4, "Interactions");
      for (const interaction of language.interactions) {
        item(`\`${interaction.signature}\`${interaction.action ? ` (an Action on ${interaction.action})` : ""}`, interaction.description);
      }
      line("");
    }
    if (language.axioms.length) {
      heading(4, "Axioms");
      for (const axiom of language.axioms) item(`\`${axiom.text}\`${axiom.constrains ? ` (on ${axiom.constrains})` : ""}`, axiom.description);
      line("");
    }
  }

  if (doc.domains.length) heading(2, "Domains");
  for (const domain of doc.domains) {
    heading(3, domain.name);
    prose(domain.description);
    list("Uses", domain.languages);
    list("References", domain.references);
    line("");
    for (const t of domain.transformations) {
      heading(4, `${t.name} — a ${t.kind}, ${t.source} → ${t.target}`);
      prose(t.description);
      for (const mapping of t.mappings) line(`- ${mapping}`);
      for (const deferred of t.deferred) line(`- ${deferred}: deliberately left unmapped`);
      if (t.mappings.length || t.deferred.length) line("");
    }
  }

  if (doc.mediations.length) heading(2, "Mediations");
  for (const mediation of doc.mediations) {
    heading(3, mediation.name);
    line(`${mediation.what} is carried out over ${mediation.how}; only ${mediation.mediator} knows both.`, "");
    prose(mediation.description);
  }

  if (doc.rules.length) {
    heading(2, "Verification rules");
    for (const rule of doc.rules) {
      heading(3, `\`${rule.name}\` — ${rule.severity}${rule.script === "std" ? ", standard" : ""}`);
      prose(rule.doc || rule.about);
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

const indent = (text: string) => text.replace(/\n/g, "\n  ");
