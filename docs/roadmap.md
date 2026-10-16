# Roadmap: what the design says that the tool does not yet

The tool's design is [system-designer.systemathic.json](system-designer.systemathic.json),
verified against [system-designer.rules.py](system-designer.rules.py). The tool was rebuilt
from it on the six-layer core and `systemathic/3`, and opens and verifies it. Wherever the
design still says more than the tool can express, the System holds a stand-in. This is the list
of those stand-ins, of how the tool's own architecture still differs from the design, and of
what is still open in the design.

## Foundation changes

Agreed, and now in [foundation.md](foundation.md) and `schema/`, which
[`schema/design.py`](../schema/design.py) keeps to the design's vocabulary:

1. **Functions.** A layer between Kernel and Contexts holding **Function** and **Parameter**.
   Interaction and Transformation are Functions. A Transformation takes inputs in one Language
   and gives an output in another; no Relationship between the two is required.
2. **`implements`.** A Component may implement another: the implemented Component is an
   interface, and its own children are its default implementation.
3. **`output 0..1`.** An Interaction may give nothing back. There is no Unit: it would cross
   Languages.
4. **Instance ranges.** An Instance has a range; `0..N` is a fan-out, which is how events work.
5. **Systems is the top Language.** It holds System, and ties the layers together.
6. **Configuration leaves the core.** It is the tool's: **Configurations** is a metadata type
   provider, like Documentation and By Value, with its Configuration Store in the Tool. A
   Configuration chooses, per Instance occupant, the Component that fills it (the placed one or
   an implementer) and its Deployment, and names its profile.
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

## Stand-ins in the design

What the System holds in place of what it means:

| The design means | The System holds | Where |
|---|---|---|
| a language package (8) | a Component | Systemathic |

The others are gone: every implementation `implements` its interface (the profile reads it
from the design), the fan-outs have range `0..N`, Metadata Provider `save` and Edit Listener
`applied` give nothing back, and the Configurations Local and Browser are kept as metadata,
each choosing what fills every Instance of the Tool.

## New tool tasks

Beyond the foundation changes, the tool itself:

- ~~Edit `implements`, ranges, no-output Interactions and Configurations choosing
  implementations~~: done, through ComponentEditor, DeploymentEditor, FunctionEditor and the
  configurations package's ConfigurationEditor.
- ~~The UI, on the new core and format~~: done, with Exports and Imports.
- The tool's own architecture as the design draws it: Edits as data with a single
  `Editor.apply`, Readers that take a System, structural errors as StdLib Formula Assertions,
  and Workspace, Repository and Metadata Providers as separate parts. Today's packages keep
  the current shape (Effects on a History; the Host holding open Systems).
- Removing a thing removes what depends on it, metadata included. Today removing an Entity leaves
  its Relationships dangling. (A removed thing's Description is no longer saved; it is kept only
  for undo.)
- Readers take a System, not a Target; structural errors are the Systemathic formulas verified as
  StdLib Formula Assertions.
- Each metadata provider stores and loads its own metadata; the Repository knows none.
- Profile paths: a System's profile setting names its script relative to where the host runs.
  It should be relative to the System's file.

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
- **Clients and Edit Languages.** UI, MCP Server and API import Documentation Store, By Value Store
  and Systems Editor, which are implementations, to speak their kinds of Edit. Either clients may
  depend on implementations, or those Edit Languages belong where a client can import them
  without one. Until this is decided, the profile has no rule against importing an implementation.
