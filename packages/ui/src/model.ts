/**
 * The System as the UI reads it: the System file (docs/format.md), indexed. The editors show
 * it; they change it only through the editors' operations on the host, and read it again.
 */

/** An end; `name` is null when it is unnamed, and cannot be navigated to. */
export interface EndJson { id: string; name: string | null; entity: string; min: number; max: number | "N" }
export interface RelationshipJson { id: string; ends: EndJson[] }
export interface FormulaJson { id: string; text: string }
export interface EntityJson { id: string; name: string; extends: string[] }
export interface LanguageJson { id: string; name: string; extends: string[]; entities: EntityJson[]; relationships: RelationshipJson[]; formulas: FormulaJson[] }
export interface ParameterJson { id: string; name: string; type: string }
/** A signature: Parameters in order, and an output, or none. */
export interface FunctionJson { id: string; name: string; parameters: ParameterJson[]; output: string | null }
export interface InteractionJson extends FunctionJson { language: string }
export type TransformationJson = FunctionJson;
export interface MediumJson { id: string; name: string; language: string; call: string }
export interface MediationJson { id: string; how: string; down: string | null; up: string | null }
export interface ConnectionJson {
  id: string;
  from: string;
  to: string | null;
  toComponent: string | null;
  /** An identity the Deployment imports, the Connection goes to. */
  toIdentity: string | null;
  what: string[];
  mediations: MediationJson[];
}
/** A placement: of a box, with a range, and the Deployment it runs, if the design fixes it. */
export interface InstanceJson { id: string; name: string; of: string; runs: string | null; min: number; max: number | "N" }
/** A Deployment: the layout of a box, `of`, kept in the Component that holds it; its needs, and what it exposes. */
export interface DeploymentJson {
  id: string;
  name: string;
  of: string;
  instances: InstanceJson[];
  connections: ConnectionJson[];
  imports: ImportJson[];
  exposes: { id: string; instance: string }[];
}
/** An Export: what it exports, under one key — `interaction`, `component`, … */
export type ExportJson = { id: string } & Partial<Record<ExportKey, string>>;
/**
 * An Import: the Component it is from, and the Exports it takes; or, for a Deployment, an
 * identity: a `path` of placements from the root, with no Component and nothing taken.
 */
export interface ImportJson { id: string; from: string; exports: string[]; path?: string[] }
export interface ComponentJson {
  id: string;
  name: string;
  uses: string[];
  exports: ExportJson[];
  imports: ImportJson[];
  languages: LanguageJson[];
  interactions: InteractionJson[];
  transformations: TransformationJson[];
  mediums: MediumJson[];
  deployments: DeploymentJson[];
  components: ComponentJson[];
}
/** One occupant's Choice in a Configuration: the Deployment of its box it runs, or none, and the Choices below. */
export interface ChoiceJson { id: string; instance: string | null; deployment: string | null; choices: ChoiceJson[] }
/** A Configuration, kept by the tool in the System's `configurations` attachment. */
export interface ConfigurationJson { id: string; name: string; rules: string[]; root: ChoiceJson }
export interface SystemFile {
  format: string;
  design: { id: string; name: string; root: ComponentJson; packages: ComponentJson[] };
  attachments: { owner: string; data: unknown }[];
}

/** The keys under which an Export names what it exports: each is the name of its Entity, lower-cased. */
export const EXPORT_KEYS = ["component", "interaction", "transformation", "language", "medium", "deployment", "instance"] as const;
export type ExportKey = (typeof EXPORT_KEYS)[number];

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
  | { kind: "Transformation"; transformation: TransformationJson; component: ComponentJson }
  | { kind: "Parameter"; parameter: ParameterJson; function: FunctionJson; component: ComponentJson }
  /** An Export of a Component, or one by which a Deployment exposes a placement (`deployment`). */
  | { kind: "Export"; export: ExportJson; component: ComponentJson; deployment?: DeploymentJson }
  /** An Import of a Component (its vocabulary), or of a Deployment (its needs: `deployment`). */
  | { kind: "Import"; import: ImportJson; component: ComponentJson; deployment?: DeploymentJson }
  | { kind: "Medium"; medium: MediumJson; component: ComponentJson }
  /** A Deployment: `component` keeps it; `box` is what it lays out. */
  | { kind: "Deployment"; deployment: DeploymentJson; component: ComponentJson; box?: ComponentJson }
  | { kind: "Instance"; instance: InstanceJson; deployment: DeploymentJson; component: ComponentJson; box?: ComponentJson }
  | { kind: "Connection"; connection: ConnectionJson; deployment: DeploymentJson; component: ComponentJson; box?: ComponentJson }
  | { kind: "Configuration"; configuration: ConfigurationJson }
  | { kind: "Choice"; choice: ChoiceJson; configuration: ConfigurationJson };

