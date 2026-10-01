/**
 * A View (docs/tool-design.md, Perspectives): Items, with an outline's parent/children
 * structure, and Links between them, each Item about a Subject of the System. A Mark is a
 * Diagnostic on an Item. A View has no positions, sizes or colours: how it is drawn is the
 * business of the client that draws it.
 */
import type { Diagnostic, Severity } from "@systemathic/diagnoser";

export type Perspective = "outline" | "language" | "domain-map" | "mediation-stack" | "levels" | "diagnostics" | "statistics";

export interface Mark {
  readonly severity: Severity;
  readonly check: string;
  readonly message: string;
}

export interface Item {
  /** Unique in its View. */
  readonly id: string;
  /** The id of the Element the Item is about. */
  readonly subject: string;
  /** What kind of thing it is: the Subject's Entity, or a grouping such as `group`. */
  readonly kind: string;
  readonly label: string;
  /** More about it, in a line: a range, a signature, a formula. */
  readonly detail?: string;
  /** Where it sits in a stack or a hierarchy of levels, from 0 at the top, for Perspectives that have one. */
  readonly level?: number;
  readonly parent?: string;
  readonly children: readonly string[];
  readonly marks: readonly Mark[];
}

export interface Link {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly kind: string;
  readonly label?: string;
}

export interface View {
  readonly perspective: Perspective;
  readonly title: string;
  readonly items: readonly Item[];
  readonly links: readonly Link[];
}

interface MutableItem {
  id: string;
  subject: string;
  kind: string;
  label: string;
  detail?: string;
  level?: number;
  parent?: string;
  children: string[];
  marks: Mark[];
}

export interface ItemInput {
  readonly subject: string;
  readonly kind: string;
  readonly label: string;
  readonly detail?: string;
  readonly level?: number;
  /** Defaults to the subject; must be unique in the View. */
  readonly id?: string;
}

/** Builds a View; an Item's id defaults to its parent's id and its subject, so it is unique wherever it is. */
export class ViewBuilder {
  private readonly items = new Map<string, MutableItem>();
  private readonly links: Link[] = [];

  constructor(
    readonly perspective: Perspective,
    readonly title: string,
  ) {}

  item(input: ItemInput, parent?: string): string {
    const base = input.id ?? (parent === undefined ? input.subject : `${parent}/${input.subject}`);
    let id = base;
    for (let n = 2; this.items.has(id); n++) id = `${base}#${n}`;
    const item: MutableItem = { id, subject: input.subject, kind: input.kind, label: input.label, children: [], marks: [] };
    if (input.detail !== undefined) item.detail = input.detail;
    if (input.level !== undefined) item.level = input.level;
    if (parent !== undefined) {
      item.parent = parent;
      this.items.get(parent)?.children.push(id);
    }
    this.items.set(id, item);
    return id;
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  link(source: string, target: string, kind: string, label?: string): void {
    if (!this.items.has(source) || !this.items.has(target)) return;
    const link: Link = label === undefined ? { id: `l${this.links.length}`, source, target, kind } : { id: `l${this.links.length}`, source, target, kind, label };
    this.links.push(link);
  }

  /** `Diagnostic ↦ Mark`: marks every Item about a Subject of a Diagnostic. */
  mark(diagnostics: readonly Diagnostic[]): this {
    const bySubject = new Map<string, Mark[]>();
    for (const { severity, check, message, subjects } of diagnostics) {
      for (const subject of subjects) {
        const marks = bySubject.get(subject) ?? [];
        marks.push({ severity, check, message });
        bySubject.set(subject, marks);
      }
    }
    for (const item of this.items.values()) item.marks.push(...(bySubject.get(item.subject) ?? []));
    return this;
  }

  build(): View {
    return { perspective: this.perspective, title: this.title, items: [...this.items.values()], links: this.links };
  }
}
