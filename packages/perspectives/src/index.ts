/**
 * Perspectives (docs/tool-design.md): points of view on a System, as data any client can use.
 * The core's Entities are Subjects here, and Diagnostics are Marks; nothing else of the tool
 * is known. A UI draws a View; an LLM reads the same View as structured data.
 */
import { coreEntities, coreSpec, describe as describeElement, identityPath, identityTarget, mediationStack, nameOf, parameters, resolve, scope, type Graph } from "@systemathic/core";
import { diagnose, metrics, type Diagnostic } from "@systemathic/diagnoser";
import type { SystemContext } from "@systemathic/tool";
import { ViewBuilder, type LinkEnd, type Perspective, type View } from "./view.js";

export { ViewBuilder, type Item, type Link, type LinkEnd, type Mark, type Perspective, type View } from "./view.js";

export interface PerspectiveInfo {
  readonly perspective: Perspective;
  readonly title: string;
  readonly about: string;
  /** What else the View needs: the Entity of the Subject it is of — the Language a Language view is of. */
  readonly needs?: "Language" | "Component" | "Deployment";
}

export const perspectives: readonly PerspectiveInfo[] = [
  { perspective: "outline", title: "Outline", about: "Everything in the System, as a tree: its root and packages, each Component nested, with its Languages, Interactions, Transformations, Mediums, imports, and the Deployments it keeps — of itself, or of another box it implements." },
  { perspective: "language", title: "Language", about: "One Language: its Entities and what they extend, the Relationships between them, its Formulas, and the Interactions over it.", needs: "Language" },
  { perspective: "component", title: "Component", about: "One Component: its Languages and what they extend, its children, the Languages each uses, and what each imports from which.", needs: "Component" },
  { perspective: "deployment", title: "Deployment", about: "One Deployment: its Instances, and its Connections — each with its What and the Mediums it is mediated over.", needs: "Deployment" },
  { perspective: "mediation-stack", title: "Mediation stack", about: "Which Language is mediated over which, through which Medium, by level from the top." },
  { perspective: "levels", title: "Levels", about: "The kernel, the Systemathic Languages, and the model made of them." },
  { perspective: "diagnostics", title: "Diagnostics", about: "What is wrong: structural errors, then rule errors, then warnings, with suggestions." },
  { perspective: "statistics", title: "Statistics", about: "Counts, depths, fan-in and fan-out." },
];

export interface ViewOptions {
  /** For a Perspective that needs one: the Language, Component or Deployment it is of. */
  readonly subject?: string;
  /** The Diagnostics to mark the View with; by default, the context's structural ones. */
  readonly diagnostics?: readonly Diagnostic[];
}

export function view(context: SystemContext, perspective: Perspective, options: ViewOptions = {}): View {
  const graph = context.design;
  const diagnostics = options.diagnostics ?? diagnose(context);
  const system = graph.ofEntity("System")[0] ?? "";
  const build = builders[perspective];
  if (!build) throw new Error(`no perspective '${perspective}'`);
  const needs = perspectives.find((p) => p.perspective === perspective)?.needs;
  if (needs !== undefined && (options.subject === undefined || !graph.has(options.subject) || graph.get(options.subject).entity !== needs)) {
    throw new Error(`the ${perspective} perspective needs a ${needs}`);
  }
  return build(graph, system, { ...options, diagnostics }).mark(diagnostics).build();
}

type Builder = (graph: Graph, system: string, options: ViewOptions & { diagnostics: readonly Diagnostic[] }) => ViewBuilder;

/** A thing's name, or, for what has none (a Relationship), how it reads. */
const name = (graph: Graph, id: string) =>
  graph.vocabulary.step(graph.get(id).entity, "name") ? (nameOf(graph, id) ?? (graph.get(id).entity === "End" ? UNNAMED : id)) : describeElement(graph, id);

