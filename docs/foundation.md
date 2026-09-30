# Mathematical Foundation

This is **Systemathic**: the formal model underneath the tool. It defines what the
primitives are, how they relate, and what a well-formed model must satisfy. It is
independent of any implementation — types, storage, UI and encodings are all just one
way of realizing it.

The model exists so that a design's **cross-domain coherence** can be checked:

1. **Self-containment.** Each Domain is self-contained in its context, including what
   it references.
2. **Direction.** Everything that crosses Domains does so explicitly, and in the
   appropriate direction.

It is not a programming language, and it does not prove that anything is internally
consistent or correctly implemented. It does not model how things are wired together:
it is about decoupling, and mechanisms of coupling, such as dependency injection, are
out of its scope.

Systemathic is three parts, kept separate, each built only on the ones before it:

| Part | Responsibility | Realized as |
|------|----------------|-------------|
| **Core** | The kernel — the only axioms — and the Systemathic Language written in it: the vocabulary every System is made of. | `systemathic.core` |
| **Standard concepts** | Terms defined on top of the core: purity, actions, projections, abstractness, stacks, standard rules, … | `systemathic.std` |
| **Scripts** | Everything that checks anything: **verifying** a design against a chosen profile of rules, and **validating** an implementation against a verified design. Not a feature of the tool itself. | Python scripts |

Separately from the tool, a **library** (`systemathic.lib`) provides ordinary Languages
for common vocabularies: numbers, text, optional, … It is content, not part of the
tool.

## Levels

Everything in Systemathic sits at one of three levels. Each level is made of instances
of the one above it.

| Level | Contains | Example |
|-------|----------|---------|
| **Kernel** | Language, Entity, Relationship, and the logic | the axioms; they describe themselves |
| **Systemathic Language** | Entities `System`, `Domain`, `Entity`, `Interaction`, … and the Relationships between them | an Interaction has Parameters, each of some Entity |
| **Model** | Instances of the Systemathic Language: a user's design | `Attack` is an Interaction; its Parameters are of Entities `Attacker` and `Targetable` |

A model never needs "entity types": `Attacker` *is* an instance of the Entity named
`Entity`, one level up. Keeping the levels apart is what keeps self-description
harmless. The kernel is the one fixed point: it can describe itself, but not define
itself.

---

# Part I — Core

## The kernel

The kernel is the only thing not defined in terms of anything else.

### Language

A **Language** is a closed vocabulary at one level of abstraction: a set of Entities and
the Relationships between them. `Level(x)` denotes the Language `x` belongs to.

**Closure.** Nothing in a Language references anything outside it: both ends of every
Relationship are Entities of the same Language. The only structure that touches two
Languages is a Transformation (see *The Systemathic Language*).

### Entity

An **Entity** is a kind of thing, belonging to exactly one Language. It has no intrinsic
attributes: everything that defines it is expressed through its Relationships. There is
no inheritance. Two instances are equal iff they are the same instance.

### Relationship

A **Relationship** is a pair of **ends**. A Relationship itself has no name; its ends
do. Each end has:

- a **name**, used to navigate to it;
- an **Entity**;
- a **range** `min..max`, with `min ∈ ℕ` and `max ∈ ℕ ∪ {N}` (`N` is unbounded): how
  many instances of that end's Entity each instance at the other end is linked to.

```
Order <——> OrderLine
  end "order": Order,     1..1    each OrderLine has exactly one order
  end "lines": OrderLine, 1..N    each Order has one or more lines
```

From an instance, navigating by an end's name gives the linked instances at that end:
`o.lines`, `l.order`. The same reading applies when both ends are the same Entity, and
the names give the direction: `Parameter <——> Parameter` with ends `prev` and `next`.

- A range is **well-formed** iff `max = N` or `min ≤ max`.
- Any number of Relationships may join the same pair of Entities; they are told apart
  by their end names.
- **End names are unique per Entity:** from any Entity, the ends reachable across its
  Relationships have distinct names, so navigation is never ambiguous.

### The logic

