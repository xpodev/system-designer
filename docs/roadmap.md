# Roadmap: what the design says that the tool does not yet

The tool's design is [system-designer.systemathic.json](system-designer.systemathic.json),
verified against [system-designer.rules.py](system-designer.rules.py). The tool was rebuilt
from it on the six-layer core, and now reads `systemathic/4`, and opens and verifies it. Wherever the
design still says more than the tool can express, the System holds a stand-in. This is the list
of those stand-ins, of how the tool's own architecture still differs from the design, and of
what is still open in the design.

## Foundation changes

Agreed, and now in [foundation.md](foundation.md) and `schema/`, which
[`schema/design.py`](../schema/design.py) keeps to the design's vocabulary:

1. **Functions.** A layer between Kernel and Contexts holding **Function** and **Parameter**.
   Interaction and Transformation are Functions. A Transformation takes inputs in one Language
   and gives an output in another; no Relationship between the two is required.
2. **`implements`** — *superseded by 13*: a Component implemented another, the implemented one
   an interface whose children were its default implementation.
3. **`output 0..1`.** An Interaction may give nothing back. There is no Unit: it would cross
   Languages.
4. **Instance ranges.** An Instance has a range; `0..N` is a fan-out, which is how events work.
5. **Systems is the top Language.** It holds System, and ties the layers together.
6. **Configuration leaves the core.** It is the tool's: **Configurations** is a metadata type
   provider, like Documentation and By Value, with its Configuration Store in the Tool. A
   Configuration chooses, per Instance occupant, the Deployment of its box it runs (13), and
   names its profile.
7. **Std vocabulary is dropped.** Actions and the like are the UI's business only.
8. **Language packages.** A package of Languages is not a Component.
9. **Transformations are signatures only.** Entity and Relationship mappings, context Entities
   and deferrals go, with the axioms over them and the std rule `completeness`. How a
   Transformation maps is the implementation's business; a round trip is still two
   Transformations whose signatures lead back.
10. **The Kernel derives what it can.** What a Formula mentions is parsed from its text, not
    stored; a Bound is a number, ordered as numbers are; `max` is `0..1`, and absent means N.
11. **Exports and Imports.** A Component's API is its **Exports**: each of one of its own
    Languages, Interactions, Transformations or Mediums, one of its children, or a child's
    Export, re-exported. What is not exported, nothing outside reaches; children still reach
    their ancestors' parts directly. An **Import** is from one Component — which the importer
    may then place, and import from further — and takes some of its Exports, or none. A
    Component may import from its siblings, from what a Component it is nested in imports
    from, and from a Component it, or one it is nested in, reaches through an Export. They
    replace the four `imported…` relationships (W5, W9, W10, W12, W14 rewritten; W15 new),
    and the std rule `exports_interfaces` finds an exported Component with children.
    `scripts/migrate.py` brings files forward: whatever was imported from a Component, it now
    exports.
12. **Exports are global.** What a Component exports, any Component may import, wherever
    the two are: nesting no longer scopes it, and re-exports are gone. W9 keeps only that an
    Import takes Exports of the Component it is from; the root's and packages' own W9
    conditions go, since where a Component is kept is for the tool to resolve. A Component
    offers the Interactions of each child it exports, as an API of its own (W10), and is
    placed beyond its parent's reach only if its parent exports it (W10). `imports_acyclic`
    looks at every Component, not only siblings. `scripts/migrate.py` takes re-exports out.
13. **Boxes and their Deployments** ([proposal](proposals/boxes-and-deployments.md)). A
    Component is a box with an interface; a Deployment is its internal layout, of one box and
    kept in one Component — the box, or another, such as a plug-in package. `implements` goes:
    an alternative implementation is another Deployment of the box; a box with none is an
    interface. Deployments are abstract: their Instances are placements, real under a real
    Instance running them, so an identity is a path of exposed placements from the root (Step,
    W16). A box imports only vocabulary; a Deployment imports its needs, met by presence in the
    current Configuration, never by Connections, which are its structure. An Instance may run
    a fixed Deployment. Realizations belong to the Connection's Deployment, not its ends (W12).
    A Choice names only a Deployment; one Configuration is current, and the verifier verifies
    only what it uses, with checks C1–C4. `exports_interfaces` and `deployments_complete` are
    retired; `fan_out_silent`, `construction_acyclic` and `apis_placed` are new. The format is
    `systemathic/4`; `scripts/migrate.py` brings files forward.