/** How an unnamed end reads where its name would be: there is no way through it. */
const UNNAMED = "(unnamed)";
const first = (graph: Graph, id: string, end: string) => graph.navigate(id, end)[0];
const named = (graph: Graph, id: string | undefined) => (id === undefined || !graph.has(id) ? "?" : name(graph, id));
/** What an Export exports, by name. */
const exportedName = (graph: Graph, exported: string) => named(graph, resolve(graph, exported));
/** What kind of thing an Export exports. */
function exportedDetail(graph: Graph, exported: string): string {
  const target = resolve(graph, exported);
  return target === undefined ? "nothing" : graph.get(target).entity;
}

/** An end's or an Instance's range, as `min..max`. */
function rangeText(graph: Graph, end: string): string {
  const [min] = graph.navigate(end, "min");
  const [max] = graph.navigate(end, "max");
  return `${min === undefined ? "?" : graph.get(min).value}..${max === undefined ? "N" : graph.get(max).value}`;
}

/** An end, as `name min..max`. */
function endLabel(graph: Graph, end: string): string {
  return `${name(graph, end)} ${rangeText(graph, end)}`;
}

/** An end as a Link shows it beside its Entity: its name, if it has one, and its range. */
function linkEnd(graph: Graph, end: string): LinkEnd {
  const endName = nameOf(graph, end);
  return endName === undefined ? { range: rangeText(graph, end) } : { name: endName, range: rangeText(graph, end) };
}

/** The other end of an end's Relationship. */
function otherEnd(graph: Graph, end: string): string | undefined {
  const [relationship] = graph.navigate(end, "relationship");
  return relationship === undefined ? undefined : graph.navigate(relationship, "ends").find((e) => e !== end);
}

/**
 * The navigation that reaches an end, as `From.name min..max`: an end is named from the other
 * end's Entity, so `Player.prey 0..N` is what a Player reaches through the end `prey`.
 */
function endText(graph: Graph, end: string): string {
  const from = otherEnd(graph, end);
  return `${named(graph, from === undefined ? undefined : first(graph, from, "entity"))}.${endLabel(graph, end)}`;
}

/** Both ways through a Relationship: `Player.prey 0..N ⟷ Monster.hunters 0..N`. */
function relationshipText(graph: Graph, relationship: string): string {
  return [...graph.navigate(relationship, "ends")]
    .reverse()
    .map((end) => endText(graph, end))
    .join(" ⟷ ");
}

/** A Function's signature: `attack(by: Attacker): Damage`; without an output, nothing follows. */
function signature(graph: Graph, func: string): string {
  const params = parameters(graph, func).map((p) => `${name(graph, p)}: ${named(graph, first(graph, p, "type"))}`);
  const output = first(graph, func, "output");
  return `${name(graph, func)}(${params.join(", ")})${output === undefined ? "" : `: ${name(graph, output)}`}`;
}

/** What an Instance places, and how many occupy it when that is not exactly one: `of Client, 0..N`. */
function instanceDetail(graph: Graph, instance: string): string {
  const range = rangeText(graph, instance);
  const runs = first(graph, instance, "runs");
  return `of ${named(graph, first(graph, instance, "of"))}${range === "1..1" ? "" : `, ${range}`}${runs === undefined ? "" : `, runs ${named(graph, runs)}`}`;
}

/** What an Entity extends, as `: A, B`, or nothing. */
function extendsText(graph: Graph, item: string): string | undefined {
  const extended = graph.navigate(item, "extends").map((e) => name(graph, e));
  return extended.length === 0 ? undefined : `extends ${extended.join(", ")}`;
}

/** How a Connection is mediated: `over Network, then Wire`, `unstated`, or a broken level by the Medium it lost. */
export function mediationText(graph: Graph, connection: string): string {
  const stack = mediationStack(graph, connection);
  if (stack.length === 0) return "unstated";
  return `over ${stack.map((m) => named(graph, first(graph, m, "how")) + (graph.navigate(m, "down").length === 0 ? "" : " (realized)")).join(", then ")}`;
}

/** Where a Connection goes: an Instance, or the deployed Component itself. */
/** Where a Connection goes: an Instance, the box, or the placement an identity names. */
function connectionTarget(graph: Graph, connection: string): string | undefined {
  const identity = first(graph, connection, "toIdentity");
  return first(graph, connection, "to") ?? first(graph, connection, "toComponent") ?? (identity === undefined ? undefined : identityTarget(graph, identity));
}

