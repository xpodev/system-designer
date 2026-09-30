/**
 * The Tool Language (docs/tool-design.md): Systems as the tool keeps them, and the contexts
 * they are open in. A Tool::System is a design — a Contexts::System — plus attachments the
 * tool carries without interpreting. A SystemContext is a System open in the tool, the unit
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

/** `new() → SystemContext`: an empty, well-formed System. */
export function newSystem(name = "Untitled", id = "system"): SystemContext {
  const design = coreGraph();
  design.add("System", id);
  setName(design, id, name);
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