export type Kind = Located["kind"];

/** The kinds of thing a Component owns and may export, by the end that owns them. */
export type OwnedKind = "interactions" | "transformations" | "mediums" | "languages";

export class Model {
  readonly byId = new Map<string, Located>();
  private readonly descriptions = new Map<string, string>();
  /** The Configurations, as the tool keeps them, in their attachment. */
  readonly configurations: ConfigurationJson[];
  private readonly currentId: string | undefined;

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
      for (const interaction of component.interactions) this.byId.set(interaction.id, { kind: "Interaction", interaction, component });
      for (const transformation of component.transformations) this.byId.set(transformation.id, { kind: "Transformation", transformation, component });
      for (const f of [...component.interactions, ...component.transformations]) {
        for (const parameter of f.parameters) this.byId.set(parameter.id, { kind: "Parameter", parameter, function: f, component });
      }
      for (const exported of component.exports) this.byId.set(exported.id, { kind: "Export", export: exported, component });
      for (const imported of component.imports) this.byId.set(imported.id, { kind: "Import", import: imported, component });
      for (const medium of component.mediums) this.byId.set(medium.id, { kind: "Medium", medium, component });
      for (const deployment of component.deployments) {
        this.byId.set(deployment.id, { kind: "Deployment", deployment, component });
        for (const instance of deployment.instances) this.byId.set(instance.id, { kind: "Instance", instance, deployment, component });
        for (const connection of deployment.connections) this.byId.set(connection.id, { kind: "Connection", connection, deployment, component });
        for (const imported of deployment.imports) this.byId.set(imported.id, { kind: "Import", import: imported, component, deployment });
        for (const exposed of deployment.exposes) this.byId.set(exposed.id, { kind: "Export", export: { id: exposed.id, instance: exposed.instance }, component, deployment });
      }
      for (const child of component.components) index(child, component);
    };
    // An identity takes nothing from no Component: read it as such.
    const normalize = (component: ComponentJson) => {
      for (const owner of [component, ...component.deployments]) {
        for (const i of owner.imports) {
          i.from ??= "";
          i.exports ??= [];
        }
      }
      component.components.forEach(normalize);
    };
    normalize(d.root);
    d.packages.forEach(normalize);
    index(d.root);
    for (const component of d.packages) index(component);
    // Each Deployment's box, once every Component is known.
    for (const at of this.byId.values()) {
      if (at.kind === "Deployment" || at.kind === "Instance" || at.kind === "Connection") {
        const found = this.byId.get(at.deployment.of);
        if (found?.kind === "Component") at.box = found.component;
      }
    }
    const stored = file.attachments.find((a) => a.owner === "configurations")?.data as { configurations?: ConfigurationJson[]; current?: string } | undefined;
    this.configurations = Array.isArray(stored?.configurations) ? stored.configurations : [];
    this.currentId = stored?.current;
    for (const configuration of this.configurations) {
      this.byId.set(configuration.id, { kind: "Configuration", configuration });
      const choices = (choice: ChoiceJson) => {
        this.byId.set(choice.id, { kind: "Choice", choice, configuration });
        choice.choices.forEach(choices);
      };
      choices(configuration.root);
    }
    const documentation = file.attachments.find((a) => a.owner === "documentation")?.data as { descriptions?: Record<string, unknown> } | undefined;
    for (const [id, text] of Object.entries(documentation?.descriptions ?? {})) if (typeof text === "string" && this.byId.has(id)) this.descriptions.set(id, text);
  }

  get system() {
    return this.file.design;
  }
  /** The root Component. */
  get root(): ComponentJson {
    return this.file.design.root;
  }
  /** The packages beside the root. */
  get packages(): ComponentJson[] {
    return this.file.design.packages;
  }
  /** The root and the packages: the Components nested in none. */
  get topLevel(): ComponentJson[] {
    return [this.root, ...this.packages];
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

  /** The current Configuration: the one the verifier verifies — the one named current, or the first. */
  get current(): ConfigurationJson | undefined {
    return this.configurations.find((c) => c.id === this.currentId) ?? this.configurations[0];
  }

  /** The Deployments of a box, wherever they are kept: the ways it may be built. */
  deploymentsOf(box: string): DeploymentJson[] {
    return [...this.byId.values()].flatMap((at) => (at.kind === "Deployment" && at.deployment.of === box ? [at.deployment] : []));
  }

  /** A Deployment, by id. */
  deployment(id: string | null | undefined): DeploymentJson | undefined {
    const at = id == null ? undefined : this.byId.get(id);
    return at?.kind === "Deployment" ? at.deployment : undefined;
  }

  /** Where a Connection goes: an Instance, the box, or the placement an identity names. */
  target(connection: ConnectionJson): string | undefined {
    if (connection.to !== null) return connection.to;
    if (connection.toComponent !== null) return connection.toComponent;
    if (connection.toIdentity === null) return undefined;
    const at = this.byId.get(connection.toIdentity);
    return at?.kind === "Import" ? at.import.path?.at(-1) : undefined;
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

  /** An Interaction or a Transformation: anything with a signature. */
  function(id: string | undefined): FunctionJson | undefined {
    const at = id === undefined ? undefined : this.byId.get(id);
    return at?.kind === "Interaction" ? at.interaction : at?.kind === "Transformation" ? at.transformation : undefined;
  }

  /** The Language an Entity is of. */
  languageOf(entity: string | null | undefined): LanguageJson | undefined {
    const at = entity == null ? undefined : this.byId.get(entity);
    return at?.kind === "Entity" ? at.language : undefined;
  }

  /** Where a Transformation goes: `Combat → Network`, from its inputs' Language to its output's. */
  crossing(transformation: FunctionJson): string {
    const from = this.languageOf(transformation.parameters[0]?.type)?.name ?? "?";
    return `${from} → ${this.languageOf(transformation.output)?.name ?? "?"}`;
  }

  /** A signature, as it reads: `(by: Attacker): Damage`. */
  signature(f: FunctionJson): string {
    const output = f.output === null ? "" : `: ${this.name(f.output)}`;
    return `(${f.parameters.map((p) => `${p.name}: ${this.name(p.type)}`).join(", ")})${output}`;
  }

  /** The Component something is in — or the Component itself. */
  componentOf(id: string): ComponentJson | undefined {
    const at = this.byId.get(id);
    if (!at || at.kind === "System" || at.kind === "Configuration" || at.kind === "Choice") return undefined;
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
      case "Transformation":
        return at.transformation.name;
      case "Parameter":
        return at.parameter.name;
      case "Export":
        return this.name(this.resolve(id));
      case "Import":
        return at.import.path !== undefined ? `/${at.import.path.map((p) => this.name(p)).join("/")}` : `from ${this.name(at.import.from)}`;
      case "Medium":
        return at.medium.name;
      case "Deployment":
        return at.deployment.name;
      case "Instance":
        return at.instance.name;
      case "Connection":
        return `${this.name(at.connection.from)} → ${this.name(this.target(at.connection))}`;
      case "Configuration":
        return at.configuration.name;
      case "Choice":
        return at.choice.instance === null
          ? this.name(at.choice.deployment ?? this.root.id)
          : `${this.name(at.choice.instance)}: ${at.choice.deployment === null ? "an interface" : this.name(at.choice.deployment)}`;
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

  /** The Components beside one: its parent's other children; for the root and the packages, each other. */
  siblings(component: string): ComponentJson[] {
    const at = this.byId.get(component);
    if (at?.kind !== "Component") return [];
    return (at.parent ? at.parent.components : this.topLevel).filter((c) => c.id !== component);
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

  /** The thing an Export exports. */
  resolve(exported: string): string | undefined {
    const at = this.byId.get(exported);
    return at?.kind === "Export" ? EXPORT_KEYS.map((key) => at.export[key]).find((id) => id !== undefined) : undefined;
  }

  /** The Component whose Export this is. */
  exporter(exported: string): ComponentJson | undefined {
    const at = this.byId.get(exported);
    return at?.kind === "Export" ? at.component : undefined;
  }

  /** The Imports of a Component (its vocabulary) or of a Deployment (its needs). */
  importsOf(owner: string): ImportJson[] {
    const at = this.byId.get(owner);
    return at?.kind === "Component" ? at.component.imports : at?.kind === "Deployment" ? at.deployment.imports : [];
  }

  /** What the Imports of a Component or a Deployment take, of one kind of thing, or of all. */
  imported(component: string, kind?: Kind): string[] {
    const found = new Set<string>();
    for (const i of this.importsOf(component)) {
      for (const e of i.exports) {
        const target = this.resolve(e);
        if (target !== undefined && (kind === undefined || this.kind(target) === kind)) found.add(target);
      }
    }
    return [...found];
  }

  /** The Components a Component or a Deployment imports from, and those its Imports take as wholes. */
  importedComponents(component: string): ComponentJson[] {
    const ids = new Set([...this.importsOf(component).map((i) => i.from), ...this.imported(component, "Component")]);
    return [...ids].flatMap((id) => this.component(id) ?? []);
  }

  /**
   * The Languages a Component may use: its own and its parents', and those it imports — each with
   * the Component that brings it in.
   */
  scope(component: string): Map<string, ComponentJson> {
    const found = new Map<string, ComponentJson>();
    for (const owner of this.ancestry(component)) for (const language of owner.languages) if (!found.has(language.id)) found.set(language.id, owner);
    for (const language of this.imported(component, "Language")) {
      const owner = this.componentOf(language);
      if (owner && !found.has(language)) found.set(language, owner);
    }
    return found;
  }

  /** The Components a Component may import from: every other one, wherever it is. Exports are not scoped. */
  importable(component: string): ComponentJson[] {
    const all = (c: ComponentJson): ComponentJson[] => [c, ...c.components.flatMap(all)];
    return this.topLevel.flatMap(all).filter((c) => c.id !== component);
  }

  /**
   * What a Deployment may place (W10): a child of its box or of the box's ancestors, a child of
   * its keeper or of the keeper's ancestors, or a top-level Component it imports.
   */
  placeableIn(deployment: string): ComponentJson[] {
    const at = this.byId.get(deployment);
    if (at?.kind !== "Deployment") return [];
    const found = new Map<string, ComponentJson>();
    for (const anchor of [at.box?.id, at.component.id]) {
      if (anchor === undefined) continue;
      for (const owner of this.ancestry(anchor)) for (const child of owner.components) found.set(child.id, child);
    }
    for (const i of at.deployment.imports) {
      const from = this.byId.get(i.from);
      if (from?.kind === "Component" && from.parent === undefined) found.set(from.component.id, from.component);
    }
    return [...found.values()];
  }

  /** What a Component may export: its own Languages, Interactions, Transformations and Mediums, its children, and the Deployments it keeps. */
  exportable(component: string): string[] {
    const c = this.component(component);
    if (!c) return [];
    return [
      ...c.languages.map((l) => l.id),
      ...c.interactions.map((i) => i.id),
      ...c.transformations.map((t) => t.id),
      ...c.mediums.map((m) => m.id),
      ...c.components.map((k) => k.id),
      ...c.deployments.map((d) => d.id),
    ];
  }

  /**
   * What a Deployment has access to of a kind: what its box and keeper, and their ancestors, own,
   * and what its own Imports take — the Mediums and realizations its Mediations may use.
   */
  deploymentAccess(deployment: string, kind: Exclude<OwnedKind, "languages">): string[] {
    const at = this.byId.get(deployment);
    if (at?.kind !== "Deployment") return [];
    const found = new Set<string>();
    for (const anchor of [at.box?.id, at.component.id]) {
      if (anchor === undefined) continue;
      for (const owner of this.ancestry(anchor)) for (const item of owner[kind]) found.add(item.id);
    }
    const entity: Kind = kind === "interactions" ? "Interaction" : kind === "transformations" ? "Transformation" : "Medium";
    for (const id of this.imported(deployment, entity)) found.add(id);
    return [...found].filter((id) => this.byId.has(id));
  }

  /** What a Component has access to of a kind: its own and its parents', and what its Imports resolve to. */
  access(component: string, kind: Exclude<OwnedKind, "languages">): string[] {
    const found = new Set<string>();
    for (const owner of this.ancestry(component)) for (const item of owner[kind]) found.add(item.id);
    const entity: Kind = kind === "interactions" ? "Interaction" : kind === "transformations" ? "Transformation" : "Medium";
    for (const id of this.imported(component, entity)) found.add(id);
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

  /** Where an Entity is used: ends, extensions, Parameters and outputs. */
  usesOf(entity: string): number {
    let count = 0;
    for (const language of this.languages) {
      for (const r of language.relationships) count += r.ends.filter((end) => end.entity === entity).length;
      count += language.entities.filter((e) => e.extends.includes(entity)).length;
    }
    for (const component of this.components) {
      for (const f of [...component.interactions, ...component.transformations]) count += f.parameters.filter((p) => p.type === entity).length + (f.output === entity ? 1 : 0);
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
      case "Medium":
      case "Export":
      case "Import":
        return { tab: { kind: "component", id: at.component.id }, focus: id };
      case "Parameter":
        return this.home(at.function.id);
      case "Transformation":
        return { tab: { kind: "transformation", id } };
      case "Deployment":
        return { tab: { kind: "deployment", id } };
      case "Instance":
      case "Connection":
        return { tab: { kind: "deployment", id: at.deployment.id }, focus: id };
      case "Configuration":
        return { tab: { kind: "configuration", id } };
      case "Choice":
        return { tab: { kind: "configuration", id: at.configuration.id }, focus: id };
    }
  }
}

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
