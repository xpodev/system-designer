# Mathematical Foundation

This is **Systemathic**: the formal model underneath the tool. It defines what the
primitives are, how they relate, and what a well-formed model must satisfy. It is
independent of any implementation — types, storage, UI and encodings are all just one
way of realizing it.

The model exists so that a design's **coherence** can be checked:

1. **Self-containment.** Each Component is self-contained: it sees only the vocabulary
   its scope gives it, and only what it imports of what others export, never the inside of
   another Component that the other does not export.
2. **Explicit crossings.** Everything that crosses a level of abstraction does so through
   an explicit Transformation; everything that crosses between Components does so through
   an explicit import, connected in a Deployment, and mediated as far as the design says.

It is not a programming language, and it does not prove that anything is internally
consistent or correctly implemented. It shows boundaries and dependencies: which
Components exist, what they speak, what they depend on, and how they reach each other. It
never says how an operation is carried out or used — that is code — nor how
implementations are constructed and wired together, such as dependency injection.

Systemathic is three parts, kept separate, each built only on the ones before it:

| Part | Responsibility | Realized as |
|------|----------------|-------------|
| **Core** | The kernel — the only axioms — and the Systemathic Languages written in it: the vocabulary every System is made of. | `systemathic.core` |
| **Standard concepts** | Terms defined on top of the core: core Languages, contracts, interfaces, abstractness, stacks, standard rules, … | `systemathic.std` |
| **Scripts** | Everything that checks anything: **verifying** a design against a chosen profile of rules, and **validating** an implementation against a verified design. Not a feature of the tool itself. | Python scripts |

Separately from the tool, a **library** (`systemathic.lib`) provides ordinary Languages
and Mediations for common vocabularies and protocols: numbers, text, bytes, HTTP, TCP, …
It is content, not part of the tool.

## How a System is designed

The model follows the order in which a system is thought through:

1. **Core Languages** define the concepts: closed vocabularies with no dependencies, each
   at one level of abstraction. Moving between levels is a Transformation.
2. **Extensions** give them depth and refine them: Languages that build on others and add
   vocabulary.
3. **Components** give them implementation: each speaks some of those Languages, offers
   Interactions, exports what others may reach — its API — imports what it depends on,
   and is built, recursively, the same
   way — its own core Languages, extensions and Components, private to it. A Component
   may **implement** another: it is then an alternative to it, wherever it is placed.
4. **Deployments** say how a Component may be put together — it may have several
   options: which of its children exist side by side, how many of each, which of them
   each one's imports reach, and over which Mediations.

Which implementation fills each place, and which of its Deployments it runs as, is not the
design's: it is chosen when a System is put together to run, outside the core (the tool's
Configurations do it). What the system is for — the client's requirements — is not
modelled either. It is what the design as a whole realizes.

## Levels

Everything in Systemathic sits at one of three levels. Each level is made of instances
of the one above it.

| Level | Contains | Example |
|-------|----------|---------|
| **Kernel** | Language, Entity, Relationship, and the logic | the axioms; they describe themselves |
| **Systemathic Languages** | Entities `System`, `Component`, `Language`, `Entity`, `Interaction`, … and the Relationships between them, in layers | an Interaction has Parameters, each of some Entity |
| **Model** | Instances of the Systemathic Languages: a user's design | `attack` is an Interaction of the Server Component; its Parameters are of Entities `Attacker` and `Targetable` |

A model never needs "entity types": `Attacker` *is* an instance of the Entity named
`Entity`, one level up. Keeping the levels apart is what keeps self-description
harmless. The kernel is the one fixed point: it can describe itself, but not define
itself.

---

# Part I — Core

## The kernel

The kernel is the only thing not defined in terms of anything else.

### Language

A **Language** is a closed vocabulary at one level of abstraction: a set of Entities, the
Relationships between them, and axioms over them. `Level(x)` denotes the Language `x`
belongs to.

A Language may **extend** other Languages. It then builds on their vocabulary without
changing it: its **vocabulary** is its own Entities and Relationships together with those
of every Language it extends, transitively:

```
vocab(L) = (L.*extends).entities ∪ (L.*extends).relationships
```

An extension stays at the level of what it extends: it refines the same concepts.

**Closure.** Nothing in a Language references anything outside its vocabulary: both ends
of every Relationship, what every Entity extends, and every symbol of every axiom belong
to `vocab(L)`. Extension never changes the extended Language: what an extension adds is
seen only where the extension is in use. The only structure that relates two Languages
other than by extension is a Transformation (see *The Systemathic Languages*).

### Entity

An **Entity** is a kind of thing, belonging to exactly one Language. It has no intrinsic
attributes: everything that defines it is expressed through its Relationships. Two
instances are equal iff they are the same instance.

An Entity may **extend** Entities of the Languages its Language extends, written
`E : B₁, …, Bₙ`. In a Language that extends nothing, every Entity is new.

- An Entity that extends nothing is a **new identity**: each of its instances is a thing
  of its own.
- An Entity that extends others is a **projection**: it keeps their identity. Every
  instance of `E` *is* an instance of each `Bᵢ`, so it can be used wherever a `Bᵢ` is
  expected, and it navigates every end they do. This is the one implicit direction, from
  the concrete to the abstract.

What an Entity extends is a contract, not a container: it may extend any number of
Entities, from any of the Languages its own extends. The other direction is never
implicit. Getting the projection from what it extends — the `CombatMonster` of a
`Monster` — is an explicit design: a Transformation from the extended Language into the
extension, which has to be built. A design that needs the projection simply uses the
projection.

### Relationship

A **Relationship** is a pair of **ends**. A Relationship itself has no name; its ends
do. Each end has:

- a **name**, used to navigate to it — or none: an **unnamed** end cannot be navigated to,
  so the instances at the other end do not reach it, while it still reaches them;
- an **Entity**;
- a **range** `min..max`: how many instances of that end's Entity each instance at the
  other end is linked to. Its **Bounds** are natural numbers; `max` may be absent, meaning
  unbounded, written `N`.

```
Order <——> OrderLine
  end "order": Order,     1..1    each OrderLine has exactly one order
  end "lines": OrderLine, 1..N    each Order has one or more lines
```

From an instance, navigating by an end's name gives the linked instances at that end:
`o.lines`, `l.order`. The same reading applies when both ends are the same Entity, and
the names give the direction: `Parameter <——> Parameter` with ends `previous` and `next`.

A Relationship is a **mapping**, not a field: given an Order, there are its lines. How
they are obtained — stored, computed, looked up — is the implementation's concern. This is
what lets an extension add Relationships to Entities it does not own: "a Monster now also
has the Player it is chasing" says only that, from a Monster, its target can be reached.

A name is read from the other side: `Order.lines` is the navigation from an Order, through
the end named `lines`, which is at OrderLine. Leaving that end unnamed makes the
Relationship one-way: every OrderLine still reaches its `order`, but no Order reaches its
lines.

- A range is **well-formed** iff `max` is absent or `min ≤ max`.
- Any number of Relationships may join the same pair of Entities; they are told apart
  by their end names.
- **End names are unique per Entity:** in every Language, from any Entity, the named ends
  reachable across the Relationships of its vocabulary — its own and those of what it
  extends — have distinct names, so navigation is never ambiguous.

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
| `<`, `≤` | `<`, `<=` | the order of Bounds, as numbers            |
| `x.e`  | `x.e`   | the instances linked to `x` through end `e`    |
| `x.^e` | `x.^e`  | reachable through one or more `e` steps        |
| `x.*e` | `x.*e`  | `x` itself, or reachable through `e` steps     |
| `∃ x.e` | `some x.e` | `x.e` is not empty                          |
| `∄ x.e` | `no x.e`   | `x.e` is empty                              |

Variables range over the instances of an Entity (`∀m ∈ Monster. …`), which include the
instances of every projection of it. `=` is identity, always; only Bounds are ordered. A
formula is **well-formed** in `L` iff every Entity and end it mentions belongs to
`vocab(L)` and every comparison is between related Entities: the same, or one extending
the other. What a formula mentions is read from its text; nothing else records it.

Formulas are evaluated on finite models — which is always possible, and always
terminates. Whether a formula holds for every possible model is never the tool's
concern.

## The Systemathic Languages

Everything else is written in the kernel: every concept below is an Entity, related to
the others by Relationships. A System — a user's design — is a model of these
Languages. They are **layered**: each extends the one below it without changing it, so no
Language holds more than one concern.

| Language | Adds | Extends |
|---|---|---|
| **Kernel** | Language, Entity, Relationship, End, Name, Bound, Formula | — |
| **Functions** | Function, Parameter | Kernel |
| **Contexts** | Component, Interaction, Transformation, Export, Import; uses, implements | Functions |
| **Deployment** | Deployment, Instance, Connection | Contexts |
| **Mediation** | Medium, Mediation | Deployment |
| **Systems** | System | Mediation |

Systems is the top Language: a System is a model of it, and through it, of all the others.
Deployment and Mediation are optional in a design: a Component with no Deployment is
complete without one, and so is a Connection with no Mediation. A layer adds its
Relationships to the Entities below it without changing them: a Component does not know
how it is deployed, nor a Connection how it is mediated.

Their full definitions, as data, are in [`schema/`](../schema/README.md).

```
System ─┬─ root ─────▶ Component
        └─ packages ─▶ Component

Component ─┬─ languages ─────▶ Language ─┬─ extends ───────▶ Language
           │                             ├─ entities ──────▶ Entity ── extends ─▶ Entity
           │                             ├─ relationships ─▶ Relationship ── ends ──▶ End ─┬─ entity ──▶ Entity
           │                             │                                                 └─ min, max ─▶ Bound
           │                             └─ formulas ──────▶ Formula
           ├─ uses ──────────▶ Language
           ├─ components ────▶ Component
           ├─ implements ────▶ Component
           ├─ interactions ──▶ Interaction : Function ── language ──▶ Language
           ├─ transformations ▶ Transformation : Function
           ├─ exports ───────▶ Export ─┬─ component, interaction, transformation,
           │                           │  language, medium ─▶ what it exports
           │                           └─ export ─▶ Export          (a re-export)
           ├─ imports ───────▶ Import ─┬─ from ────▶ Component
           │                           └─ exports ─▶ Export
           ├─ mediums ───────▶ Medium ─┬─ language ─▶ Language
           │                           └─ call ─────▶ Interaction
           └─ deployments ───▶ Deployment ─┬─ instances ───▶ Instance ─┬─ of ────────▶ Component
                                           │                           └─ min, max ──▶ Bound
                                           └─ connections ─▶ Connection ─┬─ from ───────▶ Instance
                                                                         ├─ to ─────────▶ Instance, or the Component
                                                                         ├─ what ───────▶ Interaction
                                                                         └─ mediations ─▶ Mediation ─┬─ how ──▶ Medium
                                                                                                     ├─ down ─▶ Transformation
                                                                                                     └─ up ───▶ Transformation

Function ─┬─ parameters ─▶ Parameter ── type ──▶ Entity
          └─ output ─────▶ Entity
```

The Kernel Language contains its own `Language`, `Entity`, `Relationship` and `End`:
this is the kernel describing itself. Names (of end, Entity, Language, Component, …) are
instances of its own `Name` Entity, and range bounds of its own `Bound` Entity; how they
are spelled or encoded is a mediation, like any other representation.