Every formula is a formula of **first-order logic with transitive closure**, over a
single Language's vocabulary:

| Symbol | ASCII   | Meaning                                        |
|--------|---------|------------------------------------------------|
| `∀`    | `all`   | for all                                        |
| `∃`    | `some`  | there exists                                   |
| `→`    | `=>`    | implies                                        |
| `∧`    | `and`   | and                                            |
| `∨`    | `or`    | or                                             |
| `¬`    | `not`   | not                                            |
| `=`    | `==`    | identity                                       |
| `≠`    | `!=`    | non-identity                                   |
| `∈`    | `in`    | membership                                     |
| `x.e`  | `x.e`   | the instances linked to `x` through end `e`    |
| `x.^e` | `x.^e`  | reachable through one or more `e` steps        |
| `x.*e` | `x.*e`  | `x` itself, or reachable through `e` steps     |

Variables range over the instances of an Entity (`∀m ∈ Monster. …`). `=` is identity,
always. A formula is **well-formed** in `L` iff every Entity and end it mentions belongs
to `L`.

Formulas are evaluated on finite models — which is always possible, and always
terminates. Whether a formula holds for every possible model is never the tool's
concern.

## The Systemathic Language

The Systemathic Language is written in the kernel: every concept below is an Entity,
related to the others by Relationships. A System — a user's design — is a model of it.
Its full definition, as data, is [`schema/systemathic.json`](../schema/systemathic.json).

```
System ─┬─ languages ──▶ Language ─┬─ entities ──────▶ Entity
        │                          ├─ relationships ─▶ Relationship ── ends ──▶ End ── entity ──▶ Entity
        │                          ├─ interactions ──▶ Interaction ─┬─ parameters ─▶ Parameter ── type ──▶ Entity
        │                          │                                └─ output ─────▶ Entity
        │                          └─ axioms ────────▶ Formula
        ├─ domains ────▶ Domain ───┬─ languages ─────▶ Language
        │                          ├─ references ────▶ Domain
        │                          └─ transformations ▶ Transformation ─┬─ source, target ──▶ Language
        │                                                              ├─ mappings ────────▶ Mapping
        │                                                              └─ reverse ─────────▶ Reverse
        └─ mediations ─▶ Mediation ── what, how, mediator ──▶ Domain
```

It contains its own `Language`, `Entity`, `Relationship` and `End`: this is the kernel
describing itself. Names (of end, Entity, Language, Domain, …) are instances of its own
`Name` Entity, and range bounds of its own `Bound` Entity; how they are spelled or
encoded is a mediation, like any other representation.

### System

A **System** is the whole of what is being modelled: its Languages, its Domains and its
Mediations. It is the only standalone unit — the thing that is opened and saved.
Nothing references anything outside its System.

The System is not a Domain. It has no mediators; it is the ultimate goal that its
Domains together describe.

### Interaction

An **Interaction** is an operation in one Language: an ordered list of **Parameters**,
each of some Entity, and an **output** Entity, all in that Language. It is a signature
only; its meaning comes from axioms. Interactions are **always pure**: they happen at one
level of abstraction. Anything that crosses levels is a Transformation.

Order is expressed without an "ordered" primitive, by linking the Parameters:

```
Interaction <——> Parameter    ends: interaction 1..1,  parameters 0..N
Interaction <——> Parameter    ends: firstOf 0..1,      first 0..1
Parameter   <——> Parameter    ends: prev 0..1,         next 0..1
Parameter   <——> Entity       ends: parameters 0..N,   type 1..1
Interaction <——> Entity       ends: producers 0..N,    output 1..1
```

`Attack(Attacker, Targetable)` is an Interaction whose `first` Parameter has type
`Attacker` and whose `next` has type `Targetable`. Realizations use their natural form:
the Python library exposes `attack.parameters` as a plain list. That is a mediation
`Systemathic / Python`, and its round trip holds.

### Axioms

A Language's **axioms** are well-formed formulas over it. They state what is always
true, and they are the only place an Interaction gets meaning:

