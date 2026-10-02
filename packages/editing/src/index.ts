/**
 * Editing (docs/tool-design.md): the shared base of every editor. A Target is a system context
 * seen from editing; any number of EditSessions, one per client, edit it at once. Every change
 * is an Edit on the Target's one History, applied in one order and told to every session. It
 * knows nothing of any concept of the core: an Edit is a change to the graph, and the Elements
 * it touched.
 *
 * Editing never refuses: whatever an Edit leaves behind, however ill-formed, is kept. Undo is
 * a new Edit that reverts one of the session's own earlier Edits; history only grows.
 */
import { invert, type Delta, type Graph } from "@systemathic/core";
import type { SystemContext } from "@systemathic/tool";

export type EditKind = "addition" | "change" | "removal";

export interface Edit {
  /** Position in the History, from 1. */
  readonly id: number;
  readonly kind: EditKind;
  /** The session that made it. */
  readonly author: string;
  /** What it is, in a few words: `addEntity Monster`. */
  readonly summary: string;
  /** The Elements it touched: what it names, and every instance it added, removed or linked. */
  readonly elements: readonly string[];
  readonly delta: Delta;
  /** The Edit it undid, if it is an undo. */
  readonly reverts?: number;
}

export type EditListener = (edit: Edit) => void;

/** The Entities whose instances are values, not Elements anyone edits. */
const VALUES = new Set(["Name", "Bound"]);

export class History {
  private readonly chain: Edit[] = [];

  get edits(): readonly Edit[] {
    return this.chain;
  }

  get(id: number): Edit | undefined {
    return this.chain[id - 1];
  }

  /** The Edit that undid `id`, if any. */
  revertedBy(id: number): Edit | undefined {
    return this.chain.find((edit) => edit.reverts === id);
  }

  /** @internal */
  append(edit: Omit<Edit, "id">): Edit {
    const recorded = { ...edit, id: this.chain.length + 1 };
    this.chain.push(recorded);
    return recorded;
  }
}

export class EditSession {
  private selected: string[] = [];
  private readonly listeners = new Set<EditListener>();

  /** @internal Use `Target.startSession`. */
  constructor(
    readonly target: Target,
    readonly id: string,
    /** Who is editing: a client's name, for people reading the History. */
    readonly client: string,
  ) {}

  get selection(): readonly string[] {
    return this.selected;
  }

  /** Selects Elements of the Target; ids that are not are ignored. */
  select(ids: readonly string[]): void {
    this.selected = [...new Set(ids)].filter((id) => this.target.graph.has(id));
  }

  /** Called for every Edit on the Target, by any session, in History order. */
  onEdit(listener: EditListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Applies a change as an Edit of this session. */
  edit(kind: EditKind, summary: string, named: readonly string[], change: (graph: Graph) => void): Edit {
    return this.target.apply(this, kind, summary, named, change);
  }

  /** @internal */
  notify(edit: Edit): void {
    if (this.selected.some((id) => !this.target.graph.has(id))) this.selected = this.selected.filter((id) => this.target.graph.has(id));
    for (const listener of this.listeners) listener(edit);
  }
}

/** A system context, seen from editing: the one authority over its History. */
export class Target {
  readonly history = new History();
  private readonly sessions = new Map<string, EditSession>();
  /** Every session's client, ended or not, so the History can always say who made an Edit. */
  private readonly clients = new Map<string, string>();
  private readonly listeners = new Set<EditListener>();
  private nextSession = 1;

  constructor(readonly context: SystemContext) {}

  get graph(): Graph {
    return this.context.design;
  }

  /** `startSession(Target) → EditSession` */
  startSession(client: string): EditSession {
    const session = new EditSession(this, `s${this.nextSession++}`, client);
    this.sessions.set(session.id, session);
    this.clients.set(session.id, client);
    return session;
  }

  session(id: string): EditSession | undefined {
    return this.sessions.get(id);
  }

  get sessionCount(): number {
    return this.sessions.size;
  }

  /** The sessions editing now. */
  get activeSessions(): EditSession[] {
    return [...this.sessions.values()];
  }

  /** The client of a session, even one that has ended. */
  client(session: string): string | undefined {
    return this.clients.get(session);
  }

  endSession(session: EditSession): void {
    this.sessions.delete(session.id);
  }

