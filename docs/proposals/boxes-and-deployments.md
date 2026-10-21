# Proposal: boxes and their Deployments

A design change to the core, for agreement before any code changes. It replaces
`implements` with Deployments, makes Instances and Deployments things a design may rely on,
and splits validity in two: a layout is valid by interfaces, and a Deployment *fits* where a
Configuration puts it.

Status: accepted and implemented (`systemathic/4`). Where this text and [foundation.md](../foundation.md) differ, foundation.md is the design. One name differs from the tables below: a Deployment's box is its `component` end (its `of` in the file), beside `keeper`.

## The idea

A **Component is a box with an interface**: the Languages and Interactions others may use
of it, and the APIs it exports. That is all a box is. *How* it does what it does is a
question about its insides, and the answer is a **Deployment**: the box's internal layout.
A box may have several Deployments, the ways it may be built; plug-ins add more.

Placing a box in a layout is an **Instance**. A box on a graph is always an Instance, with
or without a Deployment: in code, one object behind an interface. Each Instance runs its own
Deployment, by identity, not by box type: two Instances of the same box may run different
Deployments.

A **Deployment is abstract**: a structure, real only where a real Instance runs it. The
Instances in its layout are **placements**: what a real Instance running it will contain.
**Identity has structure**: a real Instance running a Deployment has one real Instance inside
it per placement. So an identity is a **path** from the root — the one real Instance, the
System — through a placement in the Deployment it runs, a placement in the Deployment that one
runs, and so on. A single placement names a structure; only a path names an object. Where two
real Instances run the same Deployment, each of its placements stands for two objects, one
under each.

The root is the solution to the highest-level problem. Its Deployments are the ways to solve
it, and a Configuration picks one: the System is, in effect, one Instance of the root, in a
layout of its own.

A box whose Deployment is not chosen, or that has none, is an **interface**: its
implementation is not unknown, it is undefined, and nothing may rely on more than its
interface. An **empty** Deployment is the same as far as relying goes: it describes no insides.
It is still a distinct option to *choose* — an implementation with its insides redacted: the
Markdown and the JSON format are both empty Deployments of one box, and a Configuration picks
one by name. *No* Deployment is the true interface, and stays an option for every occupant;
choosing an empty Deployment already relies on that implementation.

An interface **imports only vocabulary**: the Languages its Interactions are written in.
Whatever calls is a Deployment, and what it calls is its need.

## What is verified

Two things, by two parts of the tool:

- **Structure, everywhere, by the diagnoser.** Structural conditions (W9, W10, W15, …) hold
  for everything in the file, chosen or not: a Connection to a missing Instance is a broken
  reference wherever it is, and is reported without the verifier.
- **Meaning, for the current Configuration, by the verifier.** A Configuration is a choice of
  the root's Deployment, and of everything chosen below it; the verifier runs on that alone.
  A Deployment is meaningless out of context, so one that is not chosen is not verified: not
  for fit (C1–C4), nor by rules — `uniform`, `pipeline` and the rest read only the chosen
  Deployments. This is
what makes "the current Configuration" the thing verified, rather than every Deployment in
the file.

## Two validities

1. **A layout is valid by interfaces alone (design time).** In a Deployment's layout,
   Instances connect through their boxes' interfaces: a box's own Interactions and those of
   the APIs it exports. Nothing on one level relies on how another box on that level is
   built.
2. **A Deployment is valid against its box, and fits an environment (choice time).** A
   Deployment is written against its box's interface, so it is valid for every Instance of
   that box. Its own Imports are its needs, and may be anything exported. Whether it can run
   somewhere is decided when a Configuration chooses it for an occupant: what it imports must
   be there, and agree with what is chosen around it.

## What an Import may rely on

An Import takes Exports, and what it relies on depends on what they are:

