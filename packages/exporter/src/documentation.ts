/**
 * Documentation: a design written up for the people who build on it and with it. Every
 * Component, nested as it is, with its Languages, Interactions, Transformations, Mediums and
 * Deployments, and the Description of each thing (from the Documentation tool context); and
 * the rules the design is verified against with their own documentation.
 * Unlike a Specification it is not a contract: it has no ids to cite and does not read back.
 * It says the same facts in prose — a Relationship as what each side has of the other.
 */
import { boundOf, describe as describeElement, identityTarget, mediationStack, nameOf, parameters, resolve, type Graph } from "@systemathic/core";
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
  /** `attack(by: Attacker): Damage, over Combat`; a Function without an output has none after it. */
  readonly signature: string;
}

export interface AxiomDoc {
  readonly id: string;
  readonly text: string;
  readonly description?: string;
}

export interface LanguageDoc extends Documented {
  /** The Languages it extends. */
  readonly extends: readonly string[];
  readonly entities: readonly (Documented & { extends: readonly string[] })[];
  readonly relationships: readonly RelationshipDoc[];
  readonly axioms: readonly AxiomDoc[];
  /** The Components that use it. */
  readonly usedBy: readonly string[];
}

export interface TransformationDoc extends Documented {
  /** `down(monster: CombatMonster): EntityId` */
  readonly signature: string;
  /** The Languages it goes from and to: its inputs', and its output's. */
  readonly source: string;
  readonly target: string;
}

export interface MediumDoc extends Documented {
  readonly language: string;
  readonly call: string;
}

export interface ConnectionDoc extends Documented {
  readonly from: string;
  readonly to: string;
  readonly what: readonly string[];
  /** The Mediums it passes over, from the top down, each with its realization if it has one. */
  readonly mediations: readonly string[];
}

export interface DeploymentDoc extends Documented {
  /** `server (Server)`, for every Instance; `clients (Client, 0..N)` when not exactly one occupies it. */
  readonly instances: readonly string[];
  readonly connections: readonly ConnectionDoc[];
}