  /** Called for every Edit, after every session has been told of it. */
  onEdit(listener: EditListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** @internal Use `EditSession.edit`. */
  apply(session: EditSession, kind: EditKind, summary: string, named: readonly string[], change: (graph: Graph) => void): Edit {
    this.own(session);
    const delta = this.graph.record(change);
    return this.commit({ kind, author: session.id, summary, elements: elements(this.graph, named, delta), delta });
  }

  /**
   * `undo(EditSession) → Edit`: reverts the session's latest Edit still in effect — one it made,
   * or redid. Whatever other sessions changed since is kept; the revert applies as far as it
   * still does. Undefined when there is nothing left to undo.
   */
  undo(session: EditSession): Edit | undefined {
    this.own(session);
    const edit = this.latest(session, (e) => this.role(e) !== "undo");
    return edit === undefined ? undefined : this.revert(session, edit, `undo ${this.original(edit).summary}`);
  }

  /**
   * Reverts the session's latest undo still in effect, as long as the session has made no new
   * Edit since: what was undone is done again. Undefined when there is nothing to redo.
   */
  redo(session: EditSession): Edit | undefined {
    this.own(session);
    const edits = this.history.edits;
    for (let index = edits.length - 1; index >= 0; index--) {
      const edit = edits[index]!;
      if (edit.author !== session.id) continue;
      if (this.role(edit) === "do") return undefined;
      if (this.role(edit) === "undo" && !this.history.revertedBy(edit.id)) return this.revert(session, edit, `redo ${this.original(edit).summary}`);
    }
    return undefined;
  }

  /** Whether an Edit was made, undid one, or redid one. */
  role(edit: Edit): "do" | "undo" | "redo" {
    if (edit.reverts === undefined) return "do";
    return this.role(this.history.get(edit.reverts)!) === "undo" ? "redo" : "undo";
  }

  /** The Edit an undo or redo goes back to. */
  private original(edit: Edit): Edit {
    return edit.reverts === undefined ? edit : this.original(this.history.get(edit.reverts)!);
  }

  private latest(session: EditSession, wanted: (edit: Edit) => boolean): Edit | undefined {
    const edits = this.history.edits;
    for (let index = edits.length - 1; index >= 0; index--) {
      const edit = edits[index]!;
      if (edit.author === session.id && wanted(edit) && !this.history.revertedBy(edit.id)) return edit;
    }
    return undefined;
  }

  private revert(session: EditSession, edit: Edit, summary: string): Edit {
    const delta = this.graph.apply(invert(edit.delta));
    return this.commit({
      kind: opposite(edit.kind),
      author: session.id,
      summary,
      elements: elements(this.graph, edit.elements.filter((id) => this.graph.has(id)), delta),
      delta,
      reverts: edit.id,
    });
  }

  private own(session: EditSession): void {
    if (this.sessions.get(session.id) !== session) throw new Error(`session ${session.id} does not edit this Target`);
  }

  private commit(edit: Omit<Edit, "id">): Edit {
    const recorded = this.history.append(edit);
    for (const session of this.sessions.values()) session.notify(recorded);
    for (const listener of this.listeners) listener(recorded);
    return recorded;
  }
}

/** `undo(EditSession) → Edit` */
export function undo(session: EditSession): Edit | undefined {
  return session.target.undo(session);
}

/** Does again what the session's latest undo undid. */
export function redo(session: EditSession): Edit | undefined {
  return session.target.redo(session);
}

/** `startSession(Target) → EditSession` */
export function startSession(target: Target, client: string): EditSession {
  return target.startSession(client);
}

function opposite(kind: EditKind): EditKind {
  return kind === "addition" ? "removal" : kind === "removal" ? "addition" : "change";
}

/** What `named` and `delta` touch, without values (names, bounds), which are not Elements. */
function elements(graph: Graph, named: readonly string[], delta: Delta): string[] {
  const entities = new Map<string, string>();
  for (const change of delta) if (change.op === "add" || change.op === "remove") entities.set(change.id, change.entity);
  const entity = (id: string) => entities.get(id) ?? (graph.has(id) ? graph.get(id).entity : undefined);
  const touched = new Set(named);
  for (const change of delta) {
    const ids = "id" in change ? [change.id] : [change.a, change.b];
    for (const id of ids) if (!VALUES.has(entity(id) ?? "")) touched.add(id);
  }
  return [...touched];
}
