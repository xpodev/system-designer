/**
 * The Catalog (docs/tool-design.md): content available to import. A Package's content is a
 * Tool::System — library content is stored exactly like any other System — and its Origin is
 * the standard catalog or a file. Importing copies a Package's Languages, Domains and
 * Mediations into a Target through the SystemEditor, one Edit each, so every System stays
 * closed. Exporting a selection gives a Package whose System holds the selection and
 * everything it references.
 *
 * Packages do not depend on each other. What a Package shares with content already in the
 * Target — the same Element, by id, Entity and name, as when "HTTP over TCP" is imported
 * over an HTTP imported before — is reused rather than copied again.
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { copy, nameOf, setName, systemComposition, systemGraph, type Graph } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { SystemEditor } from "@systemathic/editors";
import type { SystemContext, ToolSystem } from "@systemathic/tool";
import { readSystem } from "@systemathic/tool-json";

export type Origin = "standard" | "file";

export interface Package {
  readonly id: string;
  readonly name: string;
  readonly about: string;
  readonly tags: readonly string[];
  readonly origin: Origin;
  /** Where it was read from. */
  readonly path: string;
  readonly content: ToolSystem;
}

/** What a Package says about itself: its `catalog` attachment. */
export interface PackageInfo {
  readonly package: string;
  readonly about: string;
  readonly tags: readonly string[];
}

export const ATTACHMENT_OWNER = "catalog";

/** The folder of the standard catalog. */
export const STANDARD_CATALOG = fileURLToPath(new URL("../../../catalog/", import.meta.url));

export function packageOf(content: ToolSystem, origin: Origin, path: string): Package {
  const info = content.attachments.find((attachment) => attachment.owner === ATTACHMENT_OWNER)?.data as Partial<PackageInfo> | undefined;
  const [system] = content.design.ofEntity("System");
  return {
    id: info?.package ?? basename(path).replace(/\.systemathic\.json$|\.json$/, ""),
    name: (system && nameOf(content.design, system)) ?? basename(path),
    about: info?.about ?? "",
    tags: info?.tags ?? [],
    origin,
    path,
    content,
  };
}

/** Reads a System file as a Package. Content that cannot be followed fully is refused: a Package must be closed. */
export function readPackage(path: string, origin: Origin = "file"): Package {
  const { system, problems } = readSystem(JSON.parse(readFileSync(path, "utf8")));
  if (problems.length > 0) throw new Error(`${path}: ${problems.map((problem) => `${problem.at}: ${problem.message}`).join("; ")}`);
  return packageOf(system, origin, path);
}

export class Catalog {
  private readonly byId = new Map<string, Package>();

  constructor(packages: readonly Package[] = []) {
    for (const p of packages) this.add(p);
  }

  /** The standard catalog. */
  static standard(folder = STANDARD_CATALOG): Catalog {
    const files = readdirSync(folder).filter((file) => file.endsWith(".systemathic.json")).sort();
    return new Catalog(files.map((file) => readPackage(join(folder, file), "standard")));
  }

  get packages(): Package[] {
    return [...this.byId.values()];
  }

  get tags(): string[] {
    return [...new Set(this.packages.flatMap((p) => p.tags))].sort();
  }

  add(p: Package): Package {
    this.byId.set(p.id, p);
    return p;
  }

  /** Adds a Package from a file. */
  addFile(path: string): Package {
    return this.add(readPackage(path, "file"));
  }

  find(id: string): Package | undefined {
    return this.byId.get(id);
  }

  /** Packages whose name, id or description contains `text`, and that have `tag`, if given. */
  search(text = "", tag?: string): Package[] {
    const needle = text.toLowerCase();
    return this.packages.filter(
      (p) => (tag === undefined || p.tags.includes(tag)) && [p.id, p.name, p.about].some((field) => field.toLowerCase().includes(needle)),
    );
  }
}

export interface Import {
  readonly package: Package;
  /** One Edit per Language, Domain and Mediation copied. */
  readonly edits: readonly Edit[];
  /** Source ids already in the Target, and reused. */
  readonly reused: readonly string[];
  /** Every source id, to its id in the Target. */
  readonly ids: ReadonlyMap<string, string>;
}

