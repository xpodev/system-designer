/**
 * The System as the UI reads it: the System file (docs/format.md), indexed. The editors show
 * it; they change it only through the editors' operations on the host, and read it again.
 */

/** An end; `name` is null when it is unnamed, and cannot be navigated to. */
export interface EndJson { id: string; name: string | null; entity: string; min: number; max: number | "N" }
export interface RelationshipJson { id: string; ends: EndJson[] }
export interface FormulaJson { id: string; text: string; constrains?: string }
export interface EntityJson { id: string; name: string; extends: string[] }
export interface LanguageJson { id: string; name: string; extends: string[]; entities: EntityJson[]; relationships: RelationshipJson[]; formulas: FormulaJson[] }
export interface ParameterJson { id: string; name: string; type: string }
export interface InteractionJson { id: string; name: string; language: string; parameters: ParameterJson[]; output: string; primary: string | null; compares: string[] }
export interface MappingJson { source: string; targets: string[] }
export interface DeferredJson { entity?: string; relationship?: string }
export interface TransformationJson {
  id: string;
  name: string;
  source: string;
  target: string;
  context: string[];
  entityMappings: MappingJson[];
  relationshipMappings: MappingJson[];
  deferred: DeferredJson[];
}
export interface MediumJson { id: string; name: string; language: string; call: string }
export interface MediationJson { id: string; how: string; down: string | null; up: string | null }
export interface ConnectionJson { id: string; from: string; toInstance: string | null; toComponent: string | null; what: string[]; mediations: MediationJson[] }
export interface InstanceJson { id: string; name: string; of: string }
export interface DeploymentJson { id: string; name: string; instances: InstanceJson[]; connections: ConnectionJson[] }
export interface ImportsJson { components: string[]; transformations: string[]; interactions: string[]; mediums: string[] }
export interface ComponentJson {
  id: string;
  name: string;
  uses: string[];
  imports: ImportsJson;
  languages: LanguageJson[];
  transformations: TransformationJson[];
  interactions: InteractionJson[];
  mediums: MediumJson[];
  deployments: DeploymentJson[];
  components: ComponentJson[];
}
export interface ChoiceJson { id: string; instance: string | null; deployment: string; choices: ChoiceJson[] }
export interface ConfigurationJson { id: string; name: string; root: ChoiceJson }
export interface SystemFile {
  format: string;
  design: { id: string; name: string; root: string; components: ComponentJson[]; configurations: ConfigurationJson[] };
  attachments: { owner: string; data: unknown }[];
}

/** What an id is, and where it sits: the Component it is in, and what holds it there. */
export type Located =
  | { kind: "System" }
  | { kind: "Component"; component: ComponentJson; parent?: ComponentJson }
  | { kind: "Language"; language: LanguageJson; component: ComponentJson }
  | { kind: "Entity"; entity: EntityJson; language: LanguageJson; component: ComponentJson }
  | { kind: "Relationship"; relationship: RelationshipJson; language: LanguageJson; component: ComponentJson }
  | { kind: "End"; end: EndJson; relationship: RelationshipJson; language: LanguageJson; component: ComponentJson }
  | { kind: "Formula"; formula: FormulaJson; language: LanguageJson; component: ComponentJson }
  | { kind: "Interaction"; interaction: InteractionJson; component: ComponentJson }
  | { kind: "Parameter"; parameter: ParameterJson; interaction: InteractionJson; component: ComponentJson }
  | { kind: "Transformation"; transformation: TransformationJson; component: ComponentJson }
  | { kind: "Medium"; medium: MediumJson; component: ComponentJson }
  | { kind: "Deployment"; deployment: DeploymentJson; component: ComponentJson }
  | { kind: "Instance"; instance: InstanceJson; deployment: DeploymentJson; component: ComponentJson }
  | { kind: "Connection"; connection: ConnectionJson; deployment: DeploymentJson; component: ComponentJson }
  | { kind: "Configuration"; configuration: ConfigurationJson };

export type Kind = Located["kind"];

/** The kinds of thing a Component imports, by the key of its `imports`. */
export type ImportKind = keyof ImportsJson;

export class Model {
  readonly byId = new Map<string, Located>();
  private readonly descriptions = new Map<string, string>();

