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
3. **Components** are boxes: each an interface — the Languages it speaks, the Interactions
   it offers, what it exports (its API), and the vocabulary it imports — built,
   recursively, the same way: its own core Languages, extensions and Components, private
   to it.
4. **Deployments** say how a box may be built: its internal layouts. A box may have
   several — the ways to build it — kept in the box itself or elsewhere, such as in a
   plug-in package: which boxes each places, how many of each, how they call each other,
   through their interfaces, and over which Mediations. A box with no Deployment is an
   **interface**: its implementation is undefined, and nothing relies on more than its
   interface.

The root is the solution to the highest-level problem, and its Deployments are the ways to
solve it. Which Deployment each real Instance runs is not the design's, unless the design
fixes it: it is chosen when a System is put together to run, outside the core (the tool's
Configurations do it). What the system is for — the client's requirements — is not
modelled either. It is what the root, as a whole, realizes.

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
| **Contexts** | Component, Interaction, Transformation, Export, Import; uses | Functions |
| **Deployment** | Deployment, Instance, Connection, Step; a Deployment's box and keeper, its Imports and exposures; what an Instance runs | Contexts |
| **Mediation** | Medium, Mediation | Deployment |
| **Systems** | System | Mediation |

Systems is the top Language: a System is a model of it, and through it, of all the others.
Deployment and Mediation are optional in a design: a Component with no Deployment is an
interface, complete without one, and a Connection with no Mediation is complete too. A
layer adds its Relationships to the Entities below it without changing them: a Component
does not know how it is built, nor a Connection how it is mediated.

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
           ├─ interactions ──▶ Interaction : Function ── language ──▶ Language
           ├─ transformations ▶ Transformation : Function
           ├─ exports ───────▶ Export ─── component, interaction, transformation,
           │                              language, medium, deployment ─▶ what it exports
           ├─ imports ───────▶ Import ─┬─ from ────▶ Component
           │                           ├─ exports ─▶ Export
           │                           └─ steps ───▶ Step ── instance ─▶ Instance   (an identity)
           ├─ mediums ───────▶ Medium ─┬─ language ─▶ Language
           │                           └─ call ─────▶ Interaction
           └─ kept ──────────▶ Deployment ─┬─ component ───▶ Component   (its box)
                                           ├─ imports ─────▶ Import      (its needs)
                                           ├─ exposes ─────▶ Export ── instance ─▶ Instance
                                           ├─ instances ───▶ Instance ─┬─ of ────────▶ Component
                                           │                           ├─ runs ──────▶ Deployment
                                           │                           └─ min, max ──▶ Bound
                                           └─ connections ─▶ Connection ─┬─ from ───────▶ Instance
                                                                         ├─ to ─────────▶ Instance, an identity, or the box
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
library's, or the plug-ins that extend it: Components defined elsewhere and copied in, so
the System stays closed. Being beside the root says where they are kept, not who may
import what: a package imports from the root, or from another package, as any Component
imports from any other (see *Import*). A package the root depends on is a dependency; one
that depends on the root is a plug-in. Which is which is read off their Imports.

### Component *(Contexts)*

A **Component** is a box with an interface. It owns:

- **Languages**: its core Languages and extensions;
- **Components**: its children, boxes its Deployments may place;
- **Transformations** between Languages it uses;
- **Interactions**: what it offers;
- **Exports**: what of it others may reach — its API (see *Export*);
- **Imports**: the vocabulary its interface is written in (see *Import*);
- the **Deployments it keeps**: of itself, or of another box it implements (see
  *Deployment*).

How a box does what it does is not part of it: that is its Deployments, each one of its
internal layouts, wherever it is kept.

It **uses** some Languages: the vocabulary it works in. Using a Language includes its
vocabulary, extensions and all.

**Scope.** A Component sees the Languages of its own and of every Component it is nested
in, and those it imports (see *Import*), and nothing else:

```
scope(C) = (C.*parent).languages ∪ C.imports.exports.language
```

Interactions, Transformations and Mediums follow the same rule (see *Import*).

A Component never sees inside another — neither its children's insides nor anyone
else's — beyond what the other exports. What it exports, though, any Component may import,
wherever the two are.

