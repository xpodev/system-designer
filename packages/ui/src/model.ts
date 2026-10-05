/**
 * The System as the UI reads it: the System file (docs/format.md), indexed. The editors show
 * it; they change it only through the editors' operations on the host, and read it again.
 */

/** An end; `name` is null when it is unnamed, and cannot be navigated to. */
export interface EndJson { id: string; name: string | null; entity: string; min: number; max: number | "N" }
export interface RelationshipJson { id: string; ends: EndJson[] }
export interface FormulaJson { id: string; text: string; constrains?: string }
export interface EntityJson { id: string; name: string }
export interface ParameterJson { id: string; name: string; type: string }
export interface InteractionJson { id: string; name: string; parameters: ParameterJson[]; output: string; primary: string | null; compares: string[] }
export interface LanguageJson {
  id: string;
  name: string;
  entities: EntityJson[];
  relationships: RelationshipJson[];
  formulas: FormulaJson[];
  interactions: InteractionJson[];
}
export interface MappingJson { source: string; targets: string[] }
export interface DeferredJson { entity?: string; relationship?: string; interaction?: string }
export interface TransformationJson {
  id: string;
  name: string;
  source: string;
  target: string;
  reverse: { context: string[] } | null;
  entityMappings: MappingJson[];
  relationshipMappings: MappingJson[];
  interactionMappings: MappingJson[];
  deferred: DeferredJson[];
}
export interface DomainJson { id: string; name: string; languages: string[]; references: string[]; transformations: TransformationJson[] }
export interface MediationJson { id: string; what: string; how: string; mediator: string }
export interface SystemFile {
  format: string;
  design: { id: string; name: string; languages: LanguageJson[]; domains: DomainJson[]; mediations: MediationJson[] };
  attachments: { owner: string; data: unknown }[];
}

/** What an id is, and where it sits. */
export type Located =
  | { kind: "System" }
  | { kind: "Language"; language: LanguageJson }
  | { kind: "Entity"; entity: EntityJson; language: LanguageJson }
  | { kind: "Relationship"; relationship: RelationshipJson; language: LanguageJson }
  | { kind: "End"; end: EndJson; relationship: RelationshipJson; language: LanguageJson }
  | { kind: "Formula"; formula: FormulaJson; language: LanguageJson }
  | { kind: "Interaction"; interaction: InteractionJson; language: LanguageJson }
  | { kind: "Parameter"; parameter: ParameterJson; interaction: InteractionJson; language: LanguageJson }
  | { kind: "Domain"; domain: DomainJson }
  | { kind: "Transformation"; transformation: TransformationJson; domain: DomainJson }
  | { kind: "Mediation"; mediation: MediationJson };

export type Kind = Located["kind"];

export class Model {
  readonly byId = new Map<string, Located>();
  private readonly descriptions = new Map<string, string>();

  constructor(readonly file: SystemFile) {
    const d = file.design;
    this.byId.set(d.id, { kind: "System" });
    for (const language of d.languages) {
      this.byId.set(language.id, { kind: "Language", language });
      for (const entity of language.entities) this.byId.set(entity.id, { kind: "Entity", entity, language });
      for (const relationship of language.relationships) {
        this.byId.set(relationship.id, { kind: "Relationship", relationship, language });
        for (const end of relationship.ends) this.byId.set(end.id, { kind: "End", end, relationship, language });
      }
      for (const formula of language.formulas) this.byId.set(formula.id, { kind: "Formula", formula, language });
      for (const interaction of language.interactions) {
        this.byId.set(interaction.id, { kind: "Interaction", interaction, language });
        for (const parameter of interaction.parameters) this.byId.set(parameter.id, { kind: "Parameter", parameter, interaction, language });
      }
    }
    for (const domain of d.domains) {
      this.byId.set(domain.id, { kind: "Domain", domain });
      for (const transformation of domain.transformations) this.byId.set(transformation.id, { kind: "Transformation", transformation, domain });
    }
    for (const mediation of d.mediations) this.byId.set(mediation.id, { kind: "Mediation", mediation });
    const documentation = file.attachments.find((a) => a.owner === "documentation")?.data as { descriptions?: Record<string, unknown> } | undefined;
    for (const [id, text] of Object.entries(documentation?.descriptions ?? {})) if (typeof text === "string" && this.byId.has(id)) this.descriptions.set(id, text);
  }

  get system() {
    return this.file.design;
  }
  get languages() {
    return this.file.design.languages;
  }
  get domains() {
    return this.file.design.domains;
  }
  get mediations() {
    return this.file.design.mediations;
  }

  get(id: string): Located | undefined {
    return this.byId.get(id);
  }

  kind(id: string): Kind | undefined {
    return this.byId.get(id)?.kind;
  }

  /** What something is for, in prose, if it is described: the Documentation's, kept in its attachment. */
  description(id: string): string | undefined {
    return this.descriptions.get(id);
  }

  /** A short name for anything: its name, or how it reads. */
  name(id: string | undefined): string {
    if (id === undefined) return "?";
    const at = this.byId.get(id);
    if (!at) return id;
    switch (at.kind) {
      case "System":
        return this.system.name;
      case "Language":
        return at.language.name;
      case "Entity":
        return at.entity.name;
      case "Relationship":
        return relationshipLabel(at.relationship, (entity) => this.name(entity));
      case "End":
        return navigationLabel(at.relationship, at.end, (entity) => this.name(entity));
      case "Formula":
        return at.formula.text;
      case "Interaction":
        return at.interaction.name;
      case "Parameter":
        return at.parameter.name;
      case "Domain":
        return at.domain.name;
      case "Transformation":
        return at.transformation.name;
      case "Mediation":
        return `${this.name(at.mediation.what)} / ${this.name(at.mediation.how)}`;
    }
  }