```
∀a, b, c ∈ Money.          a ≥ b ∧ b ≥ c → a ≥ c
∀m ∈ Monster, h ∈ Health.  health(heal(m, h)) = health(m) + h
```

Axioms are **assumed** to hold for every instance. The tool checks only that they are
well-formed; holding them true is the implementer's obligation. Axioms describe what is
always true, not sequences of changes. Where a lifecycle matters to the design, it is
modelled as vocabulary: an `OrderLifecycle` Language with `Placed` and `Cancelled`,
projected from the core.

### Domain

A **Domain** is a bounded context — a "what". It references Languages and other
Domains, and holds Transformations.

Referencing a Domain brings in everything that Domain brings in. The **effective
Languages** of `D` are its own plus, transitively, those of every Domain it references:

```
langs*(D) = (D.*references).languages
```

References are not ownership: two Domains referencing the same Language or Domain is
expected. A Language needs no Domain to be valid.

### Transformation

A **Transformation** `τ: L_src → L_tgt`, held by Domain `D`, with
`L_src, L_tgt ∈ langs*(D)`. It shows how the things of one Language appear in another.

A Transformation is a set of **mappings**:

- **Entity** `e ∈ L_src ↦` a set of Entities of `L_tgt` (one to many).
- **Relationship** `r ∈ L_src ↦` a set of Relationships of `L_tgt`, joining Entities in
  the images of `r`'s ends.
- **Interaction** `i ∈ L_src ↦` a term over `L_tgt`'s Interactions, whose inputs and
  output are in the images of `i`'s Parameters and output.

Mapping an Entity without mapping what defines it is meaningless: `Person.name : Name`
maps to `class Person { name: String }` only together with a mapping of `Name` to
`String`, which is lower-level than `Name`.

**Definition before use.** A mapping may reference only mapped things: a Relationship
mapping requires the Entities at both ends mapped; an Interaction mapping requires the
types of its Parameters and its output mapped. Otherwise a Transformation need not map
everything.

#### Reverse

Semantically, `τ` is a correspondence between instances of `L_src` and `L_tgt`,
maintained by `D`. A Transformation may have a **partial** reverse

```
ρ: Tgt ⇀ Src
```

which must satisfy the **round-trip law** — being able to reconstruct the original is
the point of thinking at the higher level at all:

```
∀x ∈ Src. ρ(τ(x)) ≈ x
```

`≈` is **observational equivalence** in `L_src`: two instances are equivalent iff
nothing the Language can express tells them apart. Formally, `≈` is the largest
relation such that `x ≈ y` implies:

- `x` and `y` are instances of the same Entity;
- for every end reachable from their Entity, each instance `x` reaches through it has
  an equivalent instance `y` reaches through it, and vice versa;
- every Interaction applied to pairwise-equivalent arguments gives equivalent results.

Identity implies equivalence. The law thus says: the representation must preserve
everything the higher Language can observe. The lower representation need not hold all
of it on its own; the Domain may hold **context** that completes it:

- **By value** (serialization): the correspondence is computed; `Tgt` encodes
  everything. Decoding creates a new instance, so identity does not survive the round
  trip, but equivalence does.
- **By reference** (an ID sent to a client, resolved by a server-side lookup): the
  correspondence is stored by `D` as context. Identity survives.

`ρ` is partial: a crafted packet, corrupted bytes or an unknown ID has no preimage, and
neither does a well-formed encoding of something that violates `L_src`'s axioms. Such a
failure is a property of the Transformation, and so of the Domain that holds it. It is
not an Entity of either Language: no `Optional⟨Monster⟩` is introduced into the higher
Language. Handling it is part of the "how".

### Mediation

A **Mediation** `D₁ /ₘ D₂` reads "D₁ over D₂": the "what" of `D₁` carried out by the
"how" of `D₂`, as in IP over Avian Carriers. It relates three Domains — `what = D₁`,
`how = D₂`, `mediator = m` — and is **witnessed** by `m` holding a Transformation
`τ: L₁ → L₂` with a reverse, where `L₁ ∈ langs*(D₁)` and `L₂ ∈ langs*(D₂)`.

