/**
 * Perspectives (docs/tool-design.md): points of view on a System, as data any client can use.
 * The core's Entities are Subjects here, and Diagnostics are Marks; nothing else of the tool
 * is known. A UI draws a View; an LLM reads the same View as structured data.
 */
import { coreEntities, describe as describeElement, effectiveLanguages, nameOf, parameters, stdSpec, witnessed, type Graph } from "@systemathic/core";
import { diagnose, metrics, type Diagnostic } from "@systemathic/diagnoser";
import type { SystemContext } from "@systemathic/tool";
import { ViewBuilder, type LinkEnd, type Perspective, type View } from "./view.js";

export { ViewBuilder, type Item, type Link, type LinkEnd, type Mark, type Perspective, type View } from "./view.js";

export interface PerspectiveInfo {
  readonly perspective: Perspective;
  readonly title: string;
  readonly about: string;
  /** What else the View needs: the Language a Language view is of. */
  readonly needs?: "language";
}

export const perspectives: readonly PerspectiveInfo[] = [
  { perspective: "outline", title: "Outline", about: "Everything in the System, as a tree: Languages and their contents, Domains and their Transformations, Mediations." },
  { perspective: "language", title: "Language", about: "One Language: its Entities, the Relationships between them, its Interactions and Formulas.", needs: "language" },
  { perspective: "domain-map", title: "Domain map", about: "Domains, the Languages they use, the Domains they reference, and the Transformations between Languages." },
  { perspective: "mediation-stack", title: "Mediation stack", about: "Which Domain is carried out over which, through which mediator, by level from the top." },
  { perspective: "levels", title: "Levels", about: "The kernel, the Systemathic Languages, and the model made of them." },
  { perspective: "diagnostics", title: "Diagnostics", about: "What is wrong: structural errors, then rule errors, then warnings, with suggestions." },
  { perspective: "statistics", title: "Statistics", about: "Counts, depths, fan-in and fan-out." },
];

export interface ViewOptions {
  /** For the Language perspective: the Language. */
  readonly language?: string;
  /** The Diagnostics to mark the View with; by default, the context's structural ones. */
  readonly diagnostics?: readonly Diagnostic[];
}

export function view(context: SystemContext, perspective: Perspective, options: ViewOptions = {}): View {
  const graph = context.design;
  const diagnostics = options.diagnostics ?? diagnose(context);
  const system = graph.ofEntity("System")[0] ?? "";
  const build = builders[perspective];
  if (!build) throw new Error(`no perspective '${perspective}'`);
  return build(graph, system, { ...options, diagnostics }).mark(diagnostics).build();
}

type Builder = (graph: Graph, system: string, options: ViewOptions & { diagnostics: readonly Diagnostic[] }) => ViewBuilder;

/** A thing's name, or, for what has none (a Relationship), how it reads. */
const name = (graph: Graph, id: string) =>
  graph.vocabulary.step(graph.get(id).entity, "name") ? (nameOf(graph, id) ?? (graph.get(id).entity === "End" ? UNNAMED : id)) : describeElement(graph, id);

/** How an unnamed end reads where its name would be: there is no way through it. */
const UNNAMED = "(unnamed)";
const first = (graph: Graph, id: string, end: string) => graph.navigate(id, end)[0];

/** An end's range, as `min..max`. */
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
  const named = nameOf(graph, end);
  return named === undefined ? { range: rangeText(graph, end) } : { name: named, range: rangeText(graph, end) };
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
  const [entity] = from === undefined ? [] : graph.navigate(from, "entity");
  return `${entity === undefined ? "?" : name(graph, entity)}.${endLabel(graph, end)}`;
}

/** Both ways through a Relationship: `Player.prey 0..N ⟷ Monster.hunters 0..N`. */
function relationshipText(graph: Graph, relationship: string): string {
  return [...graph.navigate(relationship, "ends")]
    .reverse()
    .map((end) => endText(graph, end))
    .join(" ⟷ ");
}

function signature(graph: Graph, interaction: string): string {
  const params = parameters(graph, interaction).map((p) => {
    const type = first(graph, p, "type");
    return `${name(graph, p)}: ${type === undefined ? "?" : name(graph, type)}`;
  });
  const output = first(graph, interaction, "output");
  return `${name(graph, interaction)}(${params.join(", ")}) → ${output === undefined ? "?" : name(graph, output)}`;
}

function mappingText(graph: Graph, mapping: string): string {
  const source = first(graph, mapping, "source");
  const targets = graph.navigate(mapping, "targets").map((t) => name(graph, t));
  return `${source === undefined ? "?" : name(graph, source)} ↦ ${targets.join(", ") || "nothing"}`;
}

function kindOf(graph: Graph, transformation: string): string {
  return graph.navigate(transformation, "reverse").length > 0 ? "mediation" : "projection";
}

