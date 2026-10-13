/**
 * ContextsFormat: a Component as JSON. A Component nests what it owns — its Languages (read
 * and written by KernelFormat), Interactions, Transformations and children — and refers to the
 * Languages it uses, what it imports and what it implements. Layers above Contexts add their
 * parts of a Component through the extension hooks, so this module knows nothing of them.
 */
import { nameOf, setName, type Graph } from "@systemathic/core";
import { readFunction, writeFunction, type FunctionJson } from "./functions-format.js";
import { readLanguage, writeLanguage, type KernelLanguageJson } from "./kernel-format.js";
import { array, object, string, type Reader } from "./reader.js";

export interface InteractionJson extends FunctionJson { language: string }
export type TransformationJson = FunctionJson;
export interface ImportsJson { components: string[]; interactions: string[]; transformations: string[]; mediums: string[] }
export interface ComponentJson {
  id: string; name: string; uses: string[]; imports: ImportsJson; implements: string[];
  languages: KernelLanguageJson[]; interactions: InteractionJson[]; transformations: TransformationJson[];
  mediums: unknown[]; deployments: unknown[];
  components: ComponentJson[];
}

/** What a layer above Contexts reads into, and writes from, a Component. */
export interface Extension {
  readComponent?(reader: Reader, component: string, json: Record<string, unknown>, at: string): void;
  /** Its keys go after the Component's own and before its children; an `imports` object is merged into the Component's. */
  writeComponent?(graph: Graph, component: string): Record<string, unknown>;
}

export function readComponent(reader: Reader, value: unknown, at: string, extensions: readonly Extension[]): string | undefined {
  const graph = reader.graph;
  const json = object(value, at);
  const id = reader.create("Component", json.id, at);
  if (id === undefined) return undefined;
  setName(graph, id, string(json.name, `${at}.name`));
  array(json.uses, `${at}.uses`).forEach((ref, i) => reader.refer(id, "uses", ref, `${at}.uses[${i}]`));
  const imports = object(json.imports, `${at}.imports`);
  for (const [key, end] of [["components", "importedComponents"], ["interactions", "importedInteractions"], ["transformations", "importedTransformations"]] as const) {
    array(imports[key], `${at}.imports.${key}`).forEach((ref, i) => reader.refer(id, end, ref, `${at}.imports.${key}[${i}]`));
  }
  array(json.implements, `${at}.implements`).forEach((ref, i) => reader.refer(id, "implements", ref, `${at}.implements[${i}]`));
  array(json.languages, `${at}.languages`).forEach((value, index) => {
    const language = readLanguage(reader, value, `${at}.languages[${index}]`);
    if (language !== undefined) graph.connect(id, "languages", language);
  });
  array(json.interactions, `${at}.interactions`).forEach((value, index) => {
    const where = `${at}.interactions[${index}]`;
    const interaction = object(value, where);
    const interactionId = readFunction(reader, "Interaction", interaction, where);
    if (interactionId === undefined) return;
    graph.connect(id, "interactions", interactionId);
    reader.refer(interactionId, "language", interaction.language, `${where}.language`);
  });
  array(json.transformations, `${at}.transformations`).forEach((value, index) => {
    const where = `${at}.transformations[${index}]`;
    const transformation = readFunction(reader, "Transformation", object(value, where), where);
    if (transformation !== undefined) graph.connect(id, "transformations", transformation);
  });
  for (const extension of extensions) extension.readComponent?.(reader, id, json, at);
  array(json.components, `${at}.components`).forEach((value, index) => {
    const child = readComponent(reader, value, `${at}.components[${index}]`, extensions);
    if (child !== undefined) graph.connect(id, "components", child);
  });
  return id;
}

export function writeComponent(graph: Graph, component: string, extensions: readonly Extension[]): ComponentJson {
  const json: Record<string, unknown> & { imports: Record<string, unknown> } = {
    id: component,
    name: nameOf(graph, component) ?? "",
    uses: graph.navigate(component, "uses"),
    imports: {
      components: graph.navigate(component, "importedComponents"),
      interactions: graph.navigate(component, "importedInteractions"),
      transformations: graph.navigate(component, "importedTransformations"),
    },
    implements: graph.navigate(component, "implements"),
    languages: graph.navigate(component, "languages").map((language) => writeLanguage(graph, language)),
    interactions: graph.navigate(component, "interactions").map((id) => ({
      id,
      name: nameOf(graph, id) ?? "",
      language: graph.navigate(id, "language")[0] ?? "",
      ...writeFunction(graph, id),
    })),
    transformations: graph.navigate(component, "transformations").map((id) => ({ id, name: nameOf(graph, id) ?? "", ...writeFunction(graph, id) })),
  };
  for (const extension of extensions) {
    const { imports, ...rest } = extension.writeComponent?.(graph, component) ?? {};
    if (imports !== undefined) Object.assign(json.imports, imports);
    Object.assign(json, rest);
  }
  json.components = graph.navigate(component, "components").map((child) => writeComponent(graph, child, extensions));
  return json as unknown as ComponentJson;
}