  /** `langs*(D)`: a Domain's own Languages and those of every Domain it references, each with the Domain it comes through. */
  scope(domain: string): Map<string, string> {
    const found = new Map<string, string>();
    const seen = new Set<string>();
    const pending = [domain];
    while (pending.length > 0) {
      const current = pending.shift()!;
      if (seen.has(current)) continue;
      seen.add(current);
      const at = this.byId.get(current);
      if (at?.kind !== "Domain") continue;
      for (const language of at.domain.languages) if (!found.has(language)) found.set(language, current);
      pending.push(...at.domain.references);
    }
    return found;
  }

  /** The Mediations a Domain takes part in, and how. */
  rolesOf(domain: string): { mediation: MediationJson; role: "what" | "how" | "mediator" }[] {
    return this.mediations.flatMap((mediation) =>
      (["what", "how", "mediator"] as const).filter((role) => mediation[role] === domain).map((role) => ({ mediation, role })),
    );
  }

  /** The mediator's reversible Transformations from the what's Languages to the how's. */
  witnesses(mediation: MediationJson): TransformationJson[] {
    const mediator = this.byId.get(mediation.mediator);
    if (mediator?.kind !== "Domain") return [];
    const whats = this.scope(mediation.what);
    const hows = this.scope(mediation.how);
    return mediator.domain.transformations.filter((t) => t.reverse !== null && whats.has(t.source) && hows.has(t.target));
  }

  /** Where an Entity is used: ends, Parameters, outputs, mappings. */
  usesOf(entity: string): number {
    let count = 0;
    for (const language of this.languages) {
      for (const r of language.relationships) count += r.ends.filter((end) => end.entity === entity).length;
      for (const i of language.interactions) count += i.parameters.filter((p) => p.type === entity).length + (i.output === entity ? 1 : 0);
    }
    for (const domain of this.domains)
      for (const t of domain.transformations) count += t.entityMappings.filter((m) => m.source === entity || m.targets.includes(entity)).length;
    return count;
  }

  /** The editor tab an id is edited in, and the id to bring into view there. */
  home(id: string): { tab: Tab; focus?: string } | undefined {
    const at = this.byId.get(id);
    if (!at) return undefined;
    switch (at.kind) {
      case "System":
        return { tab: { kind: "system" } };
      case "Language":
        return { tab: { kind: "language", id } };
      case "Entity":
      case "Relationship":
      case "End":
      case "Formula":
      case "Interaction":
      case "Parameter":
        return { tab: { kind: "language", id: at.language.id }, focus: at.kind === "End" ? at.relationship.id : at.kind === "Parameter" ? at.interaction.id : id };
      case "Domain":
        return { tab: { kind: "domain", id } };
      case "Transformation":
        return { tab: { kind: "transformation", id } };
      case "Mediation":
        return { tab: { kind: "mediation", id } };
    }
  }
}

export type Tab =
  | { kind: "system" }
  | { kind: "language"; id: string }
  | { kind: "domain"; id: string }
  | { kind: "transformation"; id: string }
  | { kind: "mediation"; id: string }
  | { kind: "view"; perspective: string }
  | { kind: "specification" }
  | { kind: "documentation" }
  | { kind: "script" };

export const tabKey = (tab: Tab): string => ("id" in tab ? `${tab.kind}:${tab.id}` : tab.kind === "view" ? `view:${tab.perspective}` : tab.kind);

/** How an unnamed end reads where its name would be. */
export const UNNAMED = "(unnamed)";

/** The end across the Relationship from `end`. */
export const otherEnd = (relationship: RelationshipJson, end: EndJson): EndJson | undefined => relationship.ends.find((e) => e !== end);

/**
 * The navigation that reaches `end`: `From.name`, where From is the other end's Entity. An end
 * is named from the other side — from a Player, `prey` reaches Monsters.
 */
export function navigationLabel(relationship: RelationshipJson, end: EndJson, name: (entity: string) => string): string {
  const from = otherEnd(relationship, end);
  return `${from ? name(from.entity) : "?"}.${end.name ?? UNNAMED}`;
}

/** Both ways through a Relationship: `Player.prey ⟷ Monster.hunters`. */
export function relationshipLabel(relationship: RelationshipJson, name: (entity: string) => string): string {
  return [...relationship.ends]
    .reverse()
    .map((end) => navigationLabel(relationship, end, name))
    .join(" ⟷ ");
}

export const ranges = ["1..1", "0..1", "1..N", "0..N"] as const;

/** What the Documentation can describe: the System and the things in it, but not an end or a Parameter. */
export const DESCRIBABLE: ReadonlySet<Kind> = new Set<Kind>(["System", "Language", "Entity", "Relationship", "Formula", "Interaction", "Domain", "Transformation", "Mediation"]);

/** How many, in words: `exactly one`, `at most one`, `any number of`, `one or more`, `2 to 5`. */
export function quantity(min: number, max: number | "N"): string {
  const word = (n: number) => (n === 1 ? "one" : String(n));
  if (max === "N") return min === 0 ? "any number of" : `${word(min)} or more`;
  if (min === max) return `exactly ${word(min)}`;
  if (min === 0) return `at most ${word(max)}`;
  return `${word(min)} to ${word(max)}`;
}

/** An Entity's name for at most `max` of it: `Monster` for at most one, `Monsters` otherwise. */
export function counted(entity: string, max: number | "N"): string {
  if (max !== "N" && max <= 1) return entity;
  if (/(s|x|z|ch|sh)$/.test(entity)) return `${entity}es`;
  if (/[^aeiou]y$/.test(entity)) return `${entity.slice(0, -1)}ies`;
  return `${entity}s`;
}
export const rangeOf = (end: EndJson) => `${end.min}..${end.max}`;