const builders: Readonly<Record<Perspective, Builder>> = {
  outline(graph, system) {
    const view = new ViewBuilder("outline", "Outline");
    const root = view.item({ subject: system, kind: "System", label: name(graph, system) });
    const languages = view.item({ id: "languages", subject: system, kind: "group", label: "Languages" }, root);
    for (const language of graph.navigate(system, "languages")) {
      const item = view.item({ subject: language, kind: "Language", label: name(graph, language) }, languages);
      for (const entity of graph.navigate(language, "entities")) view.item({ subject: entity, kind: "Entity", label: name(graph, entity) }, item);
      for (const relationship of graph.navigate(language, "relationships")) {
        const r = view.item({ subject: relationship, kind: "Relationship", label: relationshipText(graph, relationship) }, item);
        for (const end of graph.navigate(relationship, "ends")) view.item({ subject: end, kind: "End", label: name(graph, end), detail: endText(graph, end) }, r);
      }
      for (const interaction of graph.navigate(language, "interactions")) {
        const i = view.item({ subject: interaction, kind: "Interaction", label: name(graph, interaction), detail: signature(graph, interaction) }, item);
        for (const parameter of parameters(graph, interaction)) view.item({ subject: parameter, kind: "Parameter", label: name(graph, parameter) }, i);
      }
      for (const formula of graph.navigate(language, "formulas")) {
        view.item({ subject: formula, kind: "Formula", label: String(graph.get(formula).value ?? "") }, item);
      }
    }
    const domains = view.item({ id: "domains", subject: system, kind: "group", label: "Domains" }, root);
    for (const domain of graph.navigate(system, "domains")) {
      const item = view.item({ subject: domain, kind: "Domain", label: name(graph, domain) }, domains);
      for (const transformation of graph.navigate(domain, "transformations")) {
        const source = first(graph, transformation, "source");
        const target = first(graph, transformation, "target");
        const t = view.item(
          {
            subject: transformation,
            kind: "Transformation",
            label: name(graph, transformation),
            detail: `${kindOf(graph, transformation)}: ${source === undefined ? "?" : name(graph, source)} → ${target === undefined ? "?" : name(graph, target)}`,
          },
          item,
        );
        for (const end of ["entityMappings", "relationshipMappings", "interactionMappings"]) {
          for (const mapping of graph.navigate(transformation, end)) {
            view.item({ subject: mapping, kind: graph.get(mapping).entity, label: mappingText(graph, mapping) }, t);
          }
        }
        for (const deferral of graph.navigate(transformation, "deferred")) {
          const item = ["entity", "relationship", "interaction"].flatMap((e) => graph.navigate(deferral, e))[0];
          view.item({ subject: deferral, kind: "Deferred", label: `deferred: ${item === undefined ? "?" : describeElement(graph, item)}` }, t);
        }
      }
    }
    const mediations = view.item({ id: "mediations", subject: system, kind: "group", label: "Mediations" }, root);
    for (const mediation of graph.navigate(system, "mediations")) {
      const [what, how, mediator] = ["what", "how", "mediator"].map((role) => first(graph, mediation, role));
      view.item(
        {
          subject: mediation,
          kind: "Mediation",
          label: `${what === undefined ? "?" : name(graph, what)} / ${how === undefined ? "?" : name(graph, how)}`,
          detail: `mediator: ${mediator === undefined ? "?" : name(graph, mediator)}`,
        },
        mediations,
      );
    }
    return view;
  },

  language(graph, _system, { language }) {
    if (language === undefined || !graph.has(language)) throw new Error("the Language perspective needs a Language");
    const view = new ViewBuilder("language", name(graph, language));
    for (const entity of graph.navigate(language, "entities")) view.item({ subject: entity, kind: "Entity", label: name(graph, entity) });
    for (const relationship of graph.navigate(language, "relationships")) {
      const [a, b] = graph.navigate(relationship, "ends").map((end) => first(graph, end, "entity"));
      const [ea, eb] = graph.navigate(relationship, "ends");
      if (a !== undefined && b !== undefined && ea !== undefined && eb !== undefined) {
        // From a, the end at b is reached; from b, the end at a. Each end reads beside its own Entity: how many of it, by what name.
        view.link(a, b, "Relationship", `${endLabel(graph, eb)} ⟷ ${endLabel(graph, ea)}`, { ends: { source: linkEnd(graph, ea), target: linkEnd(graph, eb) }, subject: relationship });
      }
    }
    for (const interaction of graph.navigate(language, "interactions")) {
      const item = view.item({ subject: interaction, kind: "Interaction", label: name(graph, interaction), detail: signature(graph, interaction) });
      for (const parameter of parameters(graph, interaction)) {
        const type = first(graph, parameter, "type");
        if (type !== undefined) view.link(item, type, "parameter", name(graph, parameter));
      }
      const output = first(graph, interaction, "output");
      if (output !== undefined) view.link(item, output, "output");
    }
    for (const formula of graph.navigate(language, "formulas")) view.item({ subject: formula, kind: "Formula", label: String(graph.get(formula).value ?? "") });
    return view;
  },

  "domain-map"(graph, system) {
    const view = new ViewBuilder("domain-map", "Domain map");
    for (const language of graph.navigate(system, "languages")) view.item({ subject: language, kind: "Language", label: name(graph, language) });
    for (const domain of graph.navigate(system, "domains")) view.item({ subject: domain, kind: "Domain", label: name(graph, domain) });
    for (const domain of graph.navigate(system, "domains")) {
      for (const language of graph.navigate(domain, "languages")) view.link(domain, language, "uses");
      for (const referenced of graph.navigate(domain, "references")) view.link(domain, referenced, "references");
      for (const transformation of graph.navigate(domain, "transformations")) {
        const source = first(graph, transformation, "source");
        const target = first(graph, transformation, "target");
        if (source !== undefined && target !== undefined) view.link(source, target, kindOf(graph, transformation), name(graph, transformation));
      }
    }
    return view;
  },

  "mediation-stack"(graph, system) {
    const view = new ViewBuilder("mediation-stack", "Mediation stack");
    const mediations = graph.navigate(system, "mediations");
    const below = new Map<string, string[]>();
    const involved = new Set<string>();
    for (const mediation of mediations) {
      const what = first(graph, mediation, "what");
      const how = first(graph, mediation, "how");
      if (what === undefined || how === undefined) continue;
      involved.add(what).add(how);
      below.set(what, [...(below.get(what) ?? []), how]);
    }
    // A Domain's level: the longest chain of whats above it, so a stack reads top to bottom.
    const levels = new Map<string, number>();
    const level = (domain: string, path: Set<string>): number => {
      const known = levels.get(domain);
      if (known !== undefined) return known;
      path.add(domain);
      let deepest = 0;
      for (const [what, hows] of below) if (hows.includes(domain) && !path.has(what)) deepest = Math.max(deepest, level(what, path) + 1);
      path.delete(domain);
      levels.set(domain, deepest);
      return deepest;
    };
    for (const domain of graph.navigate(system, "domains")) {
      if (involved.has(domain)) view.item({ subject: domain, kind: "Domain", label: name(graph, domain), level: level(domain, new Set()) });
    }
    for (const mediation of mediations) {
      const [what, how, mediator] = ["what", "how", "mediator"].map((role) => first(graph, mediation, role));
      if (what !== undefined && how !== undefined) {
        view.link(what, how, witnessed(graph, mediation) ? "mediation" : "unwitnessed mediation", mediator === undefined ? undefined : name(graph, mediator));
      }
    }
    return view;
  },

  levels(graph, system) {
    const view = new ViewBuilder("levels", "Levels");
    const layerOf = (entity: string) => stdSpec.relationships.find((r) => r.ends.some((end) => end.entity === entity))?.id.split("#")[0] ?? "?";
    const kernel = view.item({ id: "kernel", subject: system, kind: "level", label: "Kernel", detail: "Language, Entity, Relationship, and the logic", level: 0 });
    for (const entity of coreEntities.filter((e) => layerOf(e) === "Kernel")) {
      view.item({ id: `kernel/${entity}`, subject: system, kind: "vocabulary", label: entity }, kernel);
    }
    const languages = view.item({ id: "languages", subject: system, kind: "level", label: "Systemathic Languages", detail: "the vocabulary every System is made of", level: 1 });
    for (const layer of ["Contexts", "Operations", "Std"]) {
      const group = view.item({ id: `languages/${layer}`, subject: system, kind: "layer", label: layer }, languages);
      for (const entity of graph.vocabulary.spec.entities.filter((e) => layerOf(e) === layer)) {
        view.item({ id: `languages/${layer}/${entity}`, subject: system, kind: "vocabulary", label: entity, detail: `${graph.ofEntity(entity).length} in this System` }, group);
      }
    }
    const model = view.item({ id: "model", subject: system, kind: "level", label: "Model", detail: name(graph, system), level: 2 });
    for (const language of graph.navigate(system, "languages")) {
      const counts = ["entities", "relationships", "interactions"].map((end) => `${graph.navigate(language, end).length} ${end}`).join(", ");
      view.item({ subject: language, kind: "Language", label: name(graph, language), detail: counts }, model);
    }
    return view;
  },

  diagnostics(graph, system, { diagnostics }) {
    const view = new ViewBuilder("diagnostics", "Diagnostics");
    const groups = [
      { id: "structural", label: "Structural errors", has: (d: Diagnostic) => d.kind === "condition" && d.severity === "error" },
      { id: "errors", label: "Rule errors", has: (d: Diagnostic) => d.kind === "rule" && d.severity === "error" },
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

/** The Language perspective needs one; the others take the whole System. */
export function languagesOf(context: SystemContext): string[] {
  const graph = context.design;
  return graph.ofEntity("System").flatMap((system) => graph.navigate(system, "languages"));
}

/** The effective Languages of a Domain, by name: what a client shows beside a Domain. */
export function scopeOf(context: SystemContext, domain: string): string[] {
  return [...effectiveLanguages(context.design, domain)].map((language) => name(context.design, language));
}