| Takes | Relies on | Valid where |
|---|---|---|
| a **Language** | a vocabulary, statically | wherever the Language is in the System |
| a box's **Interactions**, an exported child box, or a box as a whole | an **interface**: any implementation will do | everywhere |
| a **Deployment** | what the Deployment **exposes**: its APIs, and those of the boxes it exposes — as a Component with children does | wherever what keeps it is loaded: an ordinary dependency |
| an **identity**: a path of exported placements from the root | that object: its interface, and the layouts along the path, since it exists only in them | in a Configuration whose choices along the path place it |

Importing a Deployment is not about identity, and nothing new: like any Import, it is a
dependency. A plug-in importing another plug-in's Deployment requires that plug-in to be
loaded into the System, and requires no Instance to run the Deployment. If `Act` is an interface and a
plug-in supplies `Impl`, a Deployment of `Act`, another plug-in importing `Impl` does not care
whether any `Act` is an `Impl`: given some `Impl`, it can plug into it. It plugs in through a
box `Impl` exposes, an extension point in `Impl`'s own layout, which exists only inside
Instances running `Impl`: so it can be chosen only there, by construction. Where no Instance
runs `Impl`, it is unused, not wrong.

An imported identity that runs no Deployment is an interface, which is what it is. One that
runs a Deployment — chosen in the current Configuration, or fixed — is that interface and that
Deployment both: `B'` importing `id(C)`, where `C` runs `C'`, imports `C` and `C'`. Importing
from a Deployment can never be an identity: its placements are not
real, only what a real Instance running it will contain.

A ranged placement (`0..N`) has occupants only in a Configuration, so a design cannot name one
of them: a path through it names every occupant, and calling it is a fan-out.

## Entities and Relationships

### Contexts

| | Before | After |
|---|---|---|
| Component | owns Languages, Interactions, Transformations, child Components, Exports, Imports, Deployments; `implements` Components | the same, without `implements`; it **keeps** Deployments, which may be of another box |
| `implements` / `implementations` | Component → Component | **removed**: an alternative implementation is another Deployment of the box |
| Export target | one of its own Language, Interaction, Transformation, Medium, or a child Component | the same, and one of the Deployments it keeps; a Deployment exports what it **exposes**: placements of its layout, as APIs, never as objects |
| Export `exporter` | Component | Component, or **Deployment** |
| Import `importer` | Component | Component, for vocabulary only (the Languages its interface is written in), or **Deployment**: its needs, and everything they bring, transitively |
| Import `from` | Component | Component, Deployment (what it exposes), or an **identity**: a path of exported placements from the root, each in a Deployment of the box of the one before |

### Deployment

| | Before | After |
|---|---|---|
| Deployment `component` | `1..1`: the Component it puts together, and where it is kept | split in two: **`of`** `1..1`, the box it lays out; **`keeper`** `1..1`, the Component it is kept in (the box itself, or another, such as a plug-in package) |
| Instance `of` | a child of the deployed Component, or one it imports | a box in the Deployment's **scope**: a child of its box or of the box's ancestors, a child of its keeper or of the keeper's ancestors, or a top-level Component it or its keeper imports |
| Instance `runs` | — | **new**, `0..1` Deployment of its box: fixed by the design; absent, a Configuration chooses |
| Connection `to` | an Instance of the same Deployment | an Instance of the same Deployment, or an **Instance the Deployment imports** (identity reaches outside the layout) |
| Connection `toComponent` | the deployed Component, for what it offers or imports | the Deployment's box: for what it offers, or for what the Deployment imports — a call out, which its need's presence answers, not a wire |

### Configurations (the tool's metadata)

| | Before | After |
|---|---|---|
| Choice | per occupant: the Component that fills it (the placed one or an implementer), and its Deployment | per occupant: a **Deployment** of the Instance's box, or none (it stays an interface) |

## Conditions

Structural (what the model means), changed or new:

- **W9, Imports.** An Import takes only Exports of what it is from; every imported Interaction
  is over a Language the importer uses. *Unchanged in substance; importer and `from` may be
  Deployments.*
- **W10, Placement.** Every Instance is of a box in its Deployment's scope; `runs`, if given,
  is a Deployment of that box; no two Instances of a Deployment share a name.