Nesting is a tree of Languages. Inside a Component, the Languages in its scope are what
its own extensions build on, exactly as a System's extensions build on its core
Languages; and a child is built, recursively, the same way as the System. The root is not
special: it is the Component every other is nested in.

**Interfaces and implementations.** From outside, a Component is only what it exports: an
**interface**. How it is built is a Deployment of it, and it may have any number: each an
alternative implementation, kept wherever its code is — a plug-in supplies one by keeping
a Deployment of the box it implements. A box with no Deployment is an interface whose
implementation is undefined; an **empty** Deployment is one whose insides are redacted —
as far as relying on it goes, the same as the interface, but still a distinct option to
choose, by name. Which Deployment a real Instance runs is not the design's choice, unless
it fixes it (see *Deployment*).

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
- one of its children: its interface, as an **API** of the Component's;
- one of the Deployments it keeps.

A Deployment exports too: it **exposes** some of its placements (see *Deployment*).

Its Exports are a Component's **API**. What a Component does not export, nothing outside
it reaches. Its own children reach it anyway: being nested in a Component is not being
outside it (see *Import*).

Exports are **not scoped** by nesting. What a Component exports, any Component may import,
wherever the two are: a sibling, a Component in another branch, a package. Each API is
exported by the Component it belongs to, independently of the Components around it, so a
plug-in depends on exactly the part it extends — the Simulator's API, or the Component
that defines Force and Momentum — and on nothing around it.

```
resolve(e) = the target of e     — a Component, Language, Interaction, Transformation, Medium or Deployment
```

Every reference elsewhere — a Connection's What, a Medium's call, a Deployment's box — is to
the thing itself, never to an Export: an Export only decides who may reach it.

**APIs.** A Component offers its own Interactions, and those of each child it exports: an
exported interface is an API of the Component's. `Editor` exports its child `Editing API`,
whose Interactions are `open` and `close`; a Connection to an `editor` Instance may carry
`open`, and whoever calls it imports `open` from `Editing API`, depending on the interface
and not on the `Editor` that implements it.

Exporting a child exports its interface, and nothing more: a child is part of its parent's
implementation, placed only inside the parent. Others may consume it, through an Instance of
the parent, or implement it — keep a Deployment of it, for a Configuration to choose where
the parent places it. Depending on a child is depending on its parent: it does not exist
without it. A Component may also export a **Deployment** it keeps, for others to rely on
what it exposes.

### Import *(Contexts)*

A Component has direct access to its own Languages, Interactions, Transformations and
Mediums, and to those of every Component it is nested in: a plug-in uses what the
Component it plugs into offers, as code uses its SDK.

Anything else is **imported**. An **Import** is of one Component, the one it is `from`,
and takes some of that Component's Exports. Interactions and Transformations stay apart —
an Interaction is at one level of abstraction, a Transformation is between two, and
nothing treats them as one kind of thing, so levels never mix. Imports are what show a
design's dependencies: not who calls what, which is code, but which part needs what
another exports. Each Import is one dependency, and gives it its direction, from what
imports to what it imports from.

**What imports.** A box imports only **vocabulary**: the Languages its interface is
written in — an interface needs nothing more. What calls is a Deployment: its Imports are
its **needs** — the Interactions it calls, the Transformations and Mediums its
Mediations use, the Deployments it is built on, the top-level Components it places, and
the identities it relies on — and importing it brings what it needs in turn. A Deployment
makes sense only where its needs are present (see *What is verified*).

An Import may be from **any other Component**; what it takes is limited to that
Component's Exports:

```
importable(C) = Component − C
imported(X)   = X.imports.exports        — what the Imports of a Component or a Deployment take
access(C)     = (C.*parent).interactions ∪ imported(C).interactions
```

and the same for Languages, Transformations and Mediums.

**What an Import relies on**, by what it takes:

| Takes | Relies on | Valid where |
|---|---|---|
| a **Language** | a vocabulary | wherever it is in the System |
| a box's **Interactions**, or an exported child box | an **interface**: any implementation will do | everywhere |
| a **Deployment** | what it **exposes**: its APIs, and those of the boxes it exposes | wherever what keeps it is loaded: an ordinary dependency |
| an **identity** | that object: its interface, and its Deployment if it runs one | where it exists (see *Deployment*) |