The running example is a small multiplayer game:

```
System Game
└─ Game                                     the root Component
   ├─ Core        core                      Monster, Player; hunts, pack
   ├─ Fighting    core                      Targetable, Attacker, Damage
   ├─ Combat      extends Core, Fighting    CombatMonster : Monster, Targetable, Attacker;
   │                                        CombatPlayer : Player, Attacker
   ├─ imports     from NetStack and Link, the packages beside the root, what they export:
   │                NetStack: Language Network (Message, EntityId),
   │                          send(Message): Message, Medium Network (call send);
   │                          exports Network and its Medium
   │                Link:     Language Transport (Packet, Bytes),
   │                          transmit(Packet): Packet, Medium Wire (call transmit);
   │                          exports Transport and its Medium
   │
   ├─ CombatOverNetwork    imports Network from NetStack; uses Combat, Network
   │                       down Combat → Network, up Network → Combat; exports both
   ├─ NetworkOverWire      imports from NetStack, Link; uses Network, Transport
   │                       down Network → Transport, up Transport → Network; exports both
   │
   ├─ Physics     uses Core                 step(Monster): Monster, over Core
   ├─ Server      uses Combat               attack(Attacker, Targetable): Damage, over Combat;
   │                                        exports attack; imports Physics, and runs its own
   ├─ Client      uses Combat               imports attack from Server; imports Physics, and runs its own
   │  └─ Input    uses Combat               imports attack from Server, through Client
   │
   ├─ Deployment Online   server, clients 1..N
   │                      clients ──attack──▶ server   over Network, then Wire
   └─ Deployment Local    server, client
                          client ──attack──▶ server    over In-process
```

### Function *(Functions)*

A **Function** is a signature: an ordered list of **Parameters**, each of some Entity,
and at most one **output** Entity. It records what an operation takes and gives, never
what it does or how it is used. Saying what it does would be a pre/postcondition, and
using it is code; both are out of scope.

A Function without an output gives nothing back: it only informs, such as
`systemOpened(System)`. There is no Unit to return instead — it would have to belong to
some Language, and an Interaction returning another Language's Entity would be a
Transformation.

Order is expressed without an "ordered" primitive, by linking the Parameters:

```
Function  <——> Parameter    ends: function 1..1,   parameters 0..N
Parameter <——> Parameter    ends: previous 0..1,   next 0..1
Parameter  ——> Entity       end:  type 1..1
Function   ——> Entity       end:  output 0..1
```

The first Parameter is the one with no `previous`. `attack(Attacker, Targetable)` has a
first Parameter of type `Attacker`, whose `next` has type `Targetable`. Since a
`CombatMonster` is an `Attacker`, it can be passed as one. Realizations use their natural
form: the Python library exposes `attack.parameters` as a plain list, in order. That is a
mediation `Functions / Python`, and its round trip holds.

There are two kinds of Function, in *Contexts*: Interactions, at one level of
abstraction, and Transformations, between two.

### System *(Systems)*

A **System** is the whole of what is being modelled. It is the only standalone unit — the
thing that is opened and saved — and nothing references anything outside its System.

A System holds exactly one **root** Component, and is otherwise only what describes it as
a whole. Everything the design says is inside the root: the System's own core Languages,
extensions and Components are the root's.

Beside the root are the **packages** the System brings in from outside, such as the
library's: Components defined elsewhere and copied in, so the System stays closed. They
are the root's siblings, so the root imports from them as from any sibling, and its
children through the root's imports. Packages import only from each other, the root, and
what those export.

### Component *(Contexts)*

A **Component** is a unit of the design that gives Languages an implementation. It owns:

- **Languages**: its core Languages and extensions;
- **Components**: its children, each an implementation detail of it;
- **Transformations** between Languages it uses;
- **Interactions**: what it offers;
- **Exports**: what of it others may reach — its API (see *Export*);
- **Imports**: what it depends on of others (see *Import*).

How a Component is put together is not part of it: that is its Deployments
(*Deployment*).

It **uses** some Languages: the vocabulary it works in. Using a Language includes its
vocabulary, extensions and all.

**Scope.** A Component sees the Languages of its own and of every Component it is nested
in, and those it imports (see *Import*), and nothing else:

```
scope(C) = (C.*parent).languages ∪ C.imports.exports.*export.language
```

Interactions, Transformations and Mediums follow the same rule (see *Import*).

A Component never sees inside another — neither its children's insides nor its siblings' —
beyond what the other exports. Two siblings have something in common only if their parent
gives it to both, or both import it from a Component that exports it.

Nesting is a tree of Languages. Inside a Component, the Languages in its scope are what
its own extensions build on, exactly as a System's extensions build on its core
Languages; and a child is built, recursively, the same way as the System. The root is not
special: it is the Component every other is nested in.

**Interfaces and implementations.** From outside, a Component is only what it exports: an
**interface**. Its children, Transformations and Deployments are its own implementation
of that interface — the default one. Another Component may **implement** it: it is then
an alternative implementation, with children of its own, that may stand wherever the
implemented Component is placed. An implementer imports what it implements, and uses the
Language of each Interaction it exports, so that it can offer them. A Component
may implement several, and be implemented by any number; nothing implements itself,
eventually. Which implementation fills a place is not the design's choice (see *How a
System is designed*).

### Interaction *(Contexts)*

An **Interaction** is a Function a Component offers, over one **Language** it uses: its
Parameters and output are all of that Language's vocabulary.

What a Component exports of its Interactions is its **API**, in the literal sense: the
public interface through which it is used (see *Export*). An Interaction it does not
export is internal: only the Components nested in it reach it.