/** Imports a Package into the session's Target, through the SystemEditor. */
export function importPackage(session: EditSession, p: Package): Import {
  const target = session.target.graph;
  const source = p.content.design;
  const [system] = target.ofEntity("System");
  const [sourceSystem] = source.ofEntity("System");
  if (system === undefined || sourceSystem === undefined) throw new Error("both the Target and the Package need a System");
  const ids = new Map<string, string>();
  const edits: Edit[] = [];
  const reused: string[] = [];
  for (const end of ["languages", "domains", "mediations"]) {
    for (const item of source.navigate(sourceSystem, end)) {
      if (sameElement(source, target, item)) {
        for (const id of owned(source, item)) if (target.has(id)) ids.set(id, id);
        reused.push(item);
      } else {
        edits.push(SystemEditor.addCopy(session, system, source, item, ids));
      }
    }
  }
  session.target.context.attach({ owner: ATTACHMENT_OWNER, data: { imported: p.id, origin: p.origin, path: p.path, items: Object.fromEntries(ids) } });
  return { package: p, edits, reused, ids };
}

function sameElement(source: Graph, target: Graph, id: string): boolean {
  if (!target.has(id)) return false;
  const [a, b] = [source.get(id), target.get(id)];
  return a.entity === b.entity && nameOf(source, id) === nameOf(target, id);
}

/** An Element and everything it owns. */
function owned(graph: Graph, root: string): string[] {
  const found: string[] = [];
  const pending = [root];
  while (pending.length > 0) {
    const id = pending.pop()!;
    found.push(id);
    for (const end of systemComposition.owning.get(graph.get(id).entity) ?? []) pending.push(...graph.navigate(id, end));
  }
  return found;
}

/**
 * The smallest set containing the selection that is closed under a Domain's Languages and
 * referenced Domains (and its Transformations' Languages), a Transformation's holder, a
 * Mediation's three Domains, and everything a Language contains. Anything inside a Language,
 * a Domain or a Transformation selects what holds it.
 */
export function closure(graph: Graph, selection: readonly string[]): { languages: Set<string>; domains: Set<string>; mediations: Set<string> } {
  const languages = new Set<string>();
  const domains = new Set<string>();
  const mediations = new Set<string>();
  const pending = [...selection];
  const up: Record<string, string> = {
    Entity: "language",
    Relationship: "language",
    Formula: "language",
    Interaction: "language",
    End: "relationship",
    Parameter: "interaction",
    Transformation: "holder",
    Reverse: "transformation",
    EntityMapping: "transformation",
    RelationshipMapping: "transformation",
    InteractionMapping: "transformation",
    Deferred: "transformation",
  };
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (!graph.has(id)) continue;
    const entity = graph.get(id).entity;
    if (entity === "Language") languages.add(id);
    else if (entity === "Domain") {
      if (domains.has(id)) continue;
      domains.add(id);
      pending.push(...graph.navigate(id, "languages"), ...graph.navigate(id, "references"));
      for (const t of graph.navigate(id, "transformations")) pending.push(...graph.navigate(t, "source"), ...graph.navigate(t, "target"));
    } else if (entity === "Mediation") {
      if (mediations.has(id)) continue;
      mediations.add(id);
      for (const role of ["what", "how", "mediator"]) pending.push(...graph.navigate(id, role));
    } else if (up[entity] !== undefined) pending.push(...graph.navigate(id, up[entity]!));
  }
  return { languages, domains, mediations };
}

/** Exports a selection, with everything it references, as the content of a new Package. */
export function exportSelection(context: SystemContext, selection: readonly string[], info: { name: string; about?: string; tags?: readonly string[] }): ToolSystem {
  const source = context.design;
  const [sourceSystem] = source.ofEntity("System");
  if (sourceSystem === undefined) throw new Error("the design has no System");
  const chosen = closure(source, selection);
  const design = systemGraph();
  const key = info.name.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase() || "package";
  const system = `${key}.system`;
  design.add("System", system);
  setName(design, system, info.name);
  const ids = new Map<string, string>();
  for (const [end, set] of [["languages", chosen.languages], ["domains", chosen.domains], ["mediations", chosen.mediations]] as const) {
    const ordered = source.navigate(sourceSystem, end).filter((id) => set.has(id));
    for (const id of copy(source, design, ordered, ids)) design.connect(system, end, id);
  }
  return { design, attachments: [{ owner: ATTACHMENT_OWNER, data: { package: key, about: info.about ?? "", tags: [...(info.tags ?? [])] } satisfies PackageInfo }] };
}