A Mediation is declared, not inferred, because it records intent: which "what" is
carried out over which "how". `D₁ / D₂` can be written only if a mediator exists. It
need not be unique — `Game / Network` can send a Monster by ID or by value — and when it
is, `D₁ / D₂` names it.

## Well-formedness

The axioms of the Systemathic Language. A System is **well-formed** iff it satisfies
them; the tool evaluates them on the System, which is a finite model.

| #  | Condition |
|----|-----------|
| W1 | **Closure.** Both ends of every Relationship, the types of every Interaction's Parameters and its output, and every symbol of every formula of `L`, belong to `L`. |
| W2 | **Ranges.** Every range is well-formed. |
| W3 | **End names.** From every Entity, the ends reachable across its Relationships have distinct names. |
| W4 | **Transformation scope.** For `τ: L_src → L_tgt` held by `D`: `L_src, L_tgt ∈ langs*(D)`. |
| W5 | **Definition before use.** Every mapping references only mapped things. |
| W6 | **Witness.** Every Mediation is witnessed by its mediator. |

## Obligations

Some conditions are part of what the definitions mean, but concern the implementation
rather than the design. The tool never checks them. They are stated in exported
specifications for an implementer (human or LLM) to satisfy.

| #  | Obligation |
|----|------------|
| O1 | **Validity.** Every instance satisfies its Language's ranges and axioms. |
| O2 | **Round trip.** Every reverse satisfies the round-trip law. |
| O3 | **Preservation.** Every Transformation preserves the axioms of `L_src`: each, translated through it, holds in `L_tgt`. |

## Deletion

Ownership lives with the Language, so deletion is asymmetric.

- **Deleting a Language** cascades: its Entities, Relationships, Interactions and
  Axioms; every mapping, in any Transformation, that names any of them; every
  Transformation from or to it, and every Mediation that Transformation witnessed; and
  every reference to it from a Domain.
- **Deleting a Domain** removes its Transformations, every Mediation naming it in any
  role, and every reference to it from another Domain. It is not purely local: a Domain
  that referenced it loses the Languages it inherited, so every Transformation that
  falls out of scope as a result is removed too, and then every Mediation left with no
  witness. No Language or Entity is deleted.

---

# Part II — Standard concepts

Everything in this part is defined in terms of the core. None of it is needed for the
core to mean anything.

## How the core is extended

A Language is extended without changing it: define a separate **extension Language**
holding only the new part, and a Domain referencing both, with a Transformation from
the extended Language into the extension. Consumers choose to use the original, the
extension, or both. Identity stays in the original; functionality lives in the
extension.

The standard concepts extend the Systemathic Language the same way: an extension
Language (an `Action` with its primary Parameter, a comparison designated for an Entity,
a deferred mapping, …), and a Domain holding the Transformation between them.
`from systemathic.core import *` and `from systemathic.std import *` together are a
consumer that chose both.

## Domains

- **Standalone:** a Domain that references no other Domain.
- **Pure:** `|langs*(D)| = 1`, a Domain defined entirely in terms of one Language.

## Interactions

- **Action:** an Interaction with a **primary** Parameter, its active input
  (`order.cancel()` rather than `transfer(from, to, amount)`):

  ```
  Interaction <——> Parameter    ends: primaryOf 0..1,  primary 0..1
  axiom: ∀i ∈ Interaction. i.primary ⊆ i.parameters
  ```

- **Uninterpreted:** an Interaction no axiom constrains — meaningful from the outside,
  uninterpreted on the inside.
- **Deferred:** an item a mediation deliberately leaves unmapped. Unlike an ordinary
  gap, it is intentional; like one, it is present in exported specifications.
- **Comparison:** an Interaction designated as a Language's own notion of sameness for
  an Entity, coarser than observational equivalence.

## Abstractness

- **Abstract Language:** a Language that is never the "how" side of a Mediation — for
  every Mediation witnessed by `τ: L₁ → L₂`, `L ≠ L₂`. An abstract Language may be used
  by any number of Domains; what it cannot be is replaceable.