- **W10, Connections.** A Connection goes from an Instance of its Deployment, for
  Interactions over one Language, to an Instance of the same Deployment whose box offers them,
  to an identity the Deployment imports, or to the Deployment's box. Connections are the
  layout's structure, through interfaces; they never supply a Deployment's needs.
- **W12, Mediations.** A realization is accessible to the Deployment whose layout has the
  Connection — imported by it, never placed: the Mediation is the Instance. The ends need no
  access to it. *Replaces the six end-access conditions.*
- **W14, Implementations.** *Removed* with `implements`.
- **W15, Exports.** An Export has exactly one target, its exporter's own; a Deployment exports
  only its own Instances.
- **Deployments.** A Deployment's `keeper` is its box, or a Component that imports its box.

Configuration checks, in the configurations package (what a Configuration means):

- **C1.** Each Choice is a Deployment of its occupant's box, or none; it agrees with the
  Instance's `runs`, if fixed.
- **C2.** No Instance has more occupants than its range. *(As today.)*
- **C3, identity.** Every identity a chosen Deployment imports exists under this
  Configuration: each step of its path is a placement in the Deployment chosen, or fixed, for
  the step before it.
- **C4, needs are presence.** For every Import of a chosen Deployment: a Deployment it imports
  is run by some occupant of the Configuration; a box whose interface it imports has some
  Instance; an identity it imports exists (C3); a Language, nothing beyond being loaded. Which
  Instance answers is not required, nor where it is: only that one exists, anywhere in the
  Configuration. This is what *fits its environment* means; Connections take no part in it.

Two kinds of dependency follow, and only one may loop:

| Kind | From | Binds | Cycles |
|---|---|---|---|
| **Call** | a Connection: the layout's structure | late, once built | allowed: `A` calls `B`, and `B` may notify `A` |
| **Construction** | an Import of a Deployment: one built on another | early: to build `B'`, some `C'` is realized first | never resolve: `A'` on `B'` on `A'` |

**Construction performs no Interactions.** This is what makes calls late-bound, and why an
Import of an interface never takes part in construction. Interfaces import no Deployments, so
nothing at the interface level can loop. Whether construction can be ordered is a rule, not
structure (below).
- An Import of a Deployment asks nothing of a Configuration: it is a dependency, resolved when
  what keeps the Deployment is loaded, and what plugs into it can be chosen only inside an
  Instance running it.
- An occupant left without a Deployment is checked by its interface only.

Standard rules (opt-in), changed or new:

- `deployments_complete` is **retired**: needs are Deployments', checked by presence (C4), and
  Connections are structure, not supply.
- `exports_interfaces` is **retired**: exporting a child box hands out its interface only.
- **New** `fan_out_silent`: an Interaction carried to a ranged Instance gives nothing back.
- **New** `construction_acyclic`, over a Configuration: its occupants can be built in some
  order. An occupant waits for *some* occupant running each Deployment its own imports, and for
  the very occupant of each identity it imports that runs a Deployment. Build, repeatedly, any
  occupant whose waits are met; whatever is left is a construction loop, and the rule names it,
  with what each waits for. Calls do not count. Unlike the
  rules so far, it reads a Configuration, so rule scripts need Configurations in reach — the
  Workspace in scripts, not designed here.
- **New**, opt-in: a Deployment places every API child its box exports, so that an extension
  point declared by an interface is there in every implementation.
- `imports_acyclic`: importing from a nested box, or an Instance, counts as depending on what
  contains it, up to the first ancestor importer and imported share.

## Worked cases

A storage box, `Storage`, with Deployments `Disk` and `Cloud`; a System places three
Instances, `primary` (fixed to `Cloud`), `replica` and `archive` (chosen by Configuration).

