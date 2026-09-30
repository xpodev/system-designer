# Tool Design

This is the design of the Systemathic tool, written by hand as a Systemathic System. It
uses the notation of [foundation.md](foundation.md) and follows the idea in
[motivation.md](motivation.md). Once the tool exists, this document is translated into
it, and the tool's own design is verified by the tool.

The design is built by **composition and layering**. Each concern is its own Language
and its own Domain; a Domain builds on the ones below it by referencing them and
projecting their vocabulary into its own. Nothing is a god Domain: the core knows
nothing of the tool, the tool knows nothing of its clients, and every client — a UI, an
MCP server, a command line — is a mediation of the same layers.

## Notation

- `A <——> B   ends: a r₁, b r₂` — a Relationship whose end named `a`, with range `r₁`,
  is at `A`, and whose end named `b`, with range `r₂`, is at `B`. So
  `Order <——> OrderLine   ends: order 1..1, lines 1..N` means each line has one order,
  and each order has one or more lines.
- `name(P₁, …, Pₙ) → O` — an Interaction.
- `Language::Entity` — an Entity qualified by its Language, where two Languages have
  Entities of the same name: `Core::System` and `Tool::System`.

## Requirements

The tool lets its clients:

1. **Create, open and save Systems.** An open System is a *system context*.
2. **Edit a System** — add, change and delete everything in it — through an *edit
   session*. Several sessions, from several clients, may edit one system context at the
   same time.
3. **Hold an ill-formed System.** Editing never refuses a change for being ill-formed.
   Every problem is shown where it is, with what it is and how to fix it.
4. **See structural errors, diagnostics and statistics.** Structural errors — violations
   of the core's well-formedness — must be solved before a System is verified.
5. **See a System from many points of view**, as data any client can use: an outline,
   each Language, the map of Domains, the stack of Mediations, the levels, diagnostics.
6. **Verify a System** against a profile of rules, run by scripts.
7. **Export a specification**, in representations fit for different validators: Markdown
   for a human or an LLM, JSON for a machine.
8. **Import** Languages, Domains and Mediations from a catalog of standard ones — JSON,
   HTTP, TCP, IP, Ethernet, REST, WebSocket, Bytes, SQL, HTTP over TCP, … — or from a
   file. Export any selection to a file.
9. **Be driven by any client**: a visual UI for people, an MCP server for LLMs, a
   command line for automation. A new client is a new mediation; nothing above it
   changes.

## Layers

```
 Clients (how)             UI           MCP            CLI
                            ▲            ▲              ▲
 ─────────────────────────  │ mediations │              │  ─────────────────────────
                            │            │              │
 Tool contexts (what)   Editor   Perspectives   Verifier   Diagnoser   Exporter   Catalog
                            ╲          │           │          │          │        ╱
                             ╲──────────── all project from ─────────────────────╱
                                                   │
 System contexts                                 Tool          new / open / save → SystemContext
                                                   │
 Foundation                                  Core ── Std        the Systemathic Language, and its extension

 Platform (how)      JSON    Python    Markdown    Host
```

Read top to bottom: clients drive the tool contexts; the tool contexts work on system
contexts; system contexts hold Systems written in Core. Each layer sees only the layers
below it, and only by reference.

## Languages

### Core

The Systemathic Language: [`schema/systemathic.json`](../schema/systemathic.json).

### Std

The standard concepts, as an extension of Core (foundation, Part II): Entities for what
std adds — an `Action` with its `primary` Parameter, a `Deferred` mapping, a designated
`Comparison` — projected from Core. Derived terms such as *pure*, *abstract* and *top
Domain* are formulas over Core, not Entities.

### Tool

Systems as the tool keeps them, and the contexts they are open in.

Entities: `System`, `Design`, `Attachment`, `Owner`, `SystemContext`.

```
System        <——> Design       ends: system 0..1,      design 1..1
SystemContext <——> Design       ends: context 0..1,     design 1..1
System        <——> Attachment   ends: system 0..1,      attachments 0..N
SystemContext <——> Attachment   ends: context 0..1,     attachments 0..N
Attachment    <——> Owner        ends: attachments 0..N, owner 1..1
```