/** An Import, as it reads: from a Component, or an identity's path. */
function importLabel(graph: Graph, imported: string): string {
  const path = identityPath(graph, imported);
  return path.length > 0 ? `imports /${path.map((p) => name(graph, p)).join("/")}` : `imports from ${named(graph, first(graph, imported, "from"))}`;
}

/** The Imports of a Component or a Deployment, each with what it takes. */
function outlineImports(graph: Graph, view: ViewBuilder, owner: string, item: string): void {
  for (const imported of graph.navigate(owner, "imports")) {
    const path = identityPath(graph, imported).length > 0;
    const m = view.item({ subject: imported, kind: "Import", label: importLabel(graph, imported), detail: path ? "identity" : "Component" }, item);
    for (const exported of graph.navigate(imported, "exports")) {
      view.item({ id: `${m}/${exported}`, subject: exported, kind: "Export", label: exportedName(graph, exported), detail: exportedDetail(graph, exported) }, m);
    }
  }
}

function outlineComponent(graph: Graph, view: ViewBuilder, component: string, parent: string): void {
  const item = view.item({ subject: component, kind: "Component", label: name(graph, component) }, parent);
  for (const language of graph.navigate(component, "languages")) {
    const l = view.item({ subject: language, kind: "Language", label: name(graph, language), detail: extendsText(graph, language) }, item);
    for (const entity of graph.navigate(language, "entities")) view.item({ subject: entity, kind: "Entity", label: name(graph, entity), detail: extendsText(graph, entity) }, l);
    for (const relationship of graph.navigate(language, "relationships")) {
      const r = view.item({ subject: relationship, kind: "Relationship", label: relationshipText(graph, relationship) }, l);
      for (const end of graph.navigate(relationship, "ends")) view.item({ subject: end, kind: "End", label: name(graph, end), detail: endText(graph, end) }, r);
    }
    for (const formula of graph.navigate(language, "formulas")) view.item({ subject: formula, kind: "Formula", label: String(graph.get(formula).value ?? "") }, l);
  }
  for (const interaction of graph.navigate(component, "interactions")) {
    const i = view.item({ subject: interaction, kind: "Interaction", label: name(graph, interaction), detail: `${signature(graph, interaction)}, over ${named(graph, first(graph, interaction, "language"))}` }, item);
    for (const parameter of parameters(graph, interaction)) view.item({ subject: parameter, kind: "Parameter", label: name(graph, parameter) }, i);
  }
  for (const transformation of graph.navigate(component, "transformations")) {
    const t = view.item({ subject: transformation, kind: "Transformation", label: name(graph, transformation), detail: signature(graph, transformation) }, item);
    for (const parameter of parameters(graph, transformation)) view.item({ subject: parameter, kind: "Parameter", label: name(graph, parameter) }, t);
  }
  for (const medium of graph.navigate(component, "mediums")) {
    view.item({ subject: medium, kind: "Medium", label: name(graph, medium), detail: `over ${named(graph, first(graph, medium, "language"))}, call ${named(graph, first(graph, medium, "call"))}` }, item);
  }
  for (const exported of graph.navigate(component, "exports")) {
    view.item({ subject: exported, kind: "Export", label: `exports ${exportedName(graph, exported)}`, detail: exportedDetail(graph, exported) }, item);
  }
  outlineImports(graph, view, component, item);
  for (const deployment of graph.navigate(component, "kept")) {
    const box = first(graph, deployment, "component");
    const d = view.item({ subject: deployment, kind: "Deployment", label: name(graph, deployment), detail: box === component ? undefined : `of ${named(graph, box)}` }, item);
    outlineImports(graph, view, deployment, d);
    for (const exposed of graph.navigate(deployment, "exposes")) {
      view.item({ subject: exposed, kind: "Export", label: `exposes ${named(graph, first(graph, exposed, "instance"))}`, detail: "Instance" }, d);
    }
    for (const instance of graph.navigate(deployment, "instances")) {
      view.item({ subject: instance, kind: "Instance", label: name(graph, instance), detail: instanceDetail(graph, instance) }, d);
    }
    for (const connection of graph.navigate(deployment, "connections")) {
      const what = graph.navigate(connection, "what").map((i) => name(graph, i)).join(", ");
      view.item(
        {
          subject: connection,
          kind: "Connection",
          label: `${named(graph, first(graph, connection, "from"))} → ${named(graph, connectionTarget(graph, connection))}: ${what}`,
          detail: mediationText(graph, connection),
        },
        d,
      );
    }
  }
  for (const child of graph.navigate(component, "components")) outlineComponent(graph, view, child, item);
}