| Case | How | Check |
|---|---|---|
| A history plug-in that watches every storage | its Deployment imports `Storage`'s interface, and the identities it watches | C3; calls go to those objects |
| A plug-in calling `primary` | imports the identity `/primary`, a placement in the root's Deployment | C3: the root's chosen Deployment places `primary` |
| A plug-in using `Cloud`'s vocabulary (say, a `Bucket` Language) | imports the Language from the Component that keeps `Cloud` | static; valid wherever it is in the System |
| A cache extending each cloud storage | imports `Cloud`, and supplies a Deployment of `CloudHook`, an extension point `Cloud` exposes in its layout | by construction: `CloudHook` exists only inside storages running `Cloud`; with none, the cache is unused |
| A metrics hook for every storage | a Deployment of `Hook` that imports `Storage`'s interface only | valid inside every storage, of either kind, if each Deployment places `hooks` (the new opt-in rule) |
| A new kind of storage from a plug-in | a Deployment of `Storage` kept in the plug-in's package | C1: a Configuration may choose it for `replica` or `archive`, not for `primary` |
| A plug-in offering a service to other plug-ins | the host places an interface box, `Index`, and exports the placement; the plug-in supplies `Index`'s Deployment; other plug-ins import the identity `/index` | C3; callers do not care which Deployment serves it |
| A plug-in for a plug-in | imports the other plug-in's Deployment, and plugs into what it exposes | by construction, as for the cache |
| A root layout of `A`, `B`, `C`, interfaces, with `A → B → C`; `B'`, a Deployment of `B`, extends `C'`, a Deployment of `C` | `B'` imports `C'`; the root's Connections stay interface-level | C4: a Configuration choosing `B'` has some occupant running `C'` — `C`, or any other; `A` knows nothing of `C`, and `C'` is pinned to no Instance |
| The same, and `B'` also extends `A'`, a Deployment of `A` | `B'` imports `A'`; `A'` calls `B` | C4: some occupant runs `A'`. `construction_acyclic`: `A'` is built before `B'`, since its call on `B` binds late; if `A'` also imported `B'`, nothing could be built first |

In the game, nothing changes in shape: `Online` and `Local` are the root's Deployments;
`Server` and `Client` are boxes placed in them; `Physics` is placed inside both, each Instance
its own.

## Migration

- A Component `X` that implements `I` becomes a keeper of Deployments of `I`: each of `X`'s
  Deployments becomes one `of: I` kept in `X`, and an `X` with none gives one empty Deployment,
  named for `X` — an option to choose, relied on as the interface.
- A Component's Imports of Interactions move to its Deployments, as their needs; it keeps its
  Imports of Languages.
- A realization accessible to a Connection's ends becomes an Import of the Connection's
  Deployment. `X`'s children stay in `X`, in the Deployments' scope.
- An Instance of `X` becomes an Instance of `I` that `runs` `X`'s Deployment.
- A Configuration's Choice of `X` becomes a Choice of that Deployment.
- `scripts/migrate.py` does this for files; the tool's own design and UCAD both use
  `implements` and move with it.

## What stays, and what waits

On the branch, unchanged by this: global Exports, the per-Mediation rules, `uniform`,
`pipeline`. Waiting for this: moving the Edit Languages out of implementations, and treating
an exported child as an interface; both are redone in these terms.

## Settled

1. An empty Deployment is an interface for relying; it is still an option to choose, by name.
2. An interface imports only vocabulary; calls are Deployments' needs, met by presence (C4),
   never by Connections, which are a layout's structure.
3. Importing a Deployment brings its dependencies; what it defines is reachable wherever it is.
4. A realization belongs to the Deployment whose layout has the Connection, not to its ends.
5. An identity is a path of placements from the root, written as an ordered list of Instances.
6. C4 counts presence anywhere in the Configuration; ordering construction is the opt-in
   rule `construction_acyclic`; calls are late-bound and may loop.

7. Only the current Configuration's Deployments are verified, for fit and by rules.
8. Construction performs no Interactions; interface Imports never take part in it.
9. An imported identity is an interface if it runs no Deployment, and that interface and its
   Deployment if it runs one.

10. Structure is checked everywhere, by the diagnoser; meaning only for the current
    Configuration — the chosen root Deployment and what is chosen below it — by the verifier.

Nothing is left to confirm: the proposal is ready for sign-off.