```
axiom: all d in Design. (some d.system and no d.context) or (some d.context and no d.system)
axiom: all a in Attachment. (some a.system and no a.context) or (some a.context and no a.system)
```

```
new() → SystemContext
open(System) → SystemContext
save(SystemContext) → System
```

- A `Tool::System` is what the tool stores: a `Design` — a `Core::System`, seen from the
  tool — and **attachments**.
- An `Attachment` is data the tool carries with a System without interpreting it,
  identified by its `Owner`: a client's layouts, a default verification profile, where
  imported content came from. The tool never knows what is inside.
- A `SystemContext` is a System open in the tool. It is the unit everything else works
  on: editing, verification, diagnosis, points of view, export.

### Editing

Changing a System, by any number of clients at once.

Entities: `Target`, `EditSession`, `History`, `Edit`, `Addition`, `Change`, `Removal`,
`Element`, `Selection`.

```
Target      <——> Element      ends: target 1..1,     elements 0..N
Target      <——> History      ends: target 1..1,     history 1..1
Target      <——> EditSession  ends: target 1..1,     sessions 0..N
History     <——> Edit         ends: history 1..1,    edits 0..N
Edit        <——> Edit         ends: previous 0..1,   following 0..1
Edit        <——> Edit         ends: revertedBy 0..1, reverts 0..1
Edit        <——> EditSession  ends: edits 0..N,      author 1..1
Edit        <——> Element      ends: edits 0..N,      elements 1..N
Edit        <——> Addition     ends: edit 0..1,       addition 0..1
Edit        <——> Change       ends: edit 0..1,       change 0..1
Edit        <——> Removal      ends: edit 0..1,       removal 0..1
EditSession <——> Selection    ends: session 1..1,    selection 1..1
Selection   <——> Element      ends: selections 0..N, elements 0..N
```

```
axiom: all e in Edit. (some e.addition and no e.change and no e.removal) or (some e.change and no e.addition and no e.removal) or (some e.removal and no e.addition and no e.change)
axiom: all e in Edit. e.author.target == e.history.target
axiom: all e in Edit, x in e.elements. x.target == e.history.target
axiom: all e in Edit, r in e.reverts. r.author == e.author
axiom: all e in Edit. not e in e.^following
axiom: all s in Selection, x in s.elements. x.target == s.session.target
```

```
startSession(Target) → EditSession
undo(EditSession) → Edit
```

- A `Target` is a system context, seen from editing. It may be ill-formed.
- An `EditSession` is one client editing one Target. Each client starts its own; its
  `Selection` is its own.
- The `History` is **one chain** of Edits shared by every session of a Target, in the
  order they were applied. Every Edit records its `author`. This is what makes
  concurrent editing coherent: sessions never keep diverging copies; they all see the
  same chain.
- Every Edit is exactly one of `Addition`, `Change` or `Removal`. A Removal of a Language
  or a Domain carries its whole cascade, as the foundation defines it.
- **Undo** is a new Edit that `reverts` one of the session's own earlier Edits. A session
  undoes its own work, never another client's, and history only grows.

### Perspectives

Points of view on a System, as data.

Entities: `Perspective`, `View`, `Item`, `Link`, `Subject`, `Mark`.

```
View <——> Perspective   ends: views 0..N,    perspective 1..1
View <——> Item          ends: view 1..1,     items 0..N
View <——> Link          ends: view 1..1,     links 0..N
Link <——> Item          ends: outgoing 0..N, source 1..1
Link <——> Item          ends: incoming 0..N, target 1..1
Item <——> Item          ends: parent 0..1,   children 0..N
Item <——> Subject       ends: items 0..N,    subject 1..1
Item <——> Mark          ends: item 1..1,     marks 0..N
```

```
axiom: all l in Link. l.source.view == l.view and l.target.view == l.view
axiom: all i in Item, c in i.children. c.view == i.view
axiom: all i in Item. not i in i.^parent
```