Interactions are **always pure**: they happen at one level of abstraction, in one
Language. Anything that crosses levels — between two Languages — is a Transformation.
Nothing relates more than that.

### Export *(Contexts)*

A Component **exports** what others may reach: an **Export** refers to exactly one thing,

- one of the Component's own Languages, Interactions, Transformations or Mediums (see
  *Mediation*);
- one of its children, so that others may import from it and place it;
- an Export of one of its children: a **re-export**, which passes what the child exports
  on, one level up.

Its Exports are a Component's **API**. What a Component does not export, nothing outside
it reaches — not a sibling, nor anything further away. Its own children reach it anyway:
being nested in a Component is not being outside it (see *Import*).

Exporting is per level. What a child exports, its siblings may import; beyond its parent,
it is reachable only if the parent exports the child, or re-exports the child's Export. A
re-export is an Export of an Export, so the route through the levels is part of the
design, and what an Export finally makes reachable is found by following it:

```
resolve(e) = the target of e.*export     — a Component, Language, Interaction, Transformation or Medium
```

Every reference elsewhere — a Connection's What, a Medium's call, an `implements` — is to
the thing itself, never to an Export: an Export only decides who may reach it.

This is how one Component extends parts of another from outside. A plug-in for one part
of `A` imports from `A` what `A` exports of that part — the part itself, or what the part
exports, re-exported — and nothing else of `A`. If `A` exports none of its parts, the plug-in
can only extend `A` as a whole.

A Component with children of its own is an implementation; exporting one hands that
implementation out as API. That is allowed — whether it is is a rule (`exports_interfaces`):
the usual answer is to export an interface, implemented by the Component that has the
children.

### Import *(Contexts)*

A Component has direct access to its own Languages, Interactions, Transformations and
Mediums, and to those of every Component it is nested in: a plug-in uses what the
Component it plugs into offers, as code uses its SDK.

Anything else, a Component **imports**. An **Import** is of one Component, the one it is
`from`, and takes some of that Component's Exports. Interactions and Transformations stay
apart — an Interaction is at one level of abstraction, a Transformation is between two,
and nothing treats them as one kind of thing, so levels never mix. Imports are what show a
design's dependencies: not who calls what, which is code, but which Component needs what
another exports. Each Import is one dependency, and gives it its direction, from what
imports to what it imports from.

A Component may import from its **importable** Components: its siblings, those each
Component it is nested in imports from, and those that it, or a Component it is nested in,
reaches through an Export of a Component:

```
importable(C) = siblings(C) ∪ (C.^parent).imports.from ∪ (C.*parent).imports.exports.*export.component
imported(C)   = C.imports.exports.*export                — what its Imports resolve to
access(C)     = (C.*parent).interactions ∪ imported(C).interactions
```

and the same for Languages, Transformations and Mediums. The siblings of the root are the
System's packages.

An imported Interaction must be over a Language the importer uses; an imported
Transformation need not be, so a Component can use a realization (see *Mediation*)
without speaking the Language it reaches.

What a Component imports from, its children may import from in turn, and so on down:
`Client` imports `attack` from `Server`, so `Client`'s own `Input` may import it too.
Without that import, `Server.attack` is inaccessible to `Input`. This is how a design names
the actual users of an Interaction, not only a link between two top-level Components.

**Importing a Component** — an Import from it, or one taking an Export of it — lets the
importer place Instances of it in its own Deployments (see *Deployment*), and import from
it in turn. An Import may take no Exports at all: it is then of the Component as a whole.
This is how one Component is shared without being one shared thing: `Server` and `Client`
both import `Physics`, and each runs a `physics` of its own. A library Component, brought
into a System from outside, is imported the same way, and its Mediums with it.

**Reaching inside.** If `A` exports its child `A₁`, a Component that imports from `A`
taking that Export reaches `A₁`: it, and every Component nested in it, may then import from
`A₁` what `A₁` exports. Or `A` re-exports what `A₁` exports, and it is imported from `A`
directly. Either way, `A` decides: of `A₁`, nothing outside `A` reaches what `A` does not
export.

### Axioms *(Kernel)*

A Language's **axioms** are well-formed formulas over it. They state structural facts
that ranges alone cannot — facts about how instances are linked:

```
∀o ∈ Order, l ∈ o.lines.  l.product ∈ o.catalog.products     every line's product is in its order's catalog
∀m ∈ Monster.             m ∉ m.^leader                      leadership has no cycles
```

An extension may state axioms over everything in its vocabulary, including what it
extends; they hold wherever the extension is in use.

Formulas navigate Relationships and compare identities; they do not apply Functions.
What a Function computes is not part of the model.

Axioms are **assumed** to hold for every instance. The tool checks only that they are
well-formed; holding them true is the implementer's obligation. Axioms describe what is
always true, not sequences of changes. Where a lifecycle matters to the design, it is
modelled as vocabulary: an `OrderLifecycle` extension with `Placed` and `Cancelled`.

### Transformation *(Contexts)*

A **Transformation** `τ: L_src → L_tgt` is a Function held by a Component, whose inputs
are all of one Language, `L_src`, and whose output is of another, `L_tgt`; the Component
uses both. It shows that the things of one Language appear in another. It is one-way;
going back is another Transformation.

A Transformation is a signature, like every Function: it says what is carried across, not
how. Nothing is required of how the two Languages relate — neither need extend the other,
and nothing of one need correspond to anything of the other. How a Transformation maps is
the implementation's business; what it must preserve is an obligation (see *Obligations*).

#### Round trip

Semantically, a Transformation is a correspondence between instances of its Languages.
Two Transformations `down: L → H` and `up: H → L` form a **round trip** when `up` gives
back what `down` was given — being able to reconstruct the original is the point of
thinking at the higher level at all:

```
∀x ∈ L. up(down(x)) ≈ x
```

`≈` is **observational equivalence** in `L`: two instances are equivalent iff nothing the
Language can express tells them apart. Formally, `≈` is the largest relation such that
`x ≈ y` implies:

- `x` and `y` are instances of the same Entity;
- for every end reachable from their Entity, each instance `x` reaches through it has
  an equivalent instance `y` reaches through it, and vice versa.

Identity implies equivalence. The law thus says: the representation must preserve
everything the higher Language can observe. The lower representation need not hold all
of it on its own; `up` may keep state that completes it:

- **By value** (serialization): `H` encodes everything, and `up` needs nothing kept.
  Decoding creates a new instance, so identity does not survive the round trip, but
  equivalence does.
- **By reference** (an ID sent to a client, resolved by a server-side lookup): `up` keeps
  the correspondence — the server keeps its Monsters, so an ID can be resolved. Identity
  survives.

`up` is partial: a crafted packet, corrupted bytes or an unknown ID has no preimage, and
neither does a well-formed encoding of something that violates `L`'s axioms. Such a
failure is a property of the Transformation. It is not an Entity of either Language: no
`Optional⟨Monster⟩` is introduced into the higher Language. Handling it is part of the
"how".

A round trip stands on its own, too: a compiler lowers a program into its executable
form, and a source map leads back to the same program. A Transformation that is not part
of a round trip is one-way: a lowering that never needs to come back, or a projection from
an extended Language into an extension (see *Contracts and projections*).

### Deployment *(Deployment)*

A **Deployment** of a Component is one way to put it together: which of its children
exist side by side, how many of each, which of them each one's imports reach, and over
what. A Component may have any number of Deployments — options, such as `Online` and
`Local` for the game — or none, if how it is put together is left open. A Deployment
places only its Component's own children and what it imports, because anything deeper is
an implementation detail of one of them; and it never refers to another Deployment, so
each is a choice local to its Component.

- An **Instance** is a place for a child Component, or for a Component the deployed
  Component imports — one an Import of it is from, or reaches through an Export. It is **named**, uniquely within its Deployment, since a Deployment
  may hold several Instances of the same Component: `server` and `backup` may both be of
  `Server`. It has a **range**, as an end has: how many occupy it — `1..1` one, `0..1`
  optional, `1..N` one or more, `0..N` any number. An imported Component's Instance
  belongs to the Deployment that places it: two parts that each place one have one each.
  What occupies an Instance is the Component it is of, or one implementing it.
- A **Connection** goes from an Instance to what provides some of the Interactions its
  Component has access to: another Instance, whose Component offers or exports them, or the
  deployed Component itself, which offers or imports them. Those Interactions are the
  Connection's **What**; they are all over one Language. Its direction is always the
  same: from what uses the What to what offers it.

A Connection to an Instance with more than one occupant reaches every occupant. That is
how one caller informs many without knowing them — an **event**: an Interaction without
an output, connected to an Instance of range `0..N`, each occupant of which is told.

An Interaction may be reached by any number of Connections (a central service with many
users), and an Instance may reach the same Interaction on several Instances (a load
balancer, connected to each runner). There is no two-way Connection: `a → b` and `b → a`
are two Connections, each its own dependency.

### Mediation *(Mediation)*

Every Connection is mediated: even an in-process use passes its Entities over something,
such as a pointer. A Connection may say what over, with Mediations; it need not. A
Connection with no Mediation is not in-process, nor anything else: how it passes is an
**implementation detail, not part of the design**, and the System is content with that.
The same holds at every level of a stack. Whether a design must say more is a rule of its
profile (see *Standard rules*). Two Connections between the same two Instances may be
mediated differently — two parts of one process may talk both directly and through an
internal HTTP server.

A **Medium** is something a What can be passed over: HTTP, gRPC, JSON, a pipe, the
process itself. It is defined apart from any Connection, by the Component that defines
the medium itself — `HTTP` defines the HTTP Medium — and names

- its **Language** `H`: what passes over it;
- its **call**: an Interaction of its Component over `H`, through which a use of the What
  travels, and to which further Mediations can be applied, such as
  `send(Request): Response`.

Mediums are exported and imported like Interactions and Transformations, and by the same
rule: a Component has access to its own Mediums and those of every Component it is nested
in, and imports the rest from Components that export them. To mediate a Connection over a
Medium, the deployed Component must have access to it: for `A₁` and `A₂` to talk over HTTP,
`A` imports the HTTP Medium from the Component that exports it.

A **Mediation** of a Connection has

1. a **What**: the Interactions it mediates, and so their Language `L`;
2. a **How**: a Medium the deployed Component has access to;
3. optionally, a **realization**: Transformations `down: L → H` and `up: H → L`, forming a
   round trip.

A Mediation mediates Interactions, and so the Entities they are made of. Saying which
Medium a What passes over is already part of the design; realizing it says more: `down`
and `up` say that each use of the What goes into the Medium and comes back out, its
Parameters on the way in and its output on the way back. A design may realize a
Mediation or not; the model requires nothing more, and a verification script may (see
*Standard rules*). A realization that is given must be right: both ends of the Connection
take part, so it must be accessible to both — owned, imported, or offered by a Component
they are nested in. Neither end needs to use `H`: typically the realization is a
Component of its own, beside them, which exports it and which both import from.

**Stacks.** Mediations stack, from the top down, as far as the design cares to fix the
how. The top one's What is the Connection's; each one **below** mediates the call of the
Medium **above** it:

```
client ──attack──▶ server
   1. What attack        How Network (call send)       realized by CombatOverNetwork
   2. What send          How Wire (call transmit)      realized by NetworkOverWire
   Combat → Network → Transport → Network → Combat
```