- **Abstract Domain:** a Domain all of whose Languages, `langs*(D)`, are abstract.

Abstractness separates a System's stable contract — the vocabularies nothing can swap
out — from its implementation vocabularies. It is a property of how a Language is used
in a System, not of the Language itself: `Unity` is not abstract in `Game / Unity`,
even though it is the "what" of `Unity / Windows`.

## Composition

Composite Entities are built from Relationships.

- **Attribute / product** (has-a): an Entity with `1..1` ends to each of its parts. "A
  Person has a Name" is a Relationship, not a field.
- **Sum** (one-of): `S = V₁ | … | Vₖ` is a Relationship from `S` to each `Vᵢ` with an
  end `vᵢ` of range `0..1`, plus the axiom that every `S` has exactly one:

  ```
  ∀s ∈ S. ⋁ᵢ ( some s.vᵢ  ∧  ⋀_{j≠i} no s.vⱼ )
  ```

  A `Circle` is not a `Shape`; a `Shape` holds a `Circle`.

## Projection and mediation

A Transformation's **kind** follows from whether it has a reverse:

- A **projection** has none. It is one-way and sideways: a contextual view of an
  identity, from core to context.
- A **mediation** has one. It is two-way and downward: how a "what" is carried out by a
  "how". Only mediations can witness Mediations.

### Projection

The same identity looks different in different contexts. A Monster, in the context of
networking, is a `SyncedEntity`; in the context of combat, it is `Targetable` and an
`Attacker`. These are not lower-level representations but **contextual views**.

The purest **core** Domain defines only identities and their vital relationships. It is
extended by projections, exactly as in *How the core is extended*:

```
Combat:  π(Monster) = { Targetable, Attacker }
Network: π(Monster) = { SyncedEntity }
```

The context knows the core; the core knows no context. A view needs no reverse, because
it *is* that identity, seen in context. A projection could formally be read as a
Mediation (the context "carrying out" the core), but that invites the wrong intuition
that the context is how the core is implemented.

### Mediation structure

- **Top Domains:** the Domains that are not the "how" of any Mediation. They are the
  "how" of the System itself. Ideally they alone would describe the System fully; in
  practice higher-level intents must be carried out by lower-level realities.
- **Stacks:** every Domain is a "what", including one serving as a "how", so Mediations
  stack: `Game / Unity / Windows`. Where the stack stops is a choice of how tightly the
  model constrains the real system. Transformations compose down a stack, and each
  reverse's failures stay in the mediator where they arise.
- **The mediation graph:** Domains and Mediations form a directed graph from what to
  how. It is a DAG, not a tree: a Domain may be carried out over several Domains, and
  several over a shared one (`Unity / Windows`, `Network / Windows`).
- **Opacity:** in `D₁ /ₘ D₂` via `τ: L₁ → L₂`, ideally `L₂ ∉ langs*(D₁)` and
  `L₁ ∉ langs*(D₂)`: the what does not know how it is carried out, and the how does not
  know what it is carrying. Only the mediator knows both.
- **Two swaps**, both leaving `D₁` untouched: change the how (`Game / Unity →
  Game / Godot`, necessarily a new mediator), or change the mapping (by-ID → by-value
  over `Network`, the mediator only).

In a full System both kinds combine. The core is projected sideways into contexts, and
each context is mediated downward on its own:

```
            Core
          π ↙    ↘ π
     Combat        Network
        /              /
      Unity         Transport
```

A Monster then has several views (`Targetable`, `SyncedEntity`) and several
representations (a Unity GameObject, a network ID), all of the same identity.

## Generic Languages

A **Generic Language** `G⟨P₁ … Pₙ⟩` is a template parameterized by Entities.
Instantiating it with Entities `X₁ … Xₙ`, all of one Language, expands into ordinary
Entities, Relationships, Interactions and axioms **in that Language**:

```
Level(G⟨X₁ … Xₙ⟩) = Level(X₁) = … = Level(Xₙ)
```