Importing a Deployment is not about identity: it relies on what the Deployment exposes,
and requires no Instance to run it. A plug-in importing another plug-in's Deployment of a
box needs that plug-in loaded; it plugs in through a box the Deployment exposes, which
exists only inside Instances running it, so it can be chosen only there, by construction.

An Import may take no Exports at all: it is then of the Component as a whole — for a
Deployment, to place it, if it is top-level, or because it is kept outside the box it
lays out. `Server` and `Client` each place a `physics` of their own, in their own
Deployments: one Component, not one shared thing. A library Component, brought into a
System from outside, is imported the same way, and its Mediums with it.

**Interfaces and implementations, imported.** Importing an interface is to implement it —
keep a Deployment of it — or to consume it: call its Interactions, or place it and let a
Configuration fill it. Importing an implementation is to take part in it: a Deployment of
it, relied on for what it exposes.

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

A **Deployment** is one way to build a box: its internal layout. It is **of** one box, its
Component, and **kept** in one Component, its keeper: the box itself, or another, such as a
plug-in package, which then imports the box. A box may have any number — options, such as
`Online` and `Local` for the game — or none, and is then an interface.

A Deployment is **abstract**. Its Instances are **placements**: what a real Instance
running it will contain, real only there. A real Instance running a Deployment has one
real Instance inside it per placement, so **identity has structure**: an identity is a
**path** of placements from the root — the System is the one real Instance of its root —
each a placement in the Deployment the one before it runs. A single placement names a
structure; only a path names an object. Where two real Instances run one Deployment, each
of its placements stands for two objects.

- An **Instance** is a placement of a box in the Deployment's **scope**: a child of its box
  or of the box's ancestors, a child of its keeper or of the keeper's ancestors, or a
  top-level Component the Deployment imports. Another Component's child is placed only
  inside that Component: it is part of its implementation. An Instance is **named**,
  uniquely within its Deployment, since a Deployment may hold several of one box: `server`
  and `backup` may both be of `Server`. It has a **range**, as an end has: how many occupy
  it — `1..1` one, `0..1` optional, `1..N` one or more, `0..N` any number. It may **run** a
  Deployment of its box, fixed by the design; otherwise a Configuration chooses, per
  occupant, or leaves it an interface.
- A **Connection** is the layout's structure, through interfaces: from an Instance to what
  offers some Interactions — another Instance, whose box offers them or exports an API that
  does; an **identity** the Deployment imports; or the Deployment's box, to call out
  through it, for what the box offers or the Deployment imports. Those Interactions are the
  Connection's **What**; they are all over one Language. Its direction is always the same:
  from what uses the What to what offers it. A Connection never supplies a Deployment's
  needs: those are met by presence (see *What is verified*).
- A Deployment **imports** what it needs (see *Import*), and **exposes** some of its
  placements: as APIs, to what imports it, and as the steps an identity may go through.

A Connection to an Instance with more than one occupant reaches every occupant. That is
how one caller informs many without knowing them — an **event**: an Interaction without
an output, connected to an Instance of range `0..N`, each occupant of which is told.

An Interaction may be reached by any number of Connections (a central service with many
users), and an Instance may reach the same Interaction on several Instances (a load
balancer, connected to each runner). There is no two-way Connection: `a → b` and `b → a`
are two Connections, each its own dependency.

**Calls and construction.** Two kinds of dependency follow. A **call** is a Connection: it
binds late, once everything is built, and calls may loop — `A` calls `B`, and `B` notifies
`A`. **Construction** is a Deployment's Import of a Deployment, or of an identity running
one: building it waits for one realized. Construction performs no Interactions, so an
Import of an interface never takes part in it, and interfaces import no Deployments. A
construction loop — `A'` built on `B'`, built on `A'` — never resolves; whether one exists is
a rule (`construction_acyclic`), not structure.

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

Mediums are exported and imported like Interactions and Transformations. To mediate a
Connection over a Medium, the Connection's Deployment must have access to it: its box's or
its keeper's, or theirs, or one it imports — for `A₁` and `A₂` to talk over HTTP, `A`'s
Deployment imports the HTTP Medium from the Component that exports it.