export interface ComponentDoc extends Documented {
  readonly uses: readonly string[];
  /** Everything it exports, by name, with what kind of thing it is: `attack (Interaction)`. */
  readonly exports: readonly string[];
  /** Each Component it imports from, and the Exports it takes: `Server: attack (Interaction)`. */
  readonly imports: readonly string[];
  /** The boxes it implements: those it keeps a Deployment of, other than itself. */
  readonly implements: readonly string[];
  readonly languages: readonly LanguageDoc[];
  readonly interactions: readonly InteractionDoc[];
  readonly transformations: readonly TransformationDoc[];
  readonly mediums: readonly MediumDoc[];
  readonly deployments: readonly DeploymentDoc[];
  readonly components: readonly ComponentDoc[];
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
  /** The root first, then the packages beside it. */
  readonly components: readonly ComponentDoc[];
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

function language(described: Described, id: string): LanguageDoc {
  const { graph } = described;
  const relationships = graph.navigate(id, "relationships").map((r) => {
    const ways = navigations(graph, r);
    return { ...documented(described, r, relationshipLabel(ways)), navigations: ways };
  });
  return {
    ...documented(described, id),
    extends: graph.navigate(id, "extends").map((l) => name(graph, l)),
    entities: graph.navigate(id, "entities").map((e) => ({ ...documented(described, e), extends: graph.navigate(e, "extends").map((b) => name(graph, b)) })),
    relationships,
    axioms: graph.navigate(id, "formulas").map((f) => {
      const description = described.descriptions.get(f);
      return { id: f, text: String(graph.get(f).value ?? ""), ...(description === undefined ? {} : { description }) };
    }),
    usedBy: graph.navigate(id, "users").map((c) => name(graph, c)),
  };
}

/** A Function's signature: `attack(by: Attacker): Damage`. */
function signature(graph: Graph, id: string): string {
  const params = parameters(graph, id).map((p) => `${name(graph, p)}: ${name(graph, first(graph, p, "type"))}`);
  const output = first(graph, id, "output");
  return `${name(graph, id)}(${params.join(", ")})${output === undefined ? "" : `: ${name(graph, output)}`}`;
}

function interaction(described: Described, id: string): InteractionDoc {
  const { graph } = described;
  return { ...documented(described, id), signature: `${signature(graph, id)}, over ${name(graph, first(graph, id, "language"))}` };
}

function transformation(described: Described, id: string): TransformationDoc {
  const { graph } = described;
  const [input] = parameters(graph, id);
  const type = input === undefined ? undefined : first(graph, input, "type");
  const output = first(graph, id, "output");
  return {
    ...documented(described, id),
    signature: signature(graph, id),
    source: name(graph, type === undefined ? undefined : first(graph, type, "language")),
    target: name(graph, output === undefined ? undefined : first(graph, output, "language")),
  };
}

function deployment(described: Described, id: string): DeploymentDoc {
  const { graph } = described;
  return {
    ...documented(described, id),
    instances: graph.navigate(id, "instances").map((i) => {
      const min = boundOf(graph, i, "min") ?? 1;
      const max = boundOf(graph, i, "max") ?? null;
      const range = min === 1 && max === 1 ? "" : `, ${min}..${max ?? "N"}`;
      return `${name(graph, i)} (${name(graph, first(graph, i, "of"))}${range})`;
    }),
    connections: graph.navigate(id, "connections").map((c) => {
      const from = name(graph, first(graph, c, "from"));
      const identity = first(graph, c, "toIdentity");
      const to = name(graph, first(graph, c, "to") ?? first(graph, c, "toComponent") ?? (identity === undefined ? undefined : identityTarget(graph, identity)));
      const what = graph.navigate(c, "what").map((i) => name(graph, i));
      const mediations = mediationStack(graph, c).map((m) => {
        const down = first(graph, m, "down");
        const up = first(graph, m, "up");
        const realized = down === undefined && up === undefined ? "" : `, down by ${name(graph, down)} and up by ${name(graph, up)}`;
        return `${name(graph, first(graph, m, "how"))}${realized}`;
      });
      return { ...documented(described, c, `${from} → ${to}`), from, to, what, mediations };
    }),
  };
}

/** An Export, by what it resolves to: `attack (Interaction)`. */
function exported(graph: Graph, id: string): string {
  const target = resolve(graph, id);
  return target === undefined ? "nothing" : `${name(graph, target)} (${graph.get(target).entity})`;
}

function component(described: Described, id: string): ComponentDoc {
  const { graph } = described;
  return {
    ...documented(described, id),
    uses: graph.navigate(id, "uses").map((l) => name(graph, l)),
    exports: graph.navigate(id, "exports").map((e) => exported(graph, e)),
    imports: graph.navigate(id, "imports").map((m) => {
      const taken = graph.navigate(m, "exports").map((e) => exported(graph, e));
      return `${name(graph, graph.navigate(m, "from")[0])}${taken.length > 0 ? `: ${taken.join(", ")}` : ""}`;
    }),
    implements: graph
      .navigate(id, "kept")
      .map((d) => graph.navigate(d, "component")[0])
      .filter((box): box is string => box !== undefined && box !== id)
      .map((box) => name(graph, box)),
    languages: graph.navigate(id, "languages").map((l) => language(described, l)),
    interactions: graph.navigate(id, "interactions").map((i) => interaction(described, i)),
    transformations: graph.navigate(id, "transformations").map((t) => transformation(described, t)),
    mediums: graph.navigate(id, "mediums").map((m) => ({ ...documented(described, m), language: name(graph, first(graph, m, "language")), call: name(graph, first(graph, m, "call")) })),
    deployments: graph.navigate(id, "kept").map((d) => deployment(described, d)),
    components: graph.navigate(id, "components").map((c) => component(described, c)),
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
    components: [...graph.navigate(system, "root"), ...graph.navigate(system, "packages")].map((c) => component(described, c)),
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
  const heading = (depth: number, text: string) => line(`${"#".repeat(Math.min(depth, 6))} ${text}`, "");
  const list = (label: string, values: readonly string[]) => line(`- ${label}: ${values.length ? values.join(", ") : "none"}`);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  const languageSection = (language: LanguageDoc, depth: number) => {
    heading(depth, language.extends.length ? `${language.name} — extends ${language.extends.join(", ")}` : `${language.name} — a core Language`);
    prose(language.description);
    line(language.usedBy.length ? `Used by ${language.usedBy.join(", ")}.` : "No Component uses it yet.", "");
    if (language.entities.length) {
      for (const entity of language.entities) {
        const extended = entity.extends.length ? ` : ${entity.extends.join(", ")}` : "";
        item(`**${entity.name}**${extended}`, entity.description);
      }
      line("");
    }
    for (const relationship of language.relationships) {
      line(`**${relationship.name}**`, "");
      prose(relationship.description);
      for (const navigation of relationship.navigations) line(`- ${navigation.reading} \`${navigation.min}..${navigation.max ?? "N"}\``);
      line("");
    }
    if (language.axioms.length) {
      for (const axiom of language.axioms) item(`Axiom \`${axiom.text}\``, axiom.description);
      line("");
    }
  };

  const componentSection = (component: ComponentDoc, depth: number) => {
    heading(depth, component.name);
    prose(component.description);
    list("Uses", component.uses);
    list("Exports", component.exports);
    list("Imports", component.imports);
    if (component.implements.length) list("Implements", component.implements);
    line("");
    for (const language of component.languages) languageSection(language, depth + 1);
    if (component.interactions.length) {
      heading(depth + 1, "Interactions");
      for (const interaction of component.interactions) item(`\`${interaction.signature}\``, interaction.description);
      line("");
    }
    if (component.transformations.length) {
      heading(depth + 1, "Transformations");
      for (const t of component.transformations) item(`\`${t.signature}\`, ${t.source} → ${t.target}`, t.description);
      line("");
    }
    if (component.mediums.length) {
      heading(depth + 1, "Mediums");
      for (const medium of component.mediums) item(`**${medium.name}**: over ${medium.language}, through \`${medium.call}\``, medium.description);
      line("");
    }
    for (const deployment of component.deployments) {
      heading(depth + 1, `Deployment ${deployment.name}`);
      prose(deployment.description);
      list("Places", deployment.instances);
      for (const connection of deployment.connections) {
        const how = connection.mediations.length ? `over ${connection.mediations.join(", then ")}` : "how it passes is left to the implementation";
        item(`${connection.from} uses ${connection.what.join(", ")} of ${connection.to}, ${how}`, connection.description);
      }
      line("");
    }
    for (const child of component.components) componentSection(child, depth + 1);
  };

  heading(1, doc.system.name);
  prose(doc.system.description);
  const [root, ...packages] = doc.components;
  const count = (c: ComponentDoc): number => 1 + c.components.reduce((sum, child) => sum + count(child), 0);
  line(
    `This System has ${plural(root === undefined ? 0 : count(root), "Component")}, and ${plural(packages.length, "package")} beside its root.`,
    "",
  );
  if (root !== undefined) componentSection(root, 2);
  if (packages.length) {
    heading(2, "Packages");
    for (const component of packages) componentSection(component, 3);
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
