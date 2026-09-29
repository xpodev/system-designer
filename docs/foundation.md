# Mathematical Foundation

This is the formal model underneath the tool: what the primitives are, how they relate,
and what structural laws a valid model must satisfy. It is deliberately independent of
any particular implementation — types, storage, UI — which are just one way of
realizing the definitions below.

## Primitives

```
                    Project
                       |
        +--------------+--------------+
        |              |              |
    Language (L)    Domain (D)   Mediation (A/M)
   E_L, I_L        refs ⊆ L, T_D   intent/mediator/impl
        |              |
   +----+----+     Transformation (τ)
   |         |      L_A -> L_M
 Entity  Interaction
  (E)       (I)
   |
 +-+-----------+
 |             |
Relationship  Action
 (R)          (Act)
```

A **Project** is the whole of what's being modelled: the complete set of Languages that
exist, the Domains defined over them, and the Mediations between Domains.

## Language

A **Language** `L = (E_L, I_L)` is a closed vocabulary: a set of Entities `E_L` and a
set of Interactions `I_L` defined purely in terms of each other. A Language does not
reference anything outside itself — that closure is what makes "this vocabulary" a
meaningful, checkable unit at all.

Languages are **top-level and shared**. They are not owned by, or nested inside, any
other structure. This is a deliberate correction to an earlier version of this model,
in which a Domain owned the Languages it used — which made it impossible for two
Domains to legitimately share one. The corrected relationship is a reference, covered
below.

### Entity

An Entity `e ∈ E_L` belongs to exactly one Language, `L`. It carries:

- a set of **Relationships** `R_e`, each relating `e` to some other Entity (possibly in
  a different Language);
- a set of **Actions** `A_e`, each an operation owned by `e`.

### Relationship

A Relationship `r = (target, [min, max], constraints)`:

- `target` is the Entity `r` relates to.
- `[min, max]` is a cardinality bound. `min ≥ 0`. By convention, `max = 0` denotes
  **unbounded** ("many") rather than "exactly zero" — there is no separate sentinel for
  unbounded, so the tuple's own zero fills that role. A bound is well-formed when
  `min ≥ 0` and either `max` is unbounded or `min ≤ max`.
- `constraints` is a set of predicates evaluated against `{ self: e, child: target }`.
  A predicate must both be evaluable (every path it references must resolve) and hold.

### Action

An Action `act ∈ A_e`, owned by entity `e ∈ E_L`, has input types and an output type,
each referencing some Entity. **Purity**: every type an Action references must belong
to the same Language `L` as the Action itself. An Action that references an Entity from
a different Language is leaking identity across a vocabulary boundary — the one thing
a Language's closure is supposed to prevent.

### Interaction

An Interaction `i = (L_in, L_out, inputs, output)` connects an input Language to an
output Language: `inputs` are Entities in `L_in`, `output` is an Entity in `L_out`. An
Interaction is **pure** iff `L_in = L_out` — it stays inside one vocabulary. An impure
Interaction is a deliberate, explicit crossing from one Language into another.

## Domain

A **Domain** `D = (refs(D), T_D)` is a bounded context: a set of references to
Languages, `refs(D) ⊆ 𝕃` (the universe of all Languages in the Project), and a set of
Transformations `T_D` between Languages it references. A Domain is **pure** iff
`|refs(D)| = 1`.

Critically, `refs` is a reference, not ownership: `refs(D₁) ∩ refs(D₂) ≠ ∅` is not just
permitted but expected — the same Language is routinely used from more than one Domain.
Removing a Domain removes its references and its own Transformations; it never removes
a Language, since the Language may still be referenced elsewhere (or exist
independently of any Domain at all — a Language needs no Domain to be valid).

### Transformation (τ)

A Transformation `τ: L_A → L_M`, held by some Domain, is a structured mapping from
`L_A`'s Entities and Interactions into subgraphs of `L_M`'s. It is **complete** when
every Entity in `L_A` has a mapping; an unmapped Entity is a named gap, not a silent
one.

## Mediation (A / M)

A **Mediation** binds an intent Domain `A` to an executor Domain `M` via an
**implementation Domain**, the one whose Transformations actually carry `A`'s Language
into `M`'s. Formally: `Mediation = (intent: DomainId, mediator: DomainId, impl:
DomainId)`, where `impl`'s Transformations translate between a Language `A` references
and a Language `M` references.

The point of naming this as its own structure, rather than leaving it implicit, is that
the same intent can be re-mediated — a different implementation Domain, a different
executor — without touching `A` at all. The intent and its execution are only ever
connected through this explicit, swappable middle term.

## Structural laws

A Project is valid exactly when these hold:

1. **Purity.** For every Action `act` owned by an Entity in Language `L`: every type
   `act` references belongs to `L`.
2. **Alignment.** For every Interaction `i = (L_in, L_out, …)`: both `L_in` and `L_out`
   exist, and some Domain `D` has `{L_in, L_out} ⊆ refs(D)`. (Under the ownership
   version of this model this read "both languages belong to the containing layer";
   under the reference version, "belonging to" becomes "referenced by the same Domain.")
3. **Translation completeness.** For every Transformation `τ: L_A → L_M` in some Domain:
   every Entity in `L_A` has a mapping under `τ`. (Treated as advisory, not fatal — an
   incomplete translation is a gap worth flagging, not necessarily an error.)
4. **Cardinality well-formedness.** For every Relationship: its bound is well-formed
   (see above), and each of its constraints both resolves and holds.

These four are what the model can check mechanically. They are not the only way a
model can be wrong, but they are the ones a machine can catch without understanding the
domain being modelled — which is exactly why they're worth enforcing automatically
rather than leaving to review.

## Deletion as a structural operation

Because Languages are shared, removing one is a cascading operation, not a local one:
every Entity it contained is removed, which in turn retracts every Relationship
elsewhere that targeted one of those Entities, every Interaction anywhere that
referenced one, and every Transformation mapping that named one — regardless of which
Domain, if any, was looking at them at the time. Removing a Domain, by contrast, is
local: it drops its own references and its own Transformations, and retracts any
Mediation that named it in any of its three roles, but it deletes no Language and no
Entity. The asymmetry follows directly from ownership living with the Language, not the
Domain.