A stack ends wherever the design stops saying more; below its last Mediation, the call
is an implementation detail. Which Mediations a Connection has belongs to the Deployment,
so the same Instances, connected the same way, may be mediated differently in two
Deployments.

A Mediation whose Medium no longer exists is **broken**: it keeps its place in the
stack, and the System is ill-formed until it is given a Medium again or removed. Deleting
a Medium never silently turns a mediated Connection into an unmediated one.

## Well-formedness

The axioms of the Systemathic Languages. A System is **well-formed** iff it satisfies
them; the tool evaluates them on the System, which is a finite model. Each condition
belongs to the layer whose vocabulary it is about.

| #  | Condition | Layer |
|----|-----------|-------|
| W1 | **Closure.** Both ends of every Relationship and every symbol of every formula of `L` belong to `vocab(L)`; what every Entity of `L` extends belongs to the Languages `L` extends, `L.^extends`; every formula is well-formed (see *The logic*). | Kernel |
| W2 | **Ranges.** Every range — of an end, or of an Instance — is well-formed. | Kernel; Deployment for Instances |
| W3 | **End names.** In every Language, from every Entity, the named ends reachable across its vocabulary have distinct names. | Kernel |
| W4 | **No cycles.** No Language and no Entity extends itself, eventually. | Kernel |
| W5 | **Scope.** Every Language a Component uses, and every Language a Language defined in it extends, is in its scope. | Contexts |
| W6 | **Transformations.** A Transformation has an output; its inputs are all of one Language and its output of another, each in the vocabulary of a Language its Component uses. | Contexts |
| W8 | **Purity.** Every Interaction is over a Language its Component uses, and its Parameters and output belong to that Language's vocabulary. | Contexts |
| W9 | **Imports.** Every Import is from a Component in the importer's `importable`, and takes only Exports of that Component; every imported Interaction is over a Language the importer uses. | Contexts; Systems for the root and packages |
| W10 | **Placement.** Every Instance of a Deployment is of a child of the deployed Component, or of a Component it imports, and no two Instances of a Deployment share a name; every Connection goes from an Instance of the same Deployment, for Interactions over one Language that its Component has access to, to an Instance of the same Deployment whose Component offers or exports them, or to the deployed Component, which offers or imports them. | Deployment |
| W11 | **Mediums.** Every Medium's call is an Interaction of the Component that defines the Medium, over the Medium's Language. | Mediation |
| W12 | **Mediations.** Every Mediation has a Medium the deployed Component has access to. A realization, if given, is `down: L → H` and `up: H → L`, where `L` is the What's Language and `H` the Medium's — read as their vocabularies — both accessible to the Components at both ends. A Connection's top Mediation mediates its What; each one below, the call of the Medium above it. | Mediation |
| W14 | **Implementations.** No Component implements itself, eventually; a Component imports what it implements, and uses the Language of each Interaction it exports. | Contexts |
| W15 | **Exports.** Every Export has exactly one target: one of its Component's own Languages, Interactions, Transformations or Mediums, one of its children, or an Export of one of its children. | Contexts; Mediation for Mediums, and so for having a target at all |

W7 (mappings) and W13 (Configurations) belonged to earlier versions of the core, and their
numbers are not reused.

## Obligations

Some conditions are part of what the definitions mean, but concern the implementation
rather than the design. The tool never checks them. They are stated in exported
specifications for an implementer (human or LLM) to satisfy.

| #  | Obligation |
|----|------------|
| O1 | **Validity.** Every instance satisfies its Language's ranges and axioms, and those of every extension in use. |
| O2 | **Round trip.** Every Mediation's realization satisfies the round-trip law. |
| O3 | **Preservation.** Every Transformation preserves the axioms of `L_src`: what holds of its inputs holds of its output, read in `L_tgt`. |
| O4 | **Identity.** An instance of a projection is the same instance as each Entity it extends. |
| O5 | **Substitution.** An implementation offers every Interaction of what it implements, as it is specified, wherever it is placed instead. |

## Deletion

Ownership lives with the owner — a Language owns its vocabulary, a Component everything
nested in it — so deletion cascades down ownership and removes whatever is left
referencing what was deleted.

- **Deleting a Language** removes its Entities, Relationships and axioms; every extension of them,
  Relationship, axiom, Parameter or output, in any Language or Function, that names any
  of them; every Function with a Parameter or output of it; every Interaction over it;
  every `extends` and `uses` of it; every Export of it.
- **Deleting an Interaction** removes every Export of it, and removes it from every
  Connection's What; a Connection left with no What is removed. A Medium whose call it
  was is left without one, and ill-formed until it is given another.
- **Deleting a Transformation** removes every Export of it, and the realization it was
  part of from every Mediation; the Mediation stays, unrealized.
- **Deleting a Medium** removes every Export of it, and leaves every Mediation over it
  broken.
- **Deleting a Component** removes everything it owns, recursively; its Deployments;
  every Medium of it; its Exports and Imports; every Export of it, and every Import from it;
  every `implements` of it; every Instance of it, and every Connection from or to those
  Instances.
- **Deleting an Export** removes its re-exports, and takes it out of every Import that
  took it; an Import left taking nothing stays, of the Component as a whole.
- **Deleting a Deployment** removes its Instances and Connections.
- **Deleting an Instance** removes every Connection from or to it.

What lies outside the core — documentation, Configurations, layouts — is about the things
of a System, and goes with them; how is the tool's concern.

---

# Part II — Standard concepts

Everything in this part is defined in terms of the core. None of it is needed for the
core to mean anything, and none of it adds vocabulary: each concept is a formula, or a
function in `systemathic.std`.

