/**
 * A Language's vocabulary, as the kernel sees it: Entities, and Relationships as pairs of
 * named ends with ranges. It answers one question — from an Entity, where does an end name
 * lead — which is all navigation, the logic and the diagnoser need.
 */

export interface EndSpec {
  readonly name: string;
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
    let table = this.steps.get(entity);
    if (!table) this.steps.set(entity, (table = new Map()));
    const existing = table.get(step.end.name);
    if (existing) existing.push(step);
    else table.set(step.end.name, [step]);
  }

  relationship(id: string): RelationshipSpec | undefined {
    return this.byId.get(id);
  }

  /** Where `endName` leads from `entity`, if it leads anywhere unambiguously. */
  step(entity: string, endName: string): Step | undefined {
    const steps = this.steps.get(entity)?.get(endName);
    return steps && steps.length === 1 ? steps[0] : undefined;
  }

  /** Every end reachable from `entity`, by name; more than one step under a name is ambiguous. */
  reachable(entity: string): ReadonlyMap<string, readonly Step[]> {
    return this.steps.get(entity) ?? new Map();
  }
}
