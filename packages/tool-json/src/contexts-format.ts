/**
 * ContextsFormat: a System — its Languages, Domains and Mediations — as JSON. Languages are
 * read and written by KernelFormat. Layers above Contexts add their parts of a Language or a
 * Transformation through the extension hooks, so this module knows nothing of them.
 */
import { nameOf, setName, type Graph } from "@systemathic/core";
import { readLanguage, writeLanguage, type KernelLanguageJson } from "./kernel-format.js";
import { array, object, string, type Reader } from "./reader.js";

export interface MappingJson { source: string; targets: string[] }
export interface TransformationJson {
  id: string; name: string; source: string; target: string;
  reverse: { context: string[] } | null;
  entityMappings: MappingJson[]; relationshipMappings: MappingJson[];
}
export interface DomainJson { id: string; name: string; languages: string[]; references: string[]; transformations: TransformationJson[] }
export interface MediationJson { id: string; what: string; how: string; mediator: string }
export interface DesignJson { id: string; name: string; languages: KernelLanguageJson[]; domains: DomainJson[]; mediations: MediationJson[] }

/** What a layer above Contexts reads into, and writes from, a Language or a Transformation. */
export interface Extension {
  readLanguage?(reader: Reader, language: string, json: Record<string, unknown>, at: string): void;
  writeLanguage?(graph: Graph, language: string): Record<string, unknown>;
  readTransformation?(reader: Reader, transformation: string, json: Record<string, unknown>, at: string): void;
  writeTransformation?(graph: Graph, transformation: string): Record<string, unknown>;
}

export function readDesign(reader: Reader, value: unknown, at: string, extensions: readonly Extension[] = []): string | undefined {
  const graph = reader.graph;
  const json = object(value, at);
  const system = reader.create("System", json.id, at);
  if (system === undefined) return undefined;
  setName(graph, system, string(json.name, `${at}.name`));

  array(json.languages, `${at}.languages`).forEach((value, index) => {
    const where = `${at}.languages[${index}]`;
    const language = readLanguage(reader, value, where);
    if (language === undefined) return;
    graph.connect(system, "languages", language);
    for (const extension of extensions) extension.readLanguage?.(reader, language, object(value, where), where);
  });

  array(json.domains, `${at}.domains`).forEach((value, index) => {
    const where = `${at}.domains[${index}]`;
    const domain = object(value, where);
    const id = reader.create("Domain", domain.id, where);
    if (id === undefined) return;
    setName(graph, id, string(domain.name, `${where}.name`));
    graph.connect(system, "domains", id);
    array(domain.languages, `${where}.languages`).forEach((ref, i) => reader.refer(id, "languages", ref, `${where}.languages[${i}]`));
    array(domain.references, `${where}.references`).forEach((ref, i) => reader.refer(id, "references", ref, `${where}.references[${i}]`));
    array(domain.transformations, `${where}.transformations`).forEach((value, i) => {
      readTransformation(reader, id, value, `${where}.transformations[${i}]`, extensions);
    });
  });

  array(json.mediations, `${at}.mediations`).forEach((value, index) => {
    const where = `${at}.mediations[${index}]`;
    const mediation = object(value, where);
    const id = reader.create("Mediation", mediation.id, where);
    if (id === undefined) return;
    graph.connect(system, "mediations", id);
    for (const role of ["what", "how", "mediator"] as const) reader.refer(id, role, mediation[role], `${where}.${role}`);
  });

  return system;
}

function readTransformation(reader: Reader, holder: string, value: unknown, at: string, extensions: readonly Extension[]): void {
  const graph = reader.graph;
  const json = object(value, at);
  const id = reader.create("Transformation", json.id, at);
  if (id === undefined) return;
  setName(graph, id, string(json.name, `${at}.name`));
  graph.connect(holder, "transformations", id);
  reader.refer(id, "source", json.source, `${at}.source`);
  reader.refer(id, "target", json.target, `${at}.target`);
  if (json.reverse !== null) {
    const reverse = object(json.reverse, `${at}.reverse`);
    const reverseId = reader.create("Reverse", `${id}#reverse`, `${at}.reverse`);
    if (reverseId !== undefined) {
      graph.connect(id, "reverse", reverseId);
      array(reverse.context, `${at}.reverse.context`).forEach((ref, i) => reader.refer(reverseId, "context", ref, `${at}.reverse.context[${i}]`));
    }
  }
  for (const [kind, entity, prefix] of [["entityMappings", "EntityMapping", "em"], ["relationshipMappings", "RelationshipMapping", "rm"]] as const) {
    array(json[kind], `${at}.${kind}`).forEach((value, index) => {
      const where = `${at}.${kind}[${index}]`;
      const mapping = object(value, where);
      const mappingId = reader.create(entity, `${id}#${prefix}${index}`, where);
      if (mappingId === undefined) return;
      graph.connect(id, kind, mappingId);
      reader.refer(mappingId, "source", mapping.source, `${where}.source`);
      array(mapping.targets, `${where}.targets`).forEach((ref, i) => reader.refer(mappingId, "targets", ref, `${where}.targets[${i}]`));
    });
  }
  for (const extension of extensions) extension.readTransformation?.(reader, id, json, at);
}

export function writeDesign(graph: Graph, system: string, extensions: readonly Extension[] = []): DesignJson {
  const mappings = (transformation: string, kind: "entityMappings" | "relationshipMappings") =>
    graph.navigate(transformation, kind).map((mapping) => ({
      source: graph.navigate(mapping, "source")[0] ?? "",
      targets: graph.navigate(mapping, "targets"),
    }));
  return {
    id: system,
    name: nameOf(graph, system) ?? "",
    languages: graph.navigate(system, "languages").map((language) =>
      Object.assign(writeLanguage(graph, language), ...extensions.map((extension) => extension.writeLanguage?.(graph, language) ?? {})),
    ),
    domains: graph.navigate(system, "domains").map((domain) => ({
      id: domain,
      name: nameOf(graph, domain) ?? "",
      languages: graph.navigate(domain, "languages"),
      references: graph.navigate(domain, "references"),
      transformations: graph.navigate(domain, "transformations").map((transformation) => {
        const [reverse] = graph.navigate(transformation, "reverse");
        return Object.assign(
          {
            id: transformation,
            name: nameOf(graph, transformation) ?? "",
            source: graph.navigate(transformation, "source")[0] ?? "",
            target: graph.navigate(transformation, "target")[0] ?? "",
            reverse: reverse === undefined ? null : { context: graph.navigate(reverse, "context") },
            entityMappings: mappings(transformation, "entityMappings"),
            relationshipMappings: mappings(transformation, "relationshipMappings"),
          },
          ...extensions.map((extension) => extension.writeTransformation?.(graph, transformation) ?? {}),
        );
      }),
    })),
    mediations: graph.navigate(system, "mediations").map((mediation) => ({
      id: mediation,
      what: graph.navigate(mediation, "what")[0] ?? "",
      how: graph.navigate(mediation, "how")[0] ?? "",
      mediator: graph.navigate(mediation, "mediator")[0] ?? "",
    })),
  };
}