  constructor(readonly file: SystemFile) {
    const d = file.design;
    this.byId.set(d.id, { kind: "System" });
    const index = (component: ComponentJson, parent?: ComponentJson) => {
      this.byId.set(component.id, parent ? { kind: "Component", component, parent } : { kind: "Component", component });
      for (const language of component.languages) {
        this.byId.set(language.id, { kind: "Language", language, component });
        for (const entity of language.entities) this.byId.set(entity.id, { kind: "Entity", entity, language, component });
        for (const relationship of language.relationships) {
          this.byId.set(relationship.id, { kind: "Relationship", relationship, language, component });
          for (const end of relationship.ends) this.byId.set(end.id, { kind: "End", end, relationship, language, component });
        }
        for (const formula of language.formulas) this.byId.set(formula.id, { kind: "Formula", formula, language, component });
      }
      for (const interaction of component.interactions) {
        this.byId.set(interaction.id, { kind: "Interaction", interaction, component });
        for (const parameter of interaction.parameters) this.byId.set(parameter.id, { kind: "Parameter", parameter, interaction, component });
      }
      for (const transformation of component.transformations) this.byId.set(transformation.id, { kind: "Transformation", transformation, component });
      for (const medium of component.mediums) this.byId.set(medium.id, { kind: "Medium", medium, component });
      for (const deployment of component.deployments) {
        this.byId.set(deployment.id, { kind: "Deployment", deployment, component });
        for (const instance of deployment.instances) this.byId.set(instance.id, { kind: "Instance", instance, deployment, component });
        for (const connection of deployment.connections) this.byId.set(connection.id, { kind: "Connection", connection, deployment, component });
      }
      for (const child of component.components) index(child, component);
    };
    for (const component of d.components) index(component);
    for (const configuration of d.configurations) this.byId.set(configuration.id, { kind: "Configuration", configuration });
    const documentation = file.attachments.find((a) => a.owner === "documentation")?.data as { descriptions?: Record<string, unknown> } | undefined;
    for (const [id, text] of Object.entries(documentation?.descriptions ?? {})) if (typeof text === "string" && this.byId.has(id)) this.descriptions.set(id, text);
  }

  get system() {
    return this.file.design;
  }
  /** The root Component. */
  get root(): ComponentJson | undefined {
    return this.component(this.file.design.root);
  }
  /** The packages beside the root. */
  get packages(): ComponentJson[] {
    return this.file.design.components.filter((c) => c.id !== this.file.design.root);
  }
  get configurations() {
    return this.file.design.configurations;
  }
  /** Every Component, outermost first. */
  get components(): ComponentJson[] {
    return [...this.byId.values()].flatMap((at) => (at.kind === "Component" ? [at.component] : []));
  }
  /** Every Language, of every Component. */
  get languages(): LanguageJson[] {
    return [...this.byId.values()].flatMap((at) => (at.kind === "Language" ? [at.language] : []));
  }

  get(id: string): Located | undefined {
    return this.byId.get(id);
  }

  kind(id: string): Kind | undefined {
    return this.byId.get(id)?.kind;
  }

  component(id: string | undefined): ComponentJson | undefined {
    const at = id === undefined ? undefined : this.byId.get(id);
    return at?.kind === "Component" ? at.component : undefined;
  }

  language(id: string | undefined): LanguageJson | undefined {
    const at = id === undefined ? undefined : this.byId.get(id);
    return at?.kind === "Language" ? at.language : undefined;
  }

  interaction(id: string | undefined): InteractionJson | undefined {
    const at = id === undefined ? undefined : this.byId.get(id);
    return at?.kind === "Interaction" ? at.interaction : undefined;
  }

