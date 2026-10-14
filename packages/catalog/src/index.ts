/**
 * The Catalog: content available to import. A Package's content is a System — library
 * content is stored exactly like any other System — and its Origin is
 * the standard catalog or a file. Importing copies a Package's Components in beside the
 * Target's root, through the SystemEditor, one Edit each, so every System stays closed; the
 * root, and what is nested in it, then import from them as from any sibling. Exporting a
 * selection gives a Package whose System holds the Components of the selection and
 * everything they depend on.
 *
 * Packages do not depend on each other. What a Package shares with content already in the
 * Target — the same Element, by id, Entity and name, as when "HTTP over TCP" is imported
 * over an HTTP imported before — is reused rather than copied again.
 */
import { ancestry, copy, coreGraph, imported, importedComponents, nameOf, setName, systemComposition, type Graph } from "@systemathic/core";
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

const basename = (path: string) => path.split(/[\\/]/).pop() ?? path;

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

/**
 * A parsed System file as a Package; where it came from is for messages. Content that cannot be
 * followed fully is refused: a Package must be closed. Reading the file is the caller's.
 */
export function parsePackage(file: unknown, origin: Origin, path: string): Package {
  const { system, problems } = readSystem(file);
  if (problems.length > 0) throw new Error(`${path}: ${problems.map((problem) => `${problem.at}: ${problem.message}`).join("; ")}`);
  return packageOf(system, origin, path);
}

export class Catalog {
  private readonly byId = new Map<string, Package>();

  constructor(packages: readonly Package[] = []) {
    for (const p of packages) this.add(p);
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
  /** One Edit per Component copied. */
  readonly edits: readonly Edit[];
  /** Source ids already in the Target, and reused. */
  readonly reused: readonly string[];
  /** Every source id, to its id in the Target. */
  readonly ids: ReadonlyMap<string, string>;
}

/** Imports a Package into the session's Target: its Components, beside the root. */
export function importPackage(session: EditSession, p: Package): Import {
  const target = session.target.graph;
  const source = p.content.design;
  const [system] = target.ofEntity("System");
  const [sourceSystem] = source.ofEntity("System");
  if (system === undefined || sourceSystem === undefined) throw new Error("both the Target and the Package need a System");
  const ids = new Map<string, string>();
  const edits: Edit[] = [];
  const reused: string[] = [];
  for (const component of [...source.navigate(sourceSystem, "root"), ...source.navigate(sourceSystem, "packages")]) {
    if (sameElement(source, target, component)) {
      for (const id of owned(source, component)) if (target.has(id)) ids.set(id, id);
      reused.push(component);
    } else {
      edits.push(SystemEditor.addPackage(session, system, source, component, ids));
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

/** How to go up from anything to what owns it, until a Component. */
const UP: Readonly<Record<string, string>> = {
  Language: "component",
  Entity: "language",
  Relationship: "language",
  Formula: "language",
  End: "relationship",
  Interaction: "component",
  Transformation: "component",
  Parameter: "function",
  Medium: "component",
  Deployment: "component",
  Instance: "deployment",
  Connection: "deployment",
  Mediation: "connection",
};

/** The Component that owns `id`, or `id` itself if it is one. */
function owner(graph: Graph, id: string): string | undefined {
  let current: string | undefined = id;
  while (current !== undefined && graph.has(current) && graph.get(current).entity !== "Component") {
    const end: string | undefined = UP[graph.get(current).entity];
    current = end === undefined ? undefined : graph.navigate(current, end)[0];
  }
  return current;
}

/**
 * The smallest set of Components containing the selection's that is closed under what each
 * depends on: the Components it imports from, those owning what it imports (and so the
 * Components that re-export it), those owning the Languages it uses or its Languages extend, and those whose
 * Instances its Deployments place. Anything inside a Component selects it; a Component nested
 * in a chosen one comes with it.
 */
export function closure(graph: Graph, selection: readonly string[]): Set<string> {
  const chosen = new Set<string>();
  const pending = selection.flatMap((id) => (graph.has(id) ? [owner(graph, id)] : [])).filter((id): id is string => id !== undefined);
  const owners = (ids: readonly string[], end: string) => ids.flatMap((id) => graph.navigate(id, end));
  while (pending.length > 0) {
    const component = pending.pop()!;
    if (chosen.has(component)) continue;
    chosen.add(component);
    const inside = owned(graph, component);
    const languages = inside.filter((id) => graph.get(id).entity === "Language");
    const users = inside.filter((id) => graph.get(id).entity === "Component");
    pending.push(
      ...users.flatMap((user) => importedComponents(graph, user)),
      ...users.flatMap((user) => imported(graph, user)).flatMap((item) => graph.navigate(item, graph.get(item).entity === "Component" ? "parent" : "component")),
      ...owners(users, "implements"),
      ...owners(owners(users, "uses"), "component"),
      ...owners(owners(languages, "extends"), "component"),
      ...owners(inside.filter((id) => graph.get(id).entity === "Instance"), "of"),
    );
  }
  // Only the outermost: one nested in a chosen Component comes with it.
  return new Set([...chosen].filter((component) => !ancestry(graph, component).slice(1).some((outer) => chosen.has(outer))));
}

/** Exports a selection, with everything it depends on, as the content of a new Package. */
export function exportSelection(context: SystemContext, selection: readonly string[], info: { name: string; about?: string; tags?: readonly string[] }): ToolSystem {
  const source = context.design;
  const chosen = closure(source, selection);
  const design = coreGraph();
  const key = info.name.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase() || "package";
  const system = `${key}.system`;
  design.add("System", system);
  setName(design, system, info.name);
  const ordered = source.ofEntity("Component").filter((id) => chosen.has(id));
  const ids = new Map<string, string>();
  // The first Component is the Package's root; the rest are packages beside it.
  copy(source, design, ordered, ids).forEach((id, index) => design.connect(system, index === 0 ? "root" : "packages", id));
  return { design, attachments: [{ owner: ATTACHMENT_OWNER, data: { package: key, about: info.about ?? "", tags: [...(info.tags ?? [])] } satisfies PackageInfo }] };
}