## Core Languages and extensions

- **Core Language:** a Language that extends nothing in its own Component — it extends
  nothing at all, or only Languages of the Components it is nested in, or that it imports. A
  child's core Languages build on its parent's vocabulary, as the System's build on
  nothing.
- **Extension:** a Language that extends another of its own Component.

A core Language is ideally minimal: identities and their vital Relationships. Depth is
added by extensions, each holding one refinement, so consumers choose what they use: the
core, an extension, or several. Identity stays in the core; functionality lives in the
extensions.

The Systemathic Languages are layered this way (see *The Systemathic Languages*).
`from systemathic.core import *` and `from systemathic.std import *` together are a
consumer that uses all of them, and the standard concepts over them.

## Contracts and projections

The same identity looks different in different contexts. A Monster, in the context of
combat, is `Targetable` and an `Attacker`; on the network, it is a `SyncedEntity`. These
are not lower-level representations but **contextual views**, and an extension states
them as a projection, over contracts it extends:

```
Fighting:                                        core: the contracts
  Targetable, Attacker, Damage
Combat extends Core, Fighting:
  CombatMonster : Monster, Targetable, Attacker  a Monster, seen in combat
  CombatPlayer  : Player, Attacker
```

The extension knows the core; the core knows no extension. A Monster is not, by itself, a
`CombatMonster`: a Component that needs one uses `CombatMonster`. Where a design needs to
get from one to the other, that is a **projection**: a Transformation `Core → Combat`
taking a `Monster` and giving its `CombatMonster`, one-way, because a view needs no way
back — it *is* that identity, seen in context. Like every Transformation, it is designed
and built explicitly.

## Composition

Composite Entities are built from Relationships and extension.

- **Attribute / product** (has-a): an Entity with `1..1` ends to each of its parts. "A
  Person has a Name" is a Relationship, not a field.
- **Sum** (one-of, closed): `S = V₁ | … | Vₖ` is a Relationship from `S` to each `Vᵢ`
  with an end `vᵢ` of range `0..1`, plus the axiom that every `S` has exactly one:

  ```
  ∀s ∈ S. ⋁ᵢ ( some s.vᵢ  ∧  ⋀_{j≠i} no s.vⱼ )
  ```

  A `Shape` holds a `Circle`. Use it when the Language owning `S` knows every variant.
- **Contract** (is-a, open): `Circle : Shape`. Use it when extensions add variants the
  Language owning `Shape` does not know.

## Components

- **Leaf:** a Component with no children.
- **Self-contained:** a Component that uses only Languages it owns.
- **Pure:** a Component that imports nothing — it depends only on Languages.
- **Standalone:** a Component with an Instance in a Deployment of its parent.
- **Shared:** a Component that siblings import from, to run Instances of their own. A
  Component may be both, or neither.
- **Interface:** a Component that something implements. Its own children are its
  default implementation; it may have none, and leave every implementation to others.
- **API:** what a Component exports, resolved: `resolve(C.exports)`.

A Component's dependencies are its Imports, and its children's that reach outside it.
The **dependency graph** of a Component's children has an edge from each to every
sibling it imports from. Two Components importing from each other are two dependencies,
not one two-way link; whether that is allowed is a rule (`imports_acyclic`).

## Abstractness

- **Abstract Language:** a Language that is never the "how" of a Mediation. An abstract
  Language may be used by any number of Components; what it cannot be is replaceable.
- **Abstract Interaction:** an Interaction over an abstract Language.

Abstractness separates a System's stable contract — the vocabularies nothing can swap
out — from its implementation vocabularies. It is a property of how a Language is used
in a System, not of the Language itself: `Network` is not abstract in the game, where
`attack` is mediated over it, even though it is the "what" of the Mediation over `Wire`.

## Stacks

- **Stacks:** a Medium's call is itself a What, so Mediations stack: `attack` over
  `Network`, whose `send` is over `Wire`. Where a stack stops is a choice of how tightly
  the model constrains the real system. Realizations compose down a stack, and each
  `up`'s failures stay with the Mediation where they arise. The seven layers of a network
  stack are one such stack, written out.
- **Levels:** a Mediation is a step down in abstraction, from what is carried to what carries
  it. A level is a position in a stack, not a property of a Language: JSON is above Text where
  Text carries it, and below Text where it holds the Text, as in `Name / Text / JSON / Text /
  HTTP / TCP`. The same Language may be at several levels, in one stack or in many, so
  Languages and Mediations form no order of their own; the model requires none, and keeping
  two levels apart is for rules (see *Standard rules*).
- **Opacity:** for a mediated Connection, ideally neither end's Component uses any
  Language below its What's: what uses and what offers do not know how they are
  connected. They import the realization; only the Deployment, and the realization,
  know the how. And the other way: a Medium does not know what it carries. Only a
  realization knows both of its levels, and nothing else.
- **Two swaps**, both leaving the ends untouched: change the how (`Network` → a
  `WebSocket` Medium, with a realization of its own), or change the realization (by-ID →
  by-value over `Network`, different Transformations between the same Languages).

The same Connection reads at any depth. Cut a stack at one Mediation, and everything
above it is the Components talking, everything below it is how they talk.

## Generic Languages

A **Generic Language** `G⟨P₁ … Pₙ⟩` is a template parameterized by Entities.
Instantiating it with Entities `X₁ … Xₙ`, all of one Language, expands into ordinary
Entities, Relationships and axioms **in that Language**:

```
Level(G⟨X₁ … Xₙ⟩) = Level(X₁) = … = Level(Xₙ)
```