## Stand-ins in the design

What the System holds in place of what it means:

| The design means | The System holds | Where |
|---|---|---|
| a language package (8) | a Component | Systemathic |

The others are gone: every implementation is a Deployment of its interface, kept in the
Component whose code it is (the profile reads it from the design), the fan-outs have range
`0..N`, Metadata Provider `save` and Edit Listener `applied` give nothing back, and the
Configurations Local and Browser are kept as metadata, each choosing what every Instance of
the Tool runs. The Edit Languages are vocabularies of their own, and the clients import no
implementation (`clients_import_interfaces`).

## New tool tasks

Beyond the foundation changes, the tool itself:

- ~~Edit `implements`, ranges, no-output Interactions and Configurations choosing
  implementations~~: done, through ComponentEditor, DeploymentEditor, FunctionEditor and the
  configurations package's ConfigurationEditor.
- ~~The UI, on the new core and format~~: done, with Exports and Imports, and boxes and their
  Deployments: a box's Deployments wherever kept, what a Component implements, a Deployment's
  needs and identities, what an Instance runs, exposing placements, the current Configuration.
- Rule scripts read the current Configuration from the System's attachment; the Workspace in
  scripts (`workspace.plugins`) is still to be designed.
- The tool's own architecture as the design draws it: Edits as data with a single
  `Editor.apply`, and Workspace, Repository and Metadata Providers as separate parts. Today's packages keep
  the current shape (Effects on a History; the Host holding open Systems).
- ~~Removing a thing removes what depends on it, metadata included~~: done. Removing an Entity
  takes every Relationship with an end of it. A Description or a Choice of what is no longer
  there is kept only for undo, and not saved; a Choice of a removed Deployment chooses none.
- ~~Readers take a System, not a Target~~: done. Every reader takes a System, and none reaches
  what edits: Documentation is read from `@systemathic/documentation`, and described through the
  Documentation Store, `@systemathic/documentation-store`.
- ~~Structural errors are the Systemathic formulas verified as StdLib Formula Assertions~~:
  done. The Verifier holds the structural Rule, built in and evaluated in TypeScript: each core
  axiom as a Formula Assertion, the core's ranges, and the fit of the design's Formulas. The
  Diagnoser asks it, and adds only the Suggestions.
- ~~Each metadata provider stores and loads its own metadata; the Repository knows none~~:
  done. A Metadata Provider loads when a System is opened and saves when it is saved, wherever
  it likes: in its attachment, which the Repository keeps with the design without reading it,
  or elsewhere. The Host asks every provider it is given (the standard ones: Documentation and
  Configurations), naming none.
- ~~Profile paths~~: done. A System's profile setting names its script relative to the folder
  of the System's file, and saving the System elsewhere renames it from there.

## Open in the design

- **The design's API.** Exports and Imports were brought in mechanically: each Component exports
  what another imported from it, and an import of a whole Component became an Import of its
  Languages, Transformations and Mediums and of the Interactions its Connections use. Which
  Exports each part's API should have is still to be read through.
- **Describing Exports and Imports.** Systemathic Subjects does not include Export and Import, so
  they cannot be documented on their own.

- **Systems / JSON.** Writing a System as JSON takes a Transformation that is not designed yet;
  nor is how an Edit kind's own content is written, for kinds that extensions add.
- **Rule.** The name is provisional, and the StdLib's Assertions for standard terms are to be
  defined.
- **Saving.** The order in which the Workspace saves through the Repository and asks the providers.
  The tool asks the providers first, each saving into a copy of the System, and then writes the
  copy through the Repository; the design does not say so yet. Nor does it say that a System
  the Repository stores carries the providers' attachments, a segment it keeps without reading:
  the Repository is described as storing the design only.
- ~~**Clients and Edit Languages.**~~ Done: each Edit Language is a vocabulary of its own
  (Kernel Edits … Configuration Edits), and the profile says clients import no implementation.
- **Dispatch by kind.** The tool routes each call to the one occupant of a fan-out for its kind —
  the Edit Kind for an Edit, the Format for a rendering, the Source for a path — and the model
  cannot say so: a Connection to a ranged Instance reaches every occupant. `fan_out_silent` is a
  warning in the tool's profile until the model can say which occupant answers.
