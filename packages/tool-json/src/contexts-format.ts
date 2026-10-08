/**
 * ContextsFormat: a System — its top-level Components, the root among them — as JSON. A
 * Component nests what it owns: its Languages (read and written by KernelFormat), its
 * Transformations and its children; it refers to the Languages it uses and the Components and
 * Transformations it imports. Layers above Contexts add their parts of a System, a Component
 * or a Transformation through the extension hooks, so this module knows nothing of them.
 */
import { nameOf, setName, type Graph } from "@systemathic/core";
import { readLanguage, writeLanguage, type KernelLanguageJson } from "./kernel-format.js";
import { array, object, string, type Reader } from "./reader.js";

export interface MappingJson { source: string; targets: string[] }
export interface TransformationJson {
  id: string; name: string; source: string; target: string; context: string[];
  entityMappings: MappingJson[]; relationshipMappings: MappingJson[];
}
export interface ImportsJson { components: string[]; transformations: string[] }
export interface ComponentJson {
  id: string; name: string; uses: string[]; imports: ImportsJson;
  languages: KernelLanguageJson[]; transformations: TransformationJson[];
  components: ComponentJson[];
}
export interface DesignJson { id: string; name: string; root: string; components: ComponentJson[] }

/** What a layer above Contexts reads into, and writes from, a System, a Component or a Transformation. */
export interface Extension {
  readSystem?(reader: Reader, system: string, json: Record<string, unknown>, at: string): void;
  writeSystem?(graph: Graph, system: string): Record<string, unknown>;
  readComponent?(reader: Reader, component: string, json: Record<string, unknown>, at: string): void;
  /** Its keys go after the Component's own and before its children; an `imports` object is merged into the Component's. */
  writeComponent?(graph: Graph, component: string): Record<string, unknown>;
  readTransformation?(reader: Reader, transformation: string, json: Record<string, unknown>, at: string): void;
  writeTransformation?(graph: Graph, transformation: string): Record<string, unknown>;
}

export function readDesign(reader: Reader, value: unknown, at: string, extensions: readonly Extension[] = []): string | undefined {
  const graph = reader.graph;
  const json = object(value, at);
  const system = reader.create("System", json.id, at);
  if (system === undefined) return undefined;
  setName(graph, system, string(json.name, `${at}.name`));
  array(json.components, `${at}.components`).forEach((value, index) => {
    const component = readComponent(reader, value, `${at}.components[${index}]`, extensions);
    if (component !== undefined) graph.connect(system, "components", component);
  });
  reader.refer(system, "root", json.root, `${at}.root`);
  for (const extension of extensions) extension.readSystem?.(reader, system, json, at);
  return system;
}

function readComponent(reader: Reader, value: unknown, at: string, extensions: readonly Extension[]): string | undefined {
  const graph = reader.graph;
  const json = object(value, at);
  const id = reader.create("Component", json.id, at);
  if (id === undefined) return undefined;
  setName(graph, id, string(json.name, `${at}.name`));
  array(json.uses, `${at}.uses`).forEach((ref, i) => reader.refer(id, "uses", ref, `${at}.uses[${i}]`));
  const imports = object(json.imports, `${at}.imports`);
  array(imports.components, `${at}.imports.components`).forEach((ref, i) => reader.refer(id, "importedComponents", ref, `${at}.imports.components[${i}]`));
  array(imports.transformations, `${at}.imports.transformations`).forEach((ref, i) =>
    reader.refer(id, "importedTransformations", ref, `${at}.imports.transformations[${i}]`),
  );
  array(json.languages, `${at}.languages`).forEach((value, index) => {
    const language = readLanguage(reader, value, `${at}.languages[${index}]`);
    if (language !== undefined) graph.connect(id, "languages", language);
  });
  array(json.transformations, `${at}.transformations`).forEach((value, index) => {
    readTransformation(reader, id, value, `${at}.transformations[${index}]`, extensions);
  });
  for (const extension of extensions) extension.readComponent?.(reader, id, json, at);
  array(json.components, `${at}.components`).forEach((value, index) => {
    const child = readComponent(reader, value, `${at}.components[${index}]`, extensions);
    if (child !== undefined) graph.connect(id, "components", child);
  });
  return id;
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
  array(json.context, `${at}.context`).forEach((ref, i) => reader.refer(id, "context", ref, `${at}.context[${i}]`));
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
  return Object.assign(
    {
      id: system,
      name: nameOf(graph, system) ?? "",
      root: graph.navigate(system, "root")[0] ?? "",
      components: graph.navigate(system, "components").map((component) => writeComponent(graph, component, extensions)),
    },
    ...extensions.map((extension) => extension.writeSystem?.(graph, system) ?? {}),
  );
}

function writeComponent(graph: Graph, component: string, extensions: readonly Extension[]): ComponentJson {
  const json: Record<string, unknown> & { imports: Record<string, unknown> } = {
    id: component,
    name: nameOf(graph, component) ?? "",
    uses: graph.navigate(component, "uses"),
    imports: {
      components: graph.navigate(component, "importedComponents"),
      transformations: graph.navigate(component, "importedTransformations"),
    },
    languages: graph.navigate(component, "languages").map((language) => writeLanguage(graph, language)),
    transformations: graph.navigate(component, "transformations").map((transformation) => writeTransformation(graph, transformation, extensions)),
  };
  for (const extension of extensions) {
    const { imports, ...rest } = extension.writeComponent?.(graph, component) ?? {};
    if (imports !== undefined) Object.assign(json.imports, imports);
    Object.assign(json, rest);
  }
  json.components = graph.navigate(component, "components").map((child) => writeComponent(graph, child, extensions));
  return json as unknown as ComponentJson;
}

function writeTransformation(graph: Graph, transformation: string, extensions: readonly Extension[]): TransformationJson {
  const mappings = (kind: "entityMappings" | "relationshipMappings") =>
    graph.navigate(transformation, kind).map((mapping) => ({
      source: graph.navigate(mapping, "source")[0] ?? "",
      targets: graph.navigate(mapping, "targets"),
    }));
  return Object.assign(
    {
      id: transformation,
      name: nameOf(graph, transformation) ?? "",
      source: graph.navigate(transformation, "source")[0] ?? "",
      target: graph.navigate(transformation, "target")[0] ?? "",
      context: graph.navigate(transformation, "context"),
      entityMappings: mappings("entityMappings"),
      relationshipMappings: mappings("relationshipMappings"),
    },
    ...extensions.map((extension) => extension.writeTransformation?.(graph, transformation) ?? {}),
  );
}