A **Mediation** of a Connection has

1. a **What**: the Interactions it mediates, and so their Language `L`;
2. a **How**: a Medium the Connection's Deployment has access to;
3. optionally, a **realization**: Transformations `down: L → H` and `up: H → L`, forming a
   round trip.

A Mediation mediates Interactions, and so the Entities they are made of. Saying which
Medium a What passes over is already part of the design; realizing it says more: `down`
and `up` say that each use of the What goes into the Medium and comes back out, its
Parameters on the way in and its output on the way back. A design may realize a
Mediation or not; the model requires nothing more, and a verification script may (see
*Standard rules*). A realization that is given must be right, and it is the Deployment's:
it belongs to the Deployment whose layout has the Connection, which must have access to it
— its box's or keeper's, or theirs, or imported. It is never placed: the Mediation itself
is its Instance. The ends never know it; they do not know how they are connected.
Typically the realization is a Component of its own, beside them, which exports it and
which the Deployment imports from.

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
| W9 | **Imports.** Every Import belongs to one Component or one Deployment, and is from a Component, taking only its Exports, or is an identity, taking none, imported only by a Deployment; a Component's Imports take only Languages. | Contexts; Deployment for Deployments and identities |
| W10 | **Placement.** Every Instance is of a box in its Deployment's scope, and runs only a Deployment of its own box; no two Instances of a Deployment share a name; a Deployment kept outside its box imports it; every Connection goes from an Instance of its Deployment, for Interactions over one Language, to exactly one of an Instance of the same Deployment whose box offers them (its own or an exported API's), an identity the Deployment imports whose box offers them, or the Deployment's box, which offers them or whose Deployment imports them. | Deployment |
| W11 | **Mediums.** Every Medium's call is an Interaction of the Component that defines the Medium, over the Medium's Language. | Mediation |
| W12 | **Mediations.** Every Mediation has a Medium its Connection's Deployment has access to. A realization, if given, is `down: L → H` and `up: H → L`, where `L` is the What's Language and `H` the Medium's — read as their vocabularies — accessible to the Connection's Deployment. A Connection's top Mediation mediates its What; each one below, the call of the Medium above it. | Mediation |
| W15 | **Exports.** Every Export belongs to one Component or one Deployment, and has exactly one target: one of its Component's own Languages, Interactions, Transformations or Mediums, one of its children, or a Deployment it keeps; or, for a Deployment, one of its own placements. | Contexts; Deployment for Deployments and placements; Mediation for Mediums |
| W16 | **Identities.** An identity's Steps are one chain; the first is a placement in a Deployment of the System's root, each after it a placement in a Deployment of the box the step before it is of, and each is a placement its Deployment exposes. | Deployment; Systems for the root |

W7 (mappings), W13 (Configurations) and W14 (`implements`) belonged to earlier versions of
the core, and their numbers are not reused.

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
| O5 | **Substitution.** A Deployment of a box, kept outside it, offers every Interaction of the box, as it is specified, wherever an Instance runs it. |

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
- **Deleting a Component** removes everything it owns, recursively; the Deployments it
  keeps, and every Deployment of it, wherever kept; every Medium of it; its Exports and
  Imports; every Export of it, and every Import from it; every Instance of it, and every
  Connection from or to those Instances.
- **Deleting an Export** takes it out of every Import that
  took it; an Import left taking nothing stays, of the Component as a whole.
- **Deleting a Deployment** removes its Instances, Connections, Imports and exposures.
- **Deleting an Instance** removes every Connection from or to it, every exposure of it,
  and every identity through it, with the Connections to it.

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
- **Shared:** a Component that its siblings' Deployments place, each an Instance of its
  own. A Component may be both, or neither.
- **Interface:** a Component with no Deployment: its implementation is undefined.
- **Implementations:** a Component's Deployments, wherever they are kept.
- **API:** what a Component exports, resolved: `resolve(C.exports)`.

A Component's dependencies are its Imports, those of the Deployments it keeps, and its
children's that reach outside it. Depending on a Component nested in another is depending
on what it is nested in, up to the first Component both share: a child does not exist
without its parent. Two Components importing from each other are two dependencies, not
one two-way link; whether that is allowed is a rule (`imports_acyclic`).

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