- A `View` is one point of view: Items (with an outline's parent/children structure)
  and Links between them, each Item about a `Subject` of the System.
- The tool starts with these `Perspective`s: **Outline**, **Language**, **Domain map**,
  **Mediation stack**, **Levels**, **Diagnostics**, **Statistics**.
- A `Mark` is a Diagnostic on an Item.
- A View has no positions, sizes or colours: how it is drawn is the business of the
  client that draws it. An LLM reads the same View as structured data.

### Diagnostics

What is wrong with a System, and what can be measured about it.

Entities: `Diagnostic`, `Severity`, `Subject`, `Check`, `Condition`, `Rule`, `Suggestion`,
`Metric`, `Measure`.

```
Diagnostic <——> Severity     ends: diagnostics 0..N, severity 1..1
Diagnostic <——> Subject      ends: diagnostics 0..N, subjects 1..N
Diagnostic <——> Check        ends: findings 0..N,    check 1..1
Check      <——> Condition    ends: check 0..1,       condition 0..1
Check      <——> Rule         ends: check 0..1,       rule 0..1
Diagnostic <——> Suggestion   ends: diagnostic 1..1,  suggestions 0..N
Suggestion <——> Subject      ends: suggestions 0..N, subjects 0..N
Metric     <——> Subject      ends: metrics 0..N,     subject 1..1
Metric     <——> Measure      ends: metrics 0..N,     measure 1..1
```

```
axiom: all c in Check. (some c.condition and no c.rule) or (some c.rule and no c.condition)
```

- A `Check` is one of: a `Condition` — a well-formedness condition of the core, W1–W6 —
  or a `Rule` of a verification script.
- A `Diagnostic` of severity *error* found by a `Condition` is a **structural error**.
- A `Suggestion` is a way to fix a Diagnostic, naming the Subjects it would change.
- A `Metric` is a statistic about a Subject: counts, depths, fan-in and fan-out.

### Verification

Scripts, profiles, and their results.

Entities: `Script`, `Rule`, `Profile`, `Severity`, `Run`, `Snapshot`, `Violation`,
`Subject`.

```
Script    <——> Rule        ends: script 1..1,     rules 0..N
Script    <——> Profile     ends: script 1..1,     profiles 0..N
Profile   <——> Rule        ends: profiles 0..N,   rules 0..N
Rule      <——> Severity    ends: rules 0..N,      severity 1..1
Run       <——> Profile     ends: runs 0..N,       profile 1..1
Run       <——> Snapshot    ends: runs 0..N,       snapshot 1..1
Run       <——> Violation   ends: run 1..1,        violations 0..N
Violation <——> Rule        ends: violations 0..N, rule 1..1
Violation <——> Subject     ends: violations 0..N, subjects 1..N
Subject   <——> Snapshot    ends: subjects 0..N,   snapshot 1..1
```

```
axiom: all v in Violation. v.rule in v.run.profile.rules
axiom: all v in Violation, s in v.subjects. s.snapshot == v.run.snapshot
```

```
verify(Snapshot, Profile) → Run
```

- A `Snapshot` is a system context exactly as it was verified.
- A Profile may use Rules from any Script, including the standard rules of
  `systemathic.std`.

### Specification

A design, exported as a contract for validators.

Entities: `Specification`, `Section`, `Statement`, `Subject`, `Requirement`,
`Obligation`.

```
Specification <——> Section       ends: specification 1..1, sections 0..N
Section       <——> Section       ends: parent 0..1,         subsections 0..N
Section       <——> Statement     ends: section 1..1,        statements 0..N
Statement     <——> Subject       ends: statements 0..N,     subjects 1..N
Specification <——> Requirement   ends: specification 1..1, requirements 0..N
Specification <——> Obligation    ends: specification 1..1, obligations 0..N
Obligation    <——> Subject       ends: obligations 0..N,    subjects 1..N
```

```
axiom: all s in Section. not s in s.^parent
```

- A `Statement` is a design fact: a Language's vocabulary, what a Domain may use, which
  crossings exist.
- A `Requirement` is a design rule, from the profile the design was verified against.
- An `Obligation` is what an implementation must satisfy that no design check can: the
  foundation's validity, round-trip and preservation obligations, for specific Subjects.

### Catalog

Content available to import.

Entities: `Catalog`, `Package`, `Tag`, `Origin`, `Content`, `Import`.

```
Catalog <——> Package   ends: catalog 1..1,  packages 0..N
Catalog <——> Tag       ends: catalog 1..1,  tags 0..N
Package <——> Tag       ends: packages 0..N, tags 0..N
Package <——> Origin    ends: packages 0..N, origin 1..1
Package <——> Content   ends: package 1..1,  content 1..1
Import  <——> Package   ends: imports 0..N,  package 1..1
```

```
axiom: all p in Package, t in p.tags. t.catalog == p.catalog
```

- A `Package`'s `Content` is a `Tool::System`: library content is stored exactly like
  any other System. Its `Origin` is the **standard** catalog or a **file**.
- Exporting a selection produces a Package whose System holds the selection and
  everything it references: the smallest set containing the selection that is closed
  under a Domain's Languages and referenced Domains, a Transformation's holder and
  Languages, a Mediation's three Domains, and everything a Language contains.
- Importing copies a Package's content into a Target through an Addition, so every
  System stays closed.
- Packages do not depend on each other. A Language is closed, so HTTP does not depend on
  TCP; "HTTP over TCP" is a Mediation, and a swappable one — HTTP/3 runs over QUIC. It is
  a Package of its own, which a design stacks on top of.

### Client and platform Languages

To be defined in the library: **UI** (screens, layouts, gestures), **MCP** (tools,
resources, calls), **CLI** (commands, arguments, exit codes), **Python**, **JSON**,
**Markdown**, and **Host** (where a system context lives: a browser tab or a local
process).

## Domains

Each tool Domain references exactly one Language of its own, and builds on others only
by referencing their Domains.

| Domain | Own Language | References |
|---|---|---|
| **Core** | Core | — |
| **Std** | Std | Core |
| **Tool** | Tool | Core |
| **Editor** | Editing | Tool |
| **Perspectives** | Perspectives | Tool, Diagnoser |
| **Diagnoser** | Diagnostics | Tool, Verifier |
| **Verifier** | Verification | Tool, Std |
| **Exporter** | Specification | Tool, Verifier |
| **Catalog** | Catalog | Editor |
| **UI**, **MCP**, **CLI** | UI, MCP, CLI | — |
| **Python**, **JSON**, **Markdown**, **Host** | Python, JSON, Markdown, Host | — |

## Projections

Each Domain projects what it references into its own vocabulary. Only Entity mappings are
listed.

| Held by | Projection | Entity mappings |
|---|---|---|
| Std | Core → Std | `Interaction ↦ Action`, `EntityMapping ↦ Deferred`, … |
| Tool | Core → Tool | `Core::System ↦ Design` |
| Editor | Tool → Editing | `SystemContext ↦ Target` |
| Editor | Core → Editing | every Core Entity `↦ Element` |
| Verifier | Tool → Verification | `SystemContext ↦ Snapshot` |
| Verifier | Core → Verification | every Core Entity `↦ Subject` |
| Diagnoser | Core → Diagnostics | every Core Entity `↦ Subject` |
| Diagnoser | Verification → Diagnostics | `Violation ↦ Diagnostic`, `Rule ↦ Rule`, `Severity ↦ Severity`, `Subject ↦ Subject` |
| Perspectives | Core → Perspectives | every Core Entity `↦ Subject` |
| Perspectives | Diagnostics → Perspectives | `Diagnostic ↦ Mark` |
| Exporter | Core → Specification | `Core::System ↦ Specification`; `Transformation ↦ {Subject, Obligation}`; every other Core Entity `↦ Subject` |
| Exporter | Verification → Specification | `Rule ↦ Requirement` |
| Catalog | Tool → Catalog | `Tool::System ↦ Content` |
| Catalog | Catalog → Editing | `Import ↦ Addition` |

Structural errors come from the Diagnoser evaluating the core's well-formedness on a
system context; violations come from the Verifier and reach the Diagnoser through its
projection. Neither Core, Tool nor Verifier knows diagnostics exist.

## Mediations

Every mediator references exactly the two Languages its Transformation connects.

### Clients

| Mediation | Mediator | What becomes what | Reverse |
|---|---|---|---|
| `Tool / UI` | **UiSystems** | `new`, `open`, `save` ↦ menu commands and file pickers | a command becomes the Interaction |
| `Editor / UI` | **UiEditing** | Edits ↦ forms and direct manipulation | by reference, context `Element`: a gesture becomes an Edit of an Element |
| `Perspectives / UI` | **Rendering** | Views ↦ drawn screens; layouts are kept as UI attachments | by reference, context `Item`: a click resolves to its Item |
| `Tool / MCP` | **McpSystems** | `new`, `open`, `save` ↦ MCP tools | a tool call becomes the Interaction |
| `Editor / MCP` | **McpEditing** | Edits ↦ MCP tools | a tool call becomes an Edit |
| `Perspectives / MCP` | **McpInspection** | Views ↦ MCP resources, as structured data | by reference, context `Item` |
| `Verifier / MCP` | **McpVerification** | `verify` ↦ an MCP tool; Violations ↦ its result | a tool call becomes the Interaction |
| `Tool / CLI` | **CliSystems** | `open`, `save` ↦ file arguments | arguments become the Interaction |
| `Verifier / CLI` | **CliVerification** | `verify` ↦ a command; Violations ↦ output and exit code | arguments become the Interaction |

Each client starts its own EditSession on a system context; the UI and an LLM through MCP
can edit the same System at once, and see each other's Edits in the shared History.

### Platform

| Mediation | Mediator | What becomes what | Reverse |
|---|---|---|---|
| `Core / JSON` | **CoreFormat** | Core ↦ JSON: the Systemathic file format | by value |
| `Tool / JSON` | **ToolFormat** | `Tool::System ↦` a JSON document; its Design in CoreFormat, its attachments opaque | by value: opening a file |
| `Core / Python` | **CoreBinding** | Core ↦ the `systemathic.core` library, generated from the schema; a Parameter chain becomes a list | by reference, context: the loaded System |
| `Std / Python` | **StdBinding** | Std ↦ the `systemathic.std` library | by reference |
| `Verifier / Python` | **RuleHost** | `Script ↦` module, `Rule ↦` function, `Violation ↦` a yielded object | by value: yielded objects become Violations |
| `Exporter / Markdown` | **MarkdownExport** | Sections ↦ headings; Statements and Obligations ↦ items with stable identifiers | by value: the document reads back into a Specification |
| `Exporter / JSON` | **JsonExport** | Specification ↦ JSON | by value |
| `Tool / Host` | **Hosting** | a SystemContext ↦ where it lives | by reference |

`Tool / Host` is where the choice of host lives: a browser tab for solo use, or a local
process that the UI, MCP and CLI all reach. They are two swaps of one mediation; nothing
above Tool changes between them.

`Exporter / Markdown` and `Exporter / JSON` are the same "what" over two "hows": the
specification does not depend on its representation.

## Verification profile

This System is verified against every standard rule, at its default severity, plus:

| Rule | Checks | Severity |
|---|---|---|
| `core_is_pure` | `Core` references only the Core Language, and no Domain. | Error |
| `no_god_domain` | Every Domain that is not a mediator references exactly one Language of its own. | Error |
| `core_knows_nothing` | No Transformation has Core as its target. | Error |
| `clients_are_hows` | UI, MCP and CLI are never the "what" of a Mediation, and no Domain references them. | Error |
| `checking_is_not_editing` | Diagnoser and Verifier do not reference Editor. | Error |

## Obligations

What the implementation must satisfy that the model does not express:

- **One authority per system context.** Edits from all sessions are applied in one
  order, the order of the History, and every session is told of every Edit.
- **Structural errors block verification.** A Run is started only on a Snapshot with no
  structural error.
- **Round trips.** Saving then opening a System gives back an equivalent System,
  attachments included. A Markdown specification reads back into the Specification it
  came from.
- **Editing never refuses.** Every Edit applies, however ill-formed its result; its
  Diagnostics appear with it.

## Open questions

- The client and platform Languages need defining in `systemathic.lib`.
- How a `Name`, a `Bound` and a `Measure` are encoded: mappings of CoreFormat and the
  client mediators, yet to be written down.
- What an Edit records to be revertible: the model says which Elements it touches, not
  their values before and after.