So `Level(Optional⟨Monster⟩) = Level(Monster) ≠ Level(Optional⟨Byte⟩)`. A Transformation
lifts through a generic: `τ` induces `G⟨τ⟩: G⟨X⟩ → G⟨τ(X)⟩`.

`Optional`, `Result` and similar are generic. A Language instantiates one only for
failure or absence meaningful at its own level (a player may have no target). Failures
of how a level is carried out belong to the mediator.

---

# Part III — Library

`systemathic.lib` holds ordinary Languages (numbers, text, bytes, …) and generics
(optional, result, …) for common vocabularies. They have no special status. A System
brings them in by Domain reference, and a Language reaches them only through
Transformations, because they are lower-level *representations*: `Money` is not a
number; a number is one way to represent it.

---

# Part IV — Scripts

The tool builds and exports Systems; it checks nothing itself. Checking is done by
scripts over a System:

- **Verification** checks a design against rules: good practice, house style, a
  particular System's design rules.
- **Validation** checks an implementation against a verified design.

This part describes verification; validation of implementation artifacts is future
work, built on the same model.

A **verification script** reads a System and reports violations. It is Python, and always
starts from the core and standard concepts:

```py
from systemathic.core import *
from systemathic.std import *

GAME_CORE = "Game Core"

@rule(severity=ERROR)
def core_is_pure(system: System):
    core = system.domain(GAME_CORE)
    if not pure(core) or langs(core) != {system.language(GAME_CORE)}:
        yield Violation(core, "Game Core must be defined purely in its own terms")

@rule(severity=ERROR)
def core_is_abstract(system: System):
    core = system.domain(GAME_CORE)
    if not abstract(core):
        yield Violation(core, "Game Core must never be an implementation detail")

profile = Profile(core_is_pure, core_is_abstract, opacity, mediation_acyclic)
```

- A **rule** yields violations, each naming the offending element, rather than failing
  on the first assertion.
- A **profile** is the set of rules a System is checked against. Each rule has a
  severity: error or warning.
- Lookups by name (`system.domain("…")`) raise if the name is missing or ambiguous; the
  foundation does not require names to be unique.
- Constructing the `System` object from a saved file is a deserializer — itself a
  mediation, `Systemathic / JSON`.

**Formulas become Python.** The formulas inside Languages stay first-order logic. When a
System is loaded into a script, they are translated into Python predicates.
The translation is a mediation `Formula / Python`, and it needs its reverse: a failing
predicate is reported as the formula it came from, in design terms.

Verification scripts, profiles and formulas are all exported with the model, so a
System's design rules reach an implementer as precisely as the System itself.

## Standard rules

`systemathic.std` provides common rules to include in a profile:

| Rule | Checks | Default severity |
|------|--------|------------------|
| `opacity` | Every Mediation is opaque (see *Mediation structure*). | Error |
| `mediation_acyclic` | No Domain is carried out, eventually, over itself. | Error |
| `projection_acyclic` | No Language is projected, eventually, into itself. | Error |
| `domain_refs_acyclic` | No Domain references itself, eventually. | Error |
| `generic_level` | All arguments of a generic instantiation belong to one Language. | Error |
| `pure_domain_transformation` | A pure Domain holds no Transformation. | Warning |
| `wide_mediator` | A mediator references at most two Languages. | Warning |
| `top_domains_abstract` | Every top Domain is abstract. | Error |
| `completeness` | Every item of a mediation's `L_src` is mapped or deferred. | Warning |

---

# Out of scope

- **Internal consistency.** The tool does not prove that a Language's axioms can hold
  together, or that an implementation satisfies them.
- **Behaviour over time.** There are no pre/postconditions, states or transitions.
  Axioms say what is always true; lifecycles that matter are modelled as vocabulary.
- **Wiring.** How mediators and implementations are constructed and connected
  (dependency injection, containers, lifetimes) is coupling mechanics, not design.
- **Deployment.** Machines, networks and reachability are not special. They are
  Entities of a deployment Language, carried like any other — typically the bottom of a
  stack (`Game / Unity / Windows`).
