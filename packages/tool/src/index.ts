/**
 * Systems as the tool keeps them, and the contexts they are open in. A stored System is a
 * design — a model of the core Languages — plus attachments: what the tool keeps about it
 * outside the core (descriptions, Configurations, layout), each with its owner. A SystemContext is a System open in the tool, the unit
 * everything else works on.
 */
import { coreGraph, setName, type Graph } from "@systemathic/core";

export interface Attachment {
  /** Who the attachment belongs to: a client, a feature. The tool never interprets `data`. */
  readonly owner: string;
  readonly data: unknown;
}

/** A System as the tool stores it. */
export interface ToolSystem {
  readonly design: Graph;
  readonly attachments: readonly Attachment[];
}

export class SystemContext {
  private readonly attached: Attachment[];

  constructor(readonly design: Graph, attachments: readonly Attachment[] = []) {
    this.attached = [...attachments];
  }

  get attachments(): readonly Attachment[] {
    return this.attached;
  }

  /** The design's System instance, if it has one. */
  get system(): string | undefined {
    return this.design.ofEntity("System")[0];
  }

  /** The System's root Component, if it has one. */
  get root(): string | undefined {
    const system = this.system;
    return system === undefined ? undefined : this.design.navigate(system, "root")[0];
  }

  attach(attachment: Attachment): this {
    this.attached.push(attachment);
    return this;
  }

  detach(attachment: Attachment): this {
    const index = this.attached.indexOf(attachment);
    if (index >= 0) this.attached.splice(index, 1);
    return this;
  }
}

/**
 * A provider of one kind of metadata about Systems (Metadata Provider). Where it keeps its
 * metadata is its own business: in its attachment, which is stored with the design and read by
 * no one else, or anywhere it likes. The Workspace asks every provider when a System is opened
 * and when it is saved; neither knows the other. A location is where the System is stored, if
 * anywhere.
 */
export interface MetadataProvider {
  /** Loads its metadata into `context`, a System just opened from `location`. */
  load(context: SystemContext, location: string | undefined): Promise<void>;
  /** Saves its metadata for `system`, a copy of an open System about to be stored at `location`: into its attachment there, or elsewhere. */
  save(system: SystemContext, location: string | undefined): Promise<void>;
}

/** What could not be followed in a stored System: where, and why. It is reported, not refused. */
export interface StorageProblem {
  readonly at: string;
  readonly message: string;
}

/** What is stored at a location is not a System at all. */
export class NotASystem extends Error {}

/**
 * Where Systems are stored (Repository). It stores the design, with the attachments as they
 * are, reading none of them: what is in them is each Metadata Provider's business. A location
 * is the Repository's own: a path, a key, …
 */
export interface Repository {
  /** The one form two names of the same location share. */
  resolve(location: string): string;
  /** The System stored at `location`, and what could not be followed in it; undefined if nothing is stored there. Throws NotASystem if what is there is not one. */
  open(location: string): Promise<{ system: ToolSystem; problems: readonly StorageProblem[] } | undefined>;
  /** Stores `system` at `location`, and gives back where it was stored. */
  save(system: ToolSystem, location: string): Promise<string>;
}

/** `new() → SystemContext`: an empty, well-formed System: a System and its root Component, of one name. */
export function newSystem(name = "Untitled", id = "system"): SystemContext {
  const design = coreGraph();
  design.add("System", id);
  setName(design, id, name);
  const root = `${id}.root`;
  design.add("Component", root);
  setName(design, root, name);
  design.connect(id, "root", root);
  return new SystemContext(design);
}

/** `open(System) → SystemContext`. The context has its own copy; the stored System is untouched. */
export function open(system: ToolSystem): SystemContext {
  return new SystemContext(system.design.clone(), system.attachments);
}

/** `save(SystemContext) → System`. */
export function save(context: SystemContext): ToolSystem {
  return { design: context.design.clone(), attachments: [...context.attachments] };
}

/** `attach(SystemContext, Attachment) → SystemContext`. */
export function attach(context: SystemContext, attachment: Attachment): SystemContext {
  return context.attach(attachment);
}

/** `detach(SystemContext, Attachment) → SystemContext`. */
export function detach(context: SystemContext, attachment: Attachment): SystemContext {
  return context.detach(attachment);
}