const builders: Readonly<Record<Perspective, Builder>> = {
  outline(graph, system) {
    const view = new ViewBuilder("outline", "Outline");
    const root = view.item({ subject: system, kind: "System", label: name(graph, system) });
    for (const component of [...graph.navigate(system, "root"), ...graph.navigate(system, "packages")]) outlineComponent(graph, view, component, root);
    return view;
  },

  language(graph, _system, { subject: language }) {
    const view = new ViewBuilder("language", name(graph, language!));
    const own = new Set(graph.navigate(language!, "entities"));
    for (const entity of own) view.item({ subject: entity, kind: "Entity", label: name(graph, entity), detail: extendsText(graph, entity) });
    // What the Language's own Entities extend, and the Entities its Relationships reach, from the Languages it extends.
    const borrowed = new Set<string>();
    for (const entity of own) for (const extended of graph.navigate(entity, "extends")) borrowed.add(extended);
    for (const relationship of graph.navigate(language!, "relationships")) {
      for (const end of graph.navigate(relationship, "ends")) for (const entity of graph.navigate(end, "entity")) borrowed.add(entity);
    }
    for (const entity of borrowed) {
      if (!own.has(entity)) {
        view.item({ subject: entity, kind: "Entity", label: name(graph, entity), detail: `of ${named(graph, first(graph, entity, "language"))}`, level: 0 });
      }
    }
    for (const entity of own) for (const extended of graph.navigate(entity, "extends")) view.link(entity, extended, "extends");
    for (const relationship of graph.navigate(language!, "relationships")) {
      const [ea, eb] = graph.navigate(relationship, "ends");
      const a = ea === undefined ? undefined : first(graph, ea, "entity");
      const b = eb === undefined ? undefined : first(graph, eb, "entity");
      if (a !== undefined && b !== undefined && ea !== undefined && eb !== undefined) {
        // From a, the end at b is reached; from b, the end at a. Each end reads beside its own Entity: how many of it, by what name.
        view.link(a, b, "Relationship", `${endLabel(graph, eb)} ⟷ ${endLabel(graph, ea)}`, { ends: { source: linkEnd(graph, ea), target: linkEnd(graph, eb) }, subject: relationship });
      }
    }
    // The end from a Language to its Interactions is unnamed: they are found from their side.
    for (const interaction of graph.ofEntity("Interaction").filter((i) => first(graph, i, "language") === language)) {
      const item = view.item({ subject: interaction, kind: "Interaction", label: name(graph, interaction), detail: `${signature(graph, interaction)}, of ${named(graph, first(graph, interaction, "component"))}` });
      for (const parameter of parameters(graph, interaction)) {
        const type = first(graph, parameter, "type");
        if (type !== undefined) view.link(item, type, "parameter", name(graph, parameter));
      }
      const output = first(graph, interaction, "output");
      if (output !== undefined) view.link(item, output, "output");
    }
    for (const formula of graph.navigate(language!, "formulas")) view.item({ subject: formula, kind: "Formula", label: String(graph.get(formula).value ?? "") });
    return view;
  },

  component(graph, _system, { subject: component }) {
    const view = new ViewBuilder("component", name(graph, component!));
    const own = graph.navigate(component!, "languages");
    const visible = scope(graph, component!);
    const children = graph.navigate(component!, "components");
    // Levels: what the Component's Languages build on, then its core Languages, its extensions, and its children.
    for (const language of visible) {
      const ownLanguage = own.includes(language);
      const extendsOwn = graph.navigate(language, "extends").some((l) => own.includes(l));
      view.item({
        subject: language,
        kind: "Language",
        label: name(graph, language),
        detail: ownLanguage ? (extendsOwn ? "extension" : "core") : `of ${named(graph, first(graph, language, "component"))}`,
        level: ownLanguage ? (extendsOwn ? 2 : 1) : 0,
      });
    }
    for (const child of children) view.item({ subject: child, kind: "Component", label: name(graph, child), level: 3 });
    for (const language of own) for (const extended of graph.navigate(language, "extends")) view.link(language, extended, "extends");
    for (const child of children) {
      for (const language of graph.navigate(child, "uses")) view.link(child, language, "uses");
      // What it imports: its vocabulary, and what the Deployments it keeps need.
      for (const owner of [child, ...graph.navigate(child, "kept")]) {
        for (const imported of graph.navigate(owner, "imports")) {
          const from = first(graph, imported, "from");
          const taken = graph.navigate(imported, "exports").map((e) => exportedName(graph, e));
          if (from !== undefined && from !== child) view.link(child, from, "imports", taken.join(", ") || named(graph, from));
        }
      }
      for (const kept of graph.navigate(child, "kept")) {
        const box = first(graph, kept, "component");
        if (box !== undefined && box !== child) view.link(child, box, "implements", name(graph, kept));
      }
    }
    return view;
  },

  deployment(graph, _system, { subject: deployment }) {
    const view = new ViewBuilder("deployment", name(graph, deployment!));
    const [deployed] = graph.navigate(deployment!, "component");
    if (deployed !== undefined) view.item({ subject: deployed, kind: "Component", label: name(graph, deployed), detail: "the deployed Component itself", level: 0 });
    for (const instance of graph.navigate(deployment!, "instances")) {
      view.item({ subject: instance, kind: "Instance", label: name(graph, instance), detail: instanceDetail(graph, instance), level: 1 });
    }
    for (const connection of graph.navigate(deployment!, "connections")) {
      const from = first(graph, connection, "from");
      const to = connectionTarget(graph, connection);
      if (from === undefined || to === undefined) continue;
      const stack = mediationStack(graph, connection);
      const kind = stack.length === 0 ? "unstated" : stack.some((m) => graph.navigate(m, "how").length === 0) ? "broken" : "mediated";
      view.link(from, to, kind, `${graph.navigate(connection, "what").map((i) => name(graph, i)).join(", ")} — ${mediationText(graph, connection)}`, { subject: connection });
    }
    return view;
  },

  "mediation-stack"(graph) {
    const view = new ViewBuilder("mediation-stack", "Mediation stack");
    const below = new Map<string, Map<string, Set<string>>>();
    for (const connection of graph.ofEntity("Connection")) {
      let what = graph.navigate(first(graph, connection, "what") ?? "", "language")[0];
      for (const mediation of mediationStack(graph, connection)) {
        const medium = first(graph, mediation, "how");
        const how = medium === undefined ? undefined : first(graph, medium, "language");
        if (what === undefined || how === undefined || medium === undefined) break;
        const hows = below.get(what) ?? new Map<string, Set<string>>();
        hows.set(how, (hows.get(how) ?? new Set()).add(medium));
        below.set(what, hows);
        what = how;
      }
    }
    // A Language's level: the longest chain of Whats above it, so a stack reads top to bottom.
    const levels = new Map<string, number>();
    const level = (language: string, path: Set<string>): number => {
      const known = levels.get(language);
      if (known !== undefined) return known;
      path.add(language);
      let deepest = 0;
      for (const [what, hows] of below) if (hows.has(language) && !path.has(what)) deepest = Math.max(deepest, level(what, path) + 1);
      path.delete(language);
      levels.set(language, deepest);
      return deepest;
    };
    const involved = new Set([...below.keys(), ...[...below.values()].flatMap((hows) => [...hows.keys()])]);
    for (const language of involved) view.item({ subject: language, kind: "Language", label: name(graph, language), level: level(language, new Set()) });
    for (const [what, hows] of below) {
      for (const [how, mediums] of hows) view.link(what, how, "mediation", [...mediums].map((m) => name(graph, m)).join(", "));
    }
    return view;
  },

  levels(graph, system) {
    const view = new ViewBuilder("levels", "Levels");
    // The layer that declares an Entity is the first whose Relationships mention it.
    const layerOf = (entity: string) => coreSpec.relationships.find((r) => r.ends.some((end) => end.entity === entity))?.id.split("#")[0] ?? "?";
    const kernel = view.item({ id: "kernel", subject: system, kind: "level", label: "Kernel", detail: "Language, Entity, Relationship, and the logic", level: 0 });
    for (const entity of coreEntities.filter((e) => layerOf(e) === "Kernel")) view.item({ id: `kernel/${entity}`, subject: system, kind: "vocabulary", label: entity }, kernel);
    const languages = view.item({ id: "languages", subject: system, kind: "level", label: "Systemathic Languages", detail: "the vocabulary every System is made of", level: 1 });
    for (const layer of ["Functions", "Contexts", "Deployment", "Mediation", "Systems"]) {
      const group = view.item({ id: `languages/${layer}`, subject: system, kind: "layer", label: layer }, languages);
      for (const entity of graph.vocabulary.spec.entities.filter((e) => layerOf(e) === layer)) {
        view.item({ id: `languages/${layer}/${entity}`, subject: system, kind: "vocabulary", label: entity, detail: `${graph.ofEntity(entity).length} in this System` }, group);
      }
    }
    const model = view.item({ id: "model", subject: system, kind: "level", label: "Model", detail: name(graph, system), level: 2 });
    for (const component of [...graph.navigate(system, "root"), ...graph.navigate(system, "packages")]) {
      const counts = ["languages", "components", "interactions", "deployments"].map((end) => `${graph.navigate(component, end).length} ${end}`).join(", ");
      view.item({ subject: component, kind: "Component", label: name(graph, component), detail: counts }, model);
    }
    return view;
  },

  diagnostics(graph, system, { diagnostics }) {
    const view = new ViewBuilder("diagnostics", "Diagnostics");
    const groups = [
      { id: "structural", label: "Structural errors", has: (d: Diagnostic) => d.kind === "condition" && d.severity === "error" },
      { id: "errors", label: "Rule errors", has: (d: Diagnostic) => d.kind === "rule" && d.severity === "error" },
      { id: "configuration", label: "Configuration errors", has: (d: Diagnostic) => d.kind === "configuration" },
      { id: "warnings", label: "Warnings", has: (d: Diagnostic) => d.severity === "warning" },
    ];
    for (const group of groups) {
      const found = diagnostics.filter(group.has);
      const item = view.item({ id: group.id, subject: system, kind: "group", label: group.label, detail: `${found.length}` });
      found.forEach((diagnostic, index) => {
        const d = view.item(
          { id: `${group.id}/${index}`, subject: diagnostic.subjects[0] ?? system, kind: "diagnostic", label: diagnostic.message, detail: diagnostic.check },
          item,
        );
        for (const subject of diagnostic.subjects) {
          if (graph.has(subject)) view.item({ subject, kind: graph.get(subject).entity, label: describeElement(graph, subject) }, d);
        }
        diagnostic.suggestions.forEach((suggestion, n) => {
          view.item({ id: `${d}/suggestion${n}`, subject: suggestion.subjects[0] ?? system, kind: "suggestion", label: suggestion.message }, d);
        });
      });
    }
    return view;
  },

  statistics(graph) {
    const view = new ViewBuilder("statistics", "Statistics");
    for (const metric of metrics(graph)) {
      const subject = view.has(metric.subject)
        ? metric.subject
        : view.item({ subject: metric.subject, kind: graph.get(metric.subject).entity, label: describeElement(graph, metric.subject) });
      view.item({ id: `${subject}/${metric.measure}`, subject: metric.subject, kind: "metric", label: `${metric.measure}: ${metric.value}` }, subject);
    }
    return view;
  },
};
