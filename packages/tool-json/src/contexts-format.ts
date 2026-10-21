/**
 * ContextsFormat: a Component as JSON. A Component nests what it owns — its Exports, Imports,
 * Languages (read and written by KernelFormat), Interactions, Transformations and children —
 * and refers to the Languages it uses. An Export names what it exports under one key,
 * `component`, `interaction`, `transformation` or `language`; an Import names the Component it
 * is `from` and the `exports` it takes. Layers above Contexts add their parts of a Component,
 * their keys of an Export, and their forms of an Import through the extension hooks, so this
 * module knows nothing of them.
 */
import { nameOf, setName, type Graph } from "@systemathic/core";
import { readFunction, writeFunction, type FunctionJson } from "./functions-format.js";
import { readLanguage, writeLanguage, type KernelLanguageJson } from "./kernel-format.js";
import { array, object, string, type Reader } from "./reader.js";

export interface InteractionJson extends FunctionJson { language: string }
export type TransformationJson = FunctionJson;
/** An Export: its id, and what it exports under one key (`interaction`, `deployment`, ...). */
export type ExportJson = { id: string } & Record<string, string>;
/** An Import from a Component, taking some of its Exports; or, from a Deployment only, an identity: a `path` of placements. */
export type ImportJson = { id: string; from: string; exports: string[] } | { id: string; path: string[] };
export interface ComponentJson {
  id: string; name: string; uses: string[]; exports: ExportJson[]; imports: ImportJson[];
  languages: KernelLanguageJson[]; interactions: InteractionJson[]; transformations: TransformationJson[];
  mediums: unknown[]; deployments: unknown[];
  components: ComponentJson[];
}

/** What a layer above Contexts reads into, and writes from, a Component and an Export. */
export interface Extension {
  readComponent?(reader: Reader, component: string, json: Record<string, unknown>, at: string): void;
  /** Its keys go after the Component's own and before its children. */
  writeComponent?(graph: Graph, component: string): Record<string, unknown>;
  readExport?(reader: Reader, exported: string, json: Record<string, unknown>, at: string): void;
  writeExport?(graph: Graph, exported: string): Record<string, string>;
  /** Reads an Import that is not from a Component; returns whether it did. */
  readImport?(reader: Reader, imported: string, json: Record<string, unknown>, at: string): boolean;
  writeImport?(graph: Graph, imported: string): ImportJson | undefined;
}

/** The keys under which an Export names what it exports, here: each is the Export's end. */
const EXPORTED = ["component", "interaction", "transformation", "language"] as const;

export function readComponent(reader: Reader, value: unknown, at: string, extensions: readonly Extension[]): string | undefined {
  const graph = reader.graph;
  const json = object(value, at);
  const id = reader.create("Component", json.id, at);
  if (id === undefined) return undefined;
  setName(graph, id, string(json.name, `${at}.name`));
  array(json.uses, `${at}.uses`).forEach((ref, i) => reader.refer(id, "uses", ref, `${at}.uses[${i}]`));
  array(json.exports, `${at}.exports`).forEach((value, index) => {
    const where = `${at}.exports[${index}]`;
    const exported = object(value, where);
    const exportId = reader.create("Export", exported.id, where);
    if (exportId === undefined) return;
    graph.connect(id, "exports", exportId);
    for (const key of EXPORTED) if (exported[key] !== undefined) reader.refer(exportId, key, exported[key], `${where}.${key}`);
    if (exported.export !== undefined) reader.problems.push({ at: `${where}.export`, message: "a re-export: Exports are global now, so run scripts/migrate.py on this file" });
    for (const extension of extensions) extension.readExport?.(reader, exportId, exported, where);
  });
  readImports(reader, id, json.imports, `${at}.imports`, extensions);
  if (json.implements !== undefined) reader.problems.push({ at: `${at}.implements`, message: "`implements` is gone: an alternative implementation is a Deployment of the box; run scripts/migrate.py on this file" });
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
  const json: Record<string, unknown> = {
    id: component,
    name: nameOf(graph, component) ?? "",
    uses: graph.navigate(component, "uses"),
    exports: graph.navigate(component, "exports").map((id) => {
      const exported: Record<string, string> = { id };
      for (const key of EXPORTED) {
        const [target] = graph.navigate(id, key);
        if (target !== undefined) exported[key] = target;
      }
      for (const extension of extensions) Object.assign(exported, extension.writeExport?.(graph, id));
      return exported;
    }),
    imports: writeImports(graph, component, extensions),
    languages: graph.navigate(component, "languages").map((language) => writeLanguage(graph, language)),
    interactions: graph.navigate(component, "interactions").map((id) => ({
      id,
      name: nameOf(graph, id) ?? "",
      language: graph.navigate(id, "language")[0] ?? "",
      ...writeFunction(graph, id),
    })),
    transformations: graph.navigate(component, "transformations").map((id) => ({ id, name: nameOf(graph, id) ?? "", ...writeFunction(graph, id) })),
  };
  for (const extension of extensions) Object.assign(json, extension.writeComponent?.(graph, component));
  json.components = graph.navigate(component, "components").map((child) => writeComponent(graph, child, extensions));
  return json as unknown as ComponentJson;
}

/** Reads the Imports of a Component or a Deployment into `owner`'s `imports`. */
export function readImports(reader: Reader, owner: string, value: unknown, at: string, extensions: readonly Extension[]): void {
  array(value, at).forEach((item, index) => {
    const where = `${at}[${index}]`;
    const imported = object(item, where);
    const importId = reader.create("Import", imported.id, where);
    if (importId === undefined) return;
    reader.graph.connect(owner, "imports", importId);
    if (extensions.some((extension) => extension.readImport?.(reader, importId, imported, where))) return;
    reader.refer(importId, "from", imported.from, `${where}.from`);
    array(imported.exports, `${where}.exports`).forEach((ref, i) => reader.refer(importId, "exports", ref, `${where}.exports[${i}]`));
  });
}

/** Writes the Imports of a Component or a Deployment. */
export function writeImports(graph: Graph, owner: string, extensions: readonly Extension[]): ImportJson[] {
  return graph.navigate(owner, "imports").map((id) => {
    for (const extension of extensions) {
      const written = extension.writeImport?.(graph, id);
      if (written !== undefined) return written;
    }
    return { id, from: graph.navigate(id, "from")[0] ?? "", exports: graph.navigate(id, "exports") };
  });
}