So `Level(Optional⟨Monster⟩) = Level(Monster) ≠ Level(Optional⟨Byte⟩)`. A Transformation
lifts through a generic: `τ` induces `G⟨τ⟩: G⟨X⟩ → G⟨τ(X)⟩`.

`Optional`, `Result` and similar are generic. A Language instantiates one only for
failure or absence meaningful at its own level (a player may have no target). Failures
of how a level is carried out belong to the Mediation.

---

# Part III — Library

`systemathic.lib` holds ordinary Languages for common vocabularies and protocols —
bytes, JSON, HTTP, TCP, IP, Ethernet, REST, WebSocket, SQL, … — and generics (optional,
result, …), together with the Components that define them and the common **Mediums**:
HTTP, gRPC, JSON, XML, and so on. They have no special status.

One Medium is in the library because nearly every design needs it: **In-process**, the
process itself — a use passed within one process, over a reference. It is a Medium like
any other, with no special standing anywhere.

The library also holds realizations between its own Languages, such as HTTP over TCP. A
Language never depends on another — HTTP does not depend on TCP, and HTTP/3 runs over
QUIC — so "HTTP over TCP" is not part of HTTP; it is a realization of its own. A design
stacks on top of it: a Connection mediated over the HTTP Medium, whose call is `send`, can
have `send` mediated over TCP, and moving to HTTP/3 replaces only that lower Mediation.

A System is closed, so library content is used by being part of the System: its packages.
Nothing in a System references anything outside it. How content is brought from the
library, or from one System into another, is the tool's concern, not the foundation's.

A Language reaches a library Language only through Transformations, because library
Languages are lower-level *representations*: `Money` is not a number; a number is one
way to represent it.

---

# Part IV — Scripts

The tool builds and exports Systems; what a design must satisfy beyond well-formedness,
it leaves to scripts over a System:

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

GAME_CORE = "Core"

@rule(severity=ERROR)
def core_is_core(system: System):
    core = system.language(GAME_CORE)
    if not is_core(core):
        yield Violation(core, "Core must build on nothing")

@rule(severity=ERROR)
def core_is_abstract(system: System):
    core = system.language(GAME_CORE)
    if not abstract(core):
        yield Violation(core, "Core must never be an implementation detail")

profile = Profile(core_is_core, core_is_abstract, opacity, medium_blind)
```

- A **rule** yields violations, each naming the offending element, rather than failing
  on the first assertion.
- A **profile** is the set of rules a System is checked against. Each rule has a
  severity: error or warning.
- Lookups by name (`system.language("…")`) raise if the name is missing or ambiguous; the
  foundation does not require names to be unique.
- Constructing the `System` object from a saved file is a deserializer — itself a
  Transformation, `Systems / JSON`.

**Formulas become Python.** The formulas inside Languages stay first-order logic. When a
System is loaded into a script, they are translated into Python predicates.
The translation is a Transformation `Formula / Python`, and it needs its reverse: a
failing predicate is reported as the formula it came from, in design terms.

Verification scripts, profiles and formulas are all exported with the model, so a
System's design rules reach an implementer as precisely as the System itself.

## Standard rules

`systemathic.std` provides common rules to include in a profile:

| Rule | Checks | Default severity |
|------|--------|------------------|
| `opacity` | Every mediated Connection is opaque (see *Stacks*). | Error |
| `mediation_separate` | Every Mediation joins two levels: its What's Language and its Medium's are not one, nor does either extend the other. | Error |
| `medium_blind` | No Medium knows what it carries: the Component defining a Medium uses no Language mediated over it. | Error |
| `mediators_minimal` | A mediator knows its two Languages, and only them: a Component realizing a Mediation uses nothing else. | Error |
| `projection_acyclic` | No Language is projected, eventually, into itself. | Error |
| `generic_level` | All arguments of a generic instantiation belong to one Language. | Error |
| `imports_acyclic` | No Component depends, eventually, on itself through its siblings' imports — no two Components import from each other. | Warning |
| `deployments_complete` | In every Deployment, every Interaction an Instance's Component imports is reached by a Connection. | Error |
| `interactions_abstract` | Every imported Interaction is abstract: no Component is reached through an implementation vocabulary. | Warning |
| `exports_interfaces` | Only interfaces are exported: no Export makes reachable a Component that has children. | Warning |

**How much mediation a design states** is never required by the tool: a Connection
without Mediations is always well-formed. These rules are offered for a script that wants
more. Each takes its arguments explicitly, with no defaults; a script that does not care
about mediation includes none of them.

| Rule | Checks |
|------|--------|
| `mediation_primitives(*mediums)` | Every Connection is mediated down to a **primitive**: its last Mediation is over one of the given Mediums, the ones the script accepts as trivial. |
| `mediation_depth(n)` | Every Connection has at least `n` levels of Mediation. |
| `mediations_realized(*mediums)` | Every Mediation over one of the given Mediums is realized. |

A script might, for instance, accept HTTP, JSON and In-process as primitives, or ask for a
depth of 1.

---

# Out of scope

- **Internal consistency.** The tool does not prove that a Language's axioms can hold
  together, or that an implementation satisfies them.
- **Behaviour over time.** There are no pre/postconditions, states or transitions.
  Axioms say what is always true; lifecycles that matter are modelled as vocabulary.
- **Wiring mechanics.** A Deployment says which Instances exist, which one's imports reach
  which, and over what. How they are constructed and connected (dependency injection, containers,
  lifetimes) is coupling mechanics, not design. Which implementation fills each Instance is
  chosen outside the core.
- **Infrastructure.** Machines, networks and reachability are not special. A machine
  boundary is a Mediation a Connection is carried over; where an Instance physically runs,
  when it matters, is vocabulary of a deployment Language, carried like any other.
- **Requirements.** What the System is for is not modelled; the design realizes it.
