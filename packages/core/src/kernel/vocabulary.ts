/**
 * A Language's vocabulary, as the kernel sees it: Entities, what each extends, and
 * Relationships as pairs of named ends with ranges. It answers two questions — from an
 * Entity, where does an end name lead, and does one Entity extend another — which is all
 * navigation, the logic and the diagnoser need. An Entity reaches the ends of every Entity
 * it extends, since each of its instances is an instance of those too.
 */

export interface EndSpec {
  /** `null` is an unnamed end: it cannot be navigated to. */
  readonly name: string | null;
  readonly entity: string;
  readonly min: number;
  /** `null` is unbounded (N). */
  readonly max: number | null;
}

export interface RelationshipSpec {
  readonly id: string;
  readonly ends: readonly EndSpec[];
}

export interface AxiomSpec {
  readonly language: string;
  readonly id: string;
  readonly about: string;
  readonly formula: string;
}

export interface VocabularySpec {
  readonly entities: readonly string[];
  readonly relationships: readonly RelationshipSpec[];
  readonly axioms: readonly AxiomSpec[];
  /** Entity → the Entities it extends directly. */
  readonly extends?: Readonly<Record<string, readonly string[]>>;
}

/** Navigating from an Entity to the far end of a Relationship. */
export interface Step {
  readonly relationship: RelationshipSpec;
  /** Index of the far end in `relationship.ends`; the near end is the other one. */
  readonly far: 0 | 1;
  readonly end: EndSpec;
}

export class Vocabulary {
  readonly entities: ReadonlySet<string>;
  private readonly steps = new Map<string, Map<string, Step[]>>();
  private readonly byId = new Map<string, RelationshipSpec>();
  private readonly ancestors = new Map<string, Set<string>>();
  private readonly inherited = new Map<string, Map<string, Step[]>>();

  constructor(readonly spec: VocabularySpec) {
    this.entities = new Set(spec.entities);
    for (const relationship of spec.relationships) {
      this.byId.set(relationship.id, relationship);
      const [a, b] = relationship.ends;
      if (!a || !b) continue;
      this.addStep(a.entity, { relationship, far: 1, end: b });
      this.addStep(b.entity, { relationship, far: 0, end: a });
    }
  }

  private addStep(entity: string, step: Step): void {
    if (step.end.name === null) return;
    let table = this.steps.get(entity);
    if (!table) this.steps.set(entity, (table = new Map()));
    const existing = table.get(step.end.name);
    if (existing) existing.push(step);
    else table.set(step.end.name, [step]);
  }

  relationship(id: string): RelationshipSpec | undefined {
    return this.byId.get(id);
  }

  /** `entity` and every Entity it extends, eventually: `entity.*extends`. */
  conformsTo(entity: string): ReadonlySet<string> {
    let known = this.ancestors.get(entity);
    if (known) return known;
    known = new Set();
    const pending = [entity];
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (known.has(current)) continue;
      known.add(current);
      pending.push(...(this.spec.extends?.[current] ?? []));
    }
    this.ancestors.set(entity, known);
    return known;
  }

  /** Whether every instance of `entity` is an instance of `other`. */
  conforms(entity: string, other: string): boolean {
    return this.conformsTo(entity).has(other);
  }

  /** Where `endName` leads from `entity`, if it leads anywhere unambiguously. */
  step(entity: string, endName: string): Step | undefined {
    const steps = this.reachable(entity).get(endName);
    return steps && steps.length === 1 ? steps[0] : undefined;
  }

  /** Every end reachable from `entity` or what it extends, by name; more than one step under a name is ambiguous. */
  reachable(entity: string): ReadonlyMap<string, readonly Step[]> {
    if (!this.spec.extends) return this.steps.get(entity) ?? new Map();
    let merged = this.inherited.get(entity);
    if (merged) return merged;
    merged = new Map();
    for (const ancestor of this.conformsTo(entity)) {
      for (const [name, steps] of this.steps.get(ancestor) ?? []) merged.set(name, [...(merged.get(name) ?? []), ...steps]);
    }
    this.inherited.set(entity, merged);
    return merged;
  }
}