## What is verified

Two things, by two parts of the tool:

- **Structure, everywhere, by the diagnoser.** The conditions of *Well-formedness* hold for
  everything in a System, chosen or not: a Connection to a missing Instance is a broken
  reference wherever it is.
- **Meaning, for the current Configuration, by the verifier.** A Configuration chooses the
  Deployment of the System's root, and, for each occupant below, the Deployment of its box
  it runs, or none. The verifier runs on that alone. A Deployment is meaningless out of
  context: one no Configuration in use chooses is not verified, for fit or by rules. A
  System with no Configuration has every Deployment read.

A Configuration fits the design (the tool's checks of it):

- **C1.** Every Choice is of a Deployment of its occupant's box — the root's for the root
  Choice — for a placement of the Deployment chosen above, and agrees with what the
  placement runs, if fixed.
- **C2.** No Instance has more occupants chosen than its range.
- **C3.** Every identity a chosen Deployment imports exists: its path is the path of an
  occupant.
- **C4.** Every need of a chosen Deployment is present: some occupant runs each Deployment
  it imports, and some occupant offers each Interaction it imports — anywhere in the
  Configuration; which one is not asked. This is what it means for a Deployment to *fit its
  environment*; Connections take no part in it.

## Standard rules

`systemathic.std` provides common rules to include in a profile. Rules over Deployments,
Connections and Mediations read only those the current Configuration uses:

| Rule | Checks | Default severity |
|------|--------|------------------|
| `opacity` | Every mediated Connection is opaque (see *Stacks*). | Error |
| `mediation_separate` | Every Mediation joins two levels: its What's Language and its Medium's are not one, nor does either extend the other. | Error |
| `medium_blind` | No Medium knows what it carries: the Component defining a Medium uses no Language mediated over it. | Error |
| `mediators_minimal` | A mediator knows its two Languages, and only them: a Component realizing a Mediation uses nothing else. | Error |
| `projection_acyclic` | No Language is projected, eventually, into itself. | Error |
| `generic_level` | All arguments of a generic instantiation belong to one Language. | Error |
| `imports_acyclic` | No Component depends, eventually, on itself — no two Components import from each other, wherever they are. | Warning |
| `interactions_abstract` | Every Interaction a Deployment imports is abstract: nothing is reached through an implementation vocabulary. | Warning |
| `fan_out_silent` | An Interaction carried to a ranged Instance gives nothing back. | Error |
| `construction_acyclic` | The current Configuration can be built: no occupant waits, eventually, on itself. | Error |
| `apis_placed` | A Deployment places every API its box exports: an extension point an interface declares is there in every implementation. | Warning |

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

**The shape of a level.** A Component's Deployment is the level below it. It may be one
domain, whose parts talk in one Language, or a chain of domains, where the meaning changes
from one to the next. These rules name the Components whose Deployments must have a shape:

| Rule | Checks |
|------|--------|
| `uniform(*components)` | One of each Deployment's Connection Languages contains all the others in its vocabulary. Two sibling extensions of one core are two domains. |
| `pipeline(*components)` | Each Deployment is a straight chain of disjoint domains. Where the domain changes, the Instance is a translator that knows only the two; every other Instance knows only its own. |

A translator changes what passes, one way; a mediator (see *Mediation*) keeps it, there and
back.

---

# Out of scope

- **Internal consistency.** The tool does not prove that a Language's axioms can hold
  together, or that an implementation satisfies them.
- **Behaviour over time.** There are no pre/postconditions, states or transitions.
  Axioms say what is always true; lifecycles that matter are modelled as vocabulary.
- **Wiring mechanics.** A Deployment says which Instances exist, who calls whom through
  their interfaces, and over what. How they are constructed and connected (dependency
  injection, containers, lifetimes) is coupling mechanics, not design: a Deployment's needs
  are met by presence. Which Deployment each Instance runs is chosen outside the core.
- **Infrastructure.** Machines, networks and reachability are not special. A machine
  boundary is a Mediation a Connection is carried over; where an Instance physically runs,
  when it matters, is vocabulary of a deployment Language, carried like any other.
- **Requirements.** What the System is for is not modelled; the design realizes it.