  /** The Component something is in — or the Component itself. */
  componentOf(id: string): ComponentJson | undefined {
    const at = this.byId.get(id);
    if (!at || at.kind === "System" || at.kind === "Configuration") return undefined;
    return at.component;
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
      case "Component":
        return at.component.name;
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
      case "Transformation":
        return at.transformation.name;
      case "Medium":
        return at.medium.name;
      case "Deployment":
        return at.deployment.name;
      case "Instance":
        return at.instance.name;
      case "Connection": {
        const to = at.connection.toInstance ?? at.connection.toComponent ?? undefined;
        return `${this.name(at.connection.from)} → ${this.name(to)}`;
      }
      case "Configuration":
        return at.configuration.name;
    }
  }

  /** `C.*parent`: a Component and every Component it is nested in, nearest first. */
  ancestry(component: string): ComponentJson[] {
    const found: ComponentJson[] = [];
    let at = this.byId.get(component);
    while (at?.kind === "Component" && !found.includes(at.component)) {
      found.push(at.component);
      at = at.parent ? this.byId.get(at.parent.id) : undefined;
    }
    return found;
  }

  /** The Components beside one: its parent's other children, or the System's other top-level Components. */
  siblings(component: string): ComponentJson[] {
    const at = this.byId.get(component);
    if (at?.kind !== "Component") return [];
    return (at.parent ? at.parent.components : this.file.design.components).filter((c) => c.id !== component);
  }

  /** `L.*extends`: a Language and every Language it extends, nearest first. */
  vocab(language: string): LanguageJson[] {
    const found: LanguageJson[] = [];
    const pending = [language];
    while (pending.length > 0) {
      const l = this.language(pending.shift());
      if (!l || found.includes(l)) continue;
      found.push(l);
      pending.push(...l.extends);
    }
    return found;
  }

  /** The Entities of a Language's vocabulary: its own, and those of every Language it extends. */
  vocabEntities(language: string): EntityJson[] {
    return this.vocab(language).flatMap((l) => l.entities);
  }

  /**
   * The Languages a Component may use: its own and its parents', and those of the Components it
   * imports — each with the Component that brings it in.
   */
  scope(component: string): Map<string, ComponentJson> {
    const found = new Map<string, ComponentJson>();
    const c = this.component(component);
    for (const owner of [...this.ancestry(component), ...(c?.imports.components ?? []).flatMap((id) => this.component(id) ?? [])]) {
      for (const language of owner.languages) if (!found.has(language.id)) found.set(language.id, owner);
    }
    return found;
  }

  /** What a Component offers of a kind. */
  private offered(component: ComponentJson, kind: ImportKind): string[] {
    if (kind === "components") return [component.id];
    if (kind === "interactions") return component.interactions.map((i) => i.id);
    if (kind === "transformations") return component.transformations.map((t) => t.id);
    return component.mediums.map((m) => m.id);
  }

  /** What a Component may import of a kind: its siblings', what its parents import, and what the Components those import offer. */
  importable(component: string, kind: ImportKind): string[] {
    const found = new Set<string>();
    for (const sibling of this.siblings(component)) for (const id of this.offered(sibling, kind)) found.add(id);
    for (const ancestor of this.ancestry(component).slice(1)) {
      for (const id of ancestor.imports[kind]) found.add(id);
      if (kind !== "components") for (const imported of ancestor.imports.components) for (const id of this.offered(this.component(imported) ?? emptyComponent, kind)) found.add(id);
    }
    const own = this.component(component);
    if (kind !== "components" && own) for (const imported of own.imports.components) for (const id of this.offered(this.component(imported) ?? emptyComponent, kind)) found.add(id);
    return [...found].filter((id) => this.byId.has(id) && !(kind === "components" && id === component));
  }

  /** What a Component has access to of a kind: its own and its parents', what it imports, and what the Components it imports offer. */
  access(component: string, kind: Exclude<ImportKind, "components">): string[] {
    const found = new Set<string>();
    for (const owner of this.ancestry(component)) for (const id of this.offered(owner, kind)) found.add(id);
    const own = this.component(component);
    if (own) {
      for (const id of own.imports[kind]) found.add(id);
      for (const imported of own.imports.components) for (const id of this.offered(this.component(imported) ?? emptyComponent, kind)) found.add(id);
    }
    return [...found].filter((id) => this.byId.has(id));
  }

  /** The Components using a Language. */
  usersOf(language: string): ComponentJson[] {
    return this.components.filter((c) => c.uses.includes(language));
  }

  /** The Interactions over a Language, of any Component. */
  interactionsOver(language: string): InteractionJson[] {
    return this.components.flatMap((c) => c.interactions.filter((i) => i.language === language));
  }

  /** Where an Entity is used: ends, extensions, Parameters, outputs, mappings. */
  usesOf(entity: string): number {
    let count = 0;
    for (const language of this.languages) {
      for (const r of language.relationships) count += r.ends.filter((end) => end.entity === entity).length;
      count += language.entities.filter((e) => e.extends.includes(entity)).length;
    }
    for (const component of this.components) {
      for (const i of component.interactions) count += i.parameters.filter((p) => p.type === entity).length + (i.output === entity ? 1 : 0);
      for (const t of component.transformations) count += t.entityMappings.filter((m) => m.source === entity || m.targets.includes(entity)).length;
    }
    return count;
  }

  /** The editor tab an id is edited in, and the id to bring into view there. */
  home(id: string): { tab: Tab; focus?: string } | undefined {
    const at = this.byId.get(id);
    if (!at) return undefined;
    switch (at.kind) {
      case "System":
        return { tab: { kind: "system" } };
      case "Component":
        return { tab: { kind: "component", id } };
      case "Language":
        return { tab: { kind: "language", id } };
      case "Entity":
      case "Relationship":
      case "End":
      case "Formula":
        return { tab: { kind: "language", id: at.language.id }, focus: at.kind === "End" ? at.relationship.id : id };
      case "Interaction":
      case "Parameter":
      case "Medium":
        return { tab: { kind: "component", id: at.component.id }, focus: at.kind === "Parameter" ? at.interaction.id : id };
      case "Transformation":
        return { tab: { kind: "transformation", id } };
      case "Deployment":
        return { tab: { kind: "deployment", id } };
      case "Instance":
      case "Connection":
        return { tab: { kind: "deployment", id: at.deployment.id }, focus: id };
      case "Configuration":
        return { tab: { kind: "configuration", id } };
    }
  }
}

const emptyComponent: ComponentJson = {
  id: "",
  name: "",
  uses: [],
  imports: { components: [], transformations: [], interactions: [], mediums: [] },
  languages: [],
  transformations: [],
  interactions: [],
  mediums: [],
  deployments: [],
  components: [],
};

export type Tab =
  | { kind: "system" }
  | { kind: "component"; id: string }
  | { kind: "language"; id: string }
  | { kind: "transformation"; id: string }
  | { kind: "deployment"; id: string }
  | { kind: "configuration"; id: string }
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

/** What the Documentation can describe: the System and the things in it, but not an end, a Parameter or a choice. */
export const DESCRIBABLE: ReadonlySet<Kind> = new Set<Kind>([
  "System",
  "Component",
  "Language",
  "Entity",
  "Relationship",
  "Formula",
  "Interaction",
  "Transformation",
  "Medium",
  "Deployment",
  "Instance",
  "Connection",
  "Configuration",
]);

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
