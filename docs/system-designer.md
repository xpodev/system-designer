# System Designer

The Systemathic tool, designed in itself. It is defined abstractly, at the seams: every part that could be done more than one way is an interface — Repository, Metadata Provider, Edit Kind, Edit Listener, Perspective Kind, Specification Format, Source, Systemathic Verifier — and its concrete implementations, the tool's own among them, are chosen by Configuration. Anyone can add an implementation the same way the tool does, so the tool and those who extend it are equally first-party. Connections are stated without Mediations unless how they pass matters to the design; a Mediation states only that a What passes over another Language, and how is the mediator's business.

This System has 51 Components, and 1 package beside its root.

## System Designer

- Uses: none
- Exports: none
- Imports: HTTP: HTTP (Language), HTTP (Medium)

### Deployment Product

- Places: tool (Tool)

### Systemathic

The Systemathic language package: one core Language (Kernel) and its extensions, layered Kernel → Functions → Contexts → Deployment → Mediation → Systems. Systems is the top Language and ties everything together into a System.

- Uses: none
- Exports: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language)
- Imports: none

#### Kernel — a core Language

No Component uses it yet.

- **Language**
- **Entity**
- **Relationship**
- **End**
- **Name**
- **Bound**
- **Formula**

**End.name ⟷ Name.(unnamed)**

- Each End has at most one Name, as name. `0..1`
- Each Name has any number of Ends, but cannot navigate to them. `0..N`

**Language.entities ⟷ Entity.language**

- Each Language has any number of Entities, as entities. `0..N`
- Each Entity has exactly one Language, as language. `1..1`

**Language.relationships ⟷ Relationship.language**

- Each Language has any number of Relationships, as relationships. `0..N`
- Each Relationship has exactly one Language, as language. `1..1`

**Language.formulas ⟷ Formula.language**

- Each Language has any number of Formulas, as formulas. `0..N`
- Each Formula has exactly one Language, as language. `1..1`

**Language.extends ⟷ Language.extendedBy**

- Each Language has any number of Languages, as extends. `0..N`
- Each Language has any number of Languages, as extendedBy. `0..N`

**Entity.extends ⟷ Entity.extendedBy**

- Each Entity has any number of Entities, as extends. `0..N`
- Each Entity has any number of Entities, as extendedBy. `0..N`

**Relationship.ends ⟷ End.relationship**

- Each Relationship has exactly 2 Ends, as ends. `2..2`
- Each End has exactly one Relationship, as relationship. `1..1`

**End.entity ⟷ Entity.ends**

- Each End has exactly one Entity, as entity. `1..1`
- Each Entity has any number of Ends, as ends. `0..N`

**End.min ⟷ Bound.(unnamed)**

- Each End has exactly one Bound, as min. `1..1`
- Each Bound has any number of Ends, but cannot navigate to them. `0..N`

**End.max ⟷ Bound.(unnamed)**

- Each End has at most one Bound, as max. `0..1`
- Each Bound has any number of Ends, but cannot navigate to them. `0..N`

**Language.name ⟷ Name.(unnamed)**

- Each Language has exactly one Name, as name. `1..1`
- Each Name has any number of Languages, but cannot navigate to them. `0..N`

**Entity.name ⟷ Name.(unnamed)**

- Each Entity has exactly one Name, as name. `1..1`
- Each Name has any number of Entities, but cannot navigate to them. `0..N`

#### Functions — extends Kernel

No Component uses it yet.

- **Function** — A signature: ordered Parameters, each of some Entity, and at most one output Entity. A Function without an output gives nothing back, such as an Interaction that only informs (`systemOpened(System)`). There is no Unit: it would have to belong to some Language, and returning another Language's Entity would make an Interaction a Transformation.
- **Parameter**

**Function.parameters ⟷ Parameter.function**

- Each Function has any number of Parameters, as parameters. `0..N`
- Each Parameter has exactly one Function, as function. `1..1`

**Parameter.next ⟷ Parameter.previous**

- Each Parameter has at most one Parameter, as next. `0..1`
- Each Parameter has at most one Parameter, as previous. `0..1`

**Parameter.type ⟷ Entity.(unnamed)**

- Each Parameter has exactly one Entity, as type. `1..1`
- Each Entity has any number of Parameters, but cannot navigate to them. `0..N`

**Function.output ⟷ Entity.(unnamed)**

- Each Function has at most one Entity, as output. `0..1`
- Each Entity has any number of Functions, but cannot navigate to them. `0..N`

**Function.name ⟷ Name.(unnamed)**

- Each Function has exactly one Name, as name. `1..1`
- Each Name has any number of Functions, but cannot navigate to them. `0..N`

**Parameter.name ⟷ Name.(unnamed)**

- Each Parameter has exactly one Name, as name. `1..1`
- Each Name has any number of Parameters, but cannot navigate to them. `0..N`

#### Contexts — extends Functions

No Component uses it yet.

- **Component** — A unit of the design. From outside, a Component is only what it **exports**: an interface. Its children, Transformations and Deployments are its own implementation of that interface, the default one. Other Components may **implement** it: each is an alternative implementation, with children of its own, that may stand wherever the Component is placed. An implementer imports what it implements and uses the Languages of the Interactions it exports. Which implementation fills an Instance is chosen by the tool's Configuration.
- **Interaction** : Function
- **Transformation** : Function — A Function whose inputs are all of one Language and whose output is of a different Language. Nothing is required of how the two Languages relate: neither need extend the other.
- **Export** — Part of a Component's API: one of its own Languages, Interactions, Transformations or Mediums, one of its children, or an Export of a child, which it re-exports. What a Component does not export, nothing outside it can reach; its children reach their ancestors' parts without exports. Exporting a child with children of its own hands out an implementation: the std rule `exports_interfaces` finds it.
- **Import** — A Component's dependency on another — a sibling, one a Component it is nested in imports from, or one it reaches through an Export — taking some of its Exports. An Import of nothing still lets the importer place Instances of the Component, and import from what it exports.

**Component.components ⟷ Component.parent**

- Each Component has any number of Components, as components. `0..N`
- Each Component has at most one Component, as parent. `0..1`

**Component.languages ⟷ Language.component**

- Each Component has any number of Languages, as languages. `0..N`
- Each Language has exactly one Component, as component. `1..1`

**Component.uses ⟷ Language.users**

- Each Component has any number of Languages, as uses. `0..N`
- Each Language has any number of Components, as users. `0..N`

**Component.interactions ⟷ Interaction.component**

- Each Component has any number of Interactions, as interactions. `0..N`
- Each Interaction has exactly one Component, as component. `1..1`

**Component.transformations ⟷ Transformation.component**

- Each Component has any number of Transformations, as transformations. `0..N`
- Each Transformation has exactly one Component, as component. `1..1`

**Interaction.language ⟷ Language.(unnamed)**

- Each Interaction has exactly one Language, as language. `1..1`
- Each Language has any number of Interactions, but cannot navigate to them. `0..N`

**Component.name ⟷ Name.(unnamed)**

- Each Component has exactly one Name, as name. `1..1`
- Each Name has any number of Components, but cannot navigate to them. `0..N`

**Component.implements ⟷ Component.implementations**

- Each Component has any number of Components, as implements. `0..N`
- Each Component has any number of Components, as implementations. `0..N`

**Component.exports ⟷ Export.exporter**

- Each Component has any number of Exports, as exports. `0..N`
- Each Export has exactly one Component, as exporter. `1..1`

**Export.component ⟷ Component.(unnamed)**

- Each Export has at most one Component, as component. `0..1`
- Each Component has any number of Exports, but cannot navigate to them. `0..N`

**Export.interaction ⟷ Interaction.(unnamed)**

- Each Export has at most one Interaction, as interaction. `0..1`
- Each Interaction has any number of Exports, but cannot navigate to them. `0..N`

**Export.transformation ⟷ Transformation.(unnamed)**

- Each Export has at most one Transformation, as transformation. `0..1`
- Each Transformation has any number of Exports, but cannot navigate to them. `0..N`

**Export.language ⟷ Language.(unnamed)**

- Each Export has at most one Language, as language. `0..1`
- Each Language has any number of Exports, but cannot navigate to them. `0..N`

**Export.reexports ⟷ Export.export**

- Each Export has any number of Exports, as reexports. `0..N`
- Each Export has at most one Export, as export. `0..1`

**Component.imports ⟷ Import.importer**

- Each Component has any number of Imports, as imports. `0..N`
- Each Import has exactly one Component, as importer. `1..1`

**Import.from ⟷ Component.(unnamed)**

- Each Import has exactly one Component, as from. `1..1`
- Each Component has any number of Imports, but cannot navigate to them. `0..N`

**Import.exports ⟷ Export.imports**

- Each Import has any number of Exports, as exports. `0..N`
- Each Export has any number of Imports, as imports. `0..N`

- Axiom `all t in Transformation, p in t.parameters, q in t.parameters. p.type.language == q.type.language and p.type.language != t.output.language`
- Axiom `all c in Component. not c in c.^implements`
- Axiom `all c in Component, x in c.implements. x in c.imports.from or x in c.imports.exports.*export.component`
- Axiom `all c in Component, x in c.implements, i in x.interactions. i.language in c.uses`
- Axiom `all t in Transformation. some t.output`

#### Deployment — extends Contexts

No Component uses it yet.

- **Deployment**
- **Instance** — A named place for a Component in a Deployment, with a range of how many occupy it, as an end has: `1..1` by default, `0..1` optional, `0..N` any number. Which Component fills it — the placed Component or one implementing it — is chosen by the Configuration, one choice per occupant. A Connection to a ranged Instance reaches every occupant: that is how one caller informs many (an event) without knowing them.
- **Connection**

**Component.deployments ⟷ Deployment.component**

- Each Component has any number of Deployments, as deployments. `0..N`
- Each Deployment has exactly one Component, as component. `1..1`

**Deployment.instances ⟷ Instance.deployment**

- Each Deployment has any number of Instances, as instances. `0..N`
- Each Instance has exactly one Deployment, as deployment. `1..1`

**Instance.of ⟷ Component.instances**

- Each Instance has exactly one Component, as of. `1..1`
- Each Component has any number of Instances, as instances. `0..N`

**Deployment.connections ⟷ Connection.deployment**

- Each Deployment has any number of Connections, as connections. `0..N`
- Each Connection has exactly one Deployment, as deployment. `1..1`

**Instance.outgoing ⟷ Connection.from**

- Each Instance has any number of Connections, as outgoing. `0..N`
- Each Connection has exactly one Instance, as from. `1..1`

**Instance.incoming ⟷ Connection.to**

- Each Instance has any number of Connections, as incoming. `0..N`
- Each Connection has at most one Instance, as to. `0..1`

**Component.(unnamed) ⟷ Connection.toComponent**

- Each Component has any number of Connections, but cannot navigate to them. `0..N`
- Each Connection has at most one Component, as toComponent. `0..1`

**Connection.what ⟷ Interaction.(unnamed)**

- Each Connection has one or more Interactions, as what. `1..N`
- Each Interaction has any number of Connections, but cannot navigate to them. `0..N`

**Instance.name ⟷ Name.(unnamed)**

- Each Instance has exactly one Name, as name. `1..1`
- Each Name has any number of Instances, but cannot navigate to them. `0..N`

**Deployment.name ⟷ Name.(unnamed)**

- Each Deployment has exactly one Name, as name. `1..1`
- Each Name has any number of Deployments, but cannot navigate to them. `0..N`

**Instance.min ⟷ Bound.(unnamed)**

- Each Instance has exactly one Bound, as min. `1..1`
- Each Bound has any number of Instances, but cannot navigate to them. `0..N`

**Instance.max ⟷ Bound.(unnamed)**

- Each Instance has at most one Bound, as max. `0..1`
- Each Bound has any number of Instances, but cannot navigate to them. `0..N`

#### Mediation — extends Deployment

No Component uses it yet.

- **Medium**
- **Mediation**

**Component.mediums ⟷ Medium.component**

- Each Component has any number of Mediums, as mediums. `0..N`
- Each Medium has exactly one Component, as component. `1..1`

**Medium.language ⟷ Language.(unnamed)**

- Each Medium has exactly one Language, as language. `1..1`
- Each Language has any number of Mediums, but cannot navigate to them. `0..N`

**Medium.call ⟷ Interaction.(unnamed)**

- Each Medium has exactly one Interaction, as call. `1..1`
- Each Interaction has any number of Mediums, but cannot navigate to them. `0..N`

**Connection.mediations ⟷ Mediation.connection**

- Each Connection has any number of Mediations, as mediations. `0..N`
- Each Mediation has exactly one Connection, as connection. `1..1`

**Mediation.below ⟷ Mediation.above**

- Each Mediation has at most one Mediation, as below. `0..1`
- Each Mediation has at most one Mediation, as above. `0..1`

**Mediation.how ⟷ Medium.(unnamed)**

- Each Mediation has exactly one Medium, as how. `1..1`
- Each Medium has any number of Mediations, but cannot navigate to them. `0..N`

**Mediation.down ⟷ Transformation.(unnamed)**

- Each Mediation has at most one Transformation, as down. `0..1`
- Each Transformation has any number of Mediations, but cannot navigate to them. `0..N`

**Mediation.up ⟷ Transformation.(unnamed)**

- Each Mediation has at most one Transformation, as up. `0..1`
- Each Transformation has any number of Mediations, but cannot navigate to them. `0..N`

**Medium.name ⟷ Name.(unnamed)**

- Each Medium has exactly one Name, as name. `1..1`
- Each Name has any number of Mediums, but cannot navigate to them. `0..N`

**Export.medium ⟷ Medium.(unnamed)**

- Each Export has at most one Medium, as medium. `0..1`
- Each Medium has any number of Exports, but cannot navigate to them. `0..N`

#### Systems — extends Mediation

Used by Metadata Provider, Documentation Store, By Value Store, Workspace, Configuration Store.

- **System**

**System.root ⟷ Component.system**

- Each System has exactly one Component, as root. `1..1`
- Each Component has at most one System, as system. `0..1`

**System.packages ⟷ Component.(unnamed)**

- Each System has any number of Components, as packages. `0..N`
- Each Component has at most one System, but cannot navigate to it. `0..1`

**System.name ⟷ Name.(unnamed)**

- Each System has exactly one Name, as name. `1..1`
- Each Name has any number of Systems, but cannot navigate to them. `0..N`

### Systemathic Verification

The vocabulary of verifying a design, inside the tool: Assertions, their results, and a Verification Result for a System. "Validation" is kept for checking an implementation against an exported specification.

- Uses: none
- Exports: Verification (Language)
- Imports: Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language)

#### Verification — extends Systems

No Component uses it yet.

- **Verification Result**
- **Assertion**
- **Assertion Result**

**Verification Result.results ⟷ Assertion Result.verification**

- Each Verification Result has any number of Assertion Results, as results. `0..N`
- Each Assertion Result has exactly one Verification Result, as verification. `1..1`

**Assertion Result.assertion ⟷ Assertion.results**

- Each Assertion Result has exactly one Assertion, as assertion. `1..1`
- Each Assertion has any number of Assertion Results, as results. `0..N`

**Verification Result.system ⟷ System.verifications**

- Each Verification Result has exactly one System, as system. `1..1`
- Each System has any number of Verification Results, as verifications. `0..N`

### Systemathic StdLib

Specific Assertions: formula-based assertions, and assertions for standard terms (to be defined).

- Uses: none
- Exports: Standard Assertions (Language)
- Imports: Systemathic Verification: Verification (Language)

#### Standard Assertions — extends Verification

No Component uses it yet.

- **Formula Assertion** : Assertion

**Formula Assertion.formula ⟷ Formula.(unnamed)**

- Each Formula Assertion has exactly one Formula, as formula. `1..1`
- Each Formula has any number of Formula Assertions, but cannot navigate to them. `0..N`

### Systemathic Verifier

Offers verify: a System and the Rules to check it against give a Verification Result. It accepts only what it needs and says nothing about how verification is carried out. Rules are defined here, not in Verification (the name Rule is still provisional).

- Uses: Rules
- Exports: Rules (Language), verify (Interaction)
- Imports: Systemathic Verification: Verification (Language)

#### Rules — extends Verification

Used by Systemathic Verifier, Python Verifier.

- **Rule**

**Rule.assertions ⟷ Assertion.rules**

- Each Rule has one or more Assertions, as assertions. `1..N`
- Each Assertion has any number of Rules, as rules. `0..N`

#### Interactions

- `verify(system: System, rules: Rule): Verification Result, over Rules`

### Tool

The Systemathic tool. It imports the language package, the Verifier, the StdLib and the metadata providers (Documentation, By Value). Each part is a subcomponent with a core Language and many implementations: Repository (storage of Systems only), Host, Editing and the concept editors, clients (UI, MCP, CLI, API), Perspectives, Diagnostics, Exporter, Catalog and import/export, and Configurations (Deployment choices plus Rules).

- Uses: none
- Exports: none
- Imports: Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language), Systemathic Verifier: Rules (Language), Systemathic StdLib: Standard Assertions (Language), Documentation: Documentation (Language), By Value: By Value (Language), Systemathic Metadata: Metadata (Language), Systemathic Subjects: Subjects (Language), Kernel Subjects (Language), Functions Subjects (Language), Contexts Subjects (Language), Deployment Subjects (Language), Mediation Subjects (Language), Systems Subjects (Language), HTTP: HTTP (Language), HTTP (Medium), Configurations: Configurations (Language)

#### Deployment Local

The Host as a process on this machine: the one authority over every open System. The UI, the MCP server, the CLI and the API each reach it over HTTP — that they do is the design; how each Language is put on HTTP is the mediator's business, left to the implementation. Interface Instances (repository, providers, editKinds, listeners, verifier, perspectiveKinds, formats, sources) are filled by the Configuration.

- Places: workspace (Workspace), repository (Repository), providers (Metadata Provider, 0..N), editor (Editor), editKinds (Edit Kind, 0..N), listeners (Edit Listener, 0..N), verifier (Systemathic Verifier), diagnoser (Diagnoser), perspectives (Perspectives), perspectiveKinds (Perspective Kind, 0..N), exporter (Exporter), formats (Specification Format, 0..N), writer (Documentation Writer), sources (Source, 0..N), ui (UI), mcp (MCP Server), cli (CLI), api (API)
- workspace uses open, save of repository, how it passes is left to the implementation
- workspace uses load, save of providers, how it passes is left to the implementation
- workspace uses startSession of editor, how it passes is left to the implementation
- editor uses apply of editKinds, how it passes is left to the implementation
- editor uses applied of listeners, how it passes is left to the implementation
- diagnoser uses verify of verifier, how it passes is left to the implementation
- perspectives uses view of perspectiveKinds, how it passes is left to the implementation
- perspectives uses diagnose of diagnoser, how it passes is left to the implementation
- exporter uses diagnose of diagnoser, how it passes is left to the implementation
- ui uses new, open, save, close of workspace, over HTTP
- ui uses startSession, apply of editor, over HTTP
- ui uses view of perspectives, over HTTP
- ui uses diagnose of diagnoser, over HTTP
- ui uses specify of exporter, over HTTP
- ui uses render of formats, over HTTP
- ui uses write of writer, over HTTP
- ui uses contents of sources, over HTTP
- mcp uses new, open, save, close of workspace, over HTTP
- mcp uses startSession, apply of editor, over HTTP
- mcp uses view of perspectives, over HTTP
- mcp uses diagnose of diagnoser, over HTTP
- mcp uses specify of exporter, over HTTP
- mcp uses render of formats, over HTTP
- mcp uses write of writer, over HTTP
- mcp uses contents of sources, over HTTP
- cli uses new, open, save, close of workspace, over HTTP
- cli uses diagnose of diagnoser, over HTTP
- cli uses specify of exporter, over HTTP
- cli uses render of formats, over HTTP
- cli uses write of writer, over HTTP
- api uses new, open, save, close of workspace, over HTTP
- api uses startSession, apply of editor, over HTTP
- api uses view of perspectives, over HTTP
- api uses diagnose of diagnoser, over HTTP
- api uses specify of exporter, over HTTP
- api uses render of formats, over HTTP
- api uses write of writer, over HTTP
- api uses contents of sources, over HTTP

#### Deployment Browser

The Host in a browser tab, for solo use, with the UI; Python rules run by Pyodide. Nothing to install. How the UI reaches the Host is not stated: it is an implementation detail.

- Places: workspace (Workspace), repository (Repository), providers (Metadata Provider, 0..N), editor (Editor), editKinds (Edit Kind, 0..N), listeners (Edit Listener, 0..N), verifier (Systemathic Verifier), diagnoser (Diagnoser), perspectives (Perspectives), perspectiveKinds (Perspective Kind, 0..N), exporter (Exporter), formats (Specification Format, 0..N), writer (Documentation Writer), sources (Source, 0..N), ui (UI)
- workspace uses open, save of repository, how it passes is left to the implementation
- workspace uses load, save of providers, how it passes is left to the implementation
- workspace uses startSession of editor, how it passes is left to the implementation
- editor uses apply of editKinds, how it passes is left to the implementation
- editor uses applied of listeners, how it passes is left to the implementation
- diagnoser uses verify of verifier, how it passes is left to the implementation
- perspectives uses view of perspectiveKinds, how it passes is left to the implementation
- perspectives uses diagnose of diagnoser, how it passes is left to the implementation
- exporter uses diagnose of diagnoser, how it passes is left to the implementation
- ui uses new, open, save, close of workspace, how it passes is left to the implementation
- ui uses startSession, apply of editor, how it passes is left to the implementation
- ui uses view of perspectives, how it passes is left to the implementation
- ui uses diagnose of diagnoser, how it passes is left to the implementation
- ui uses specify of exporter, how it passes is left to the implementation
- ui uses render of formats, how it passes is left to the implementation
- ui uses write of writer, how it passes is left to the implementation
- ui uses contents of sources, how it passes is left to the implementation

#### Repository

Interface: where Systems are stored. It stores the design only and knows nothing of metadata. `open` reads the System at a Location; `save` writes one there and gives back where it was saved. Implemented by JSON File Repository; others (browser storage, a database) are alternatives chosen by Configuration.

- Uses: Repository
- Exports: Repository (Language), open (Interaction), save (Interaction)
- Imports: Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language)

##### Repository — extends Systems

Used by Repository, JSON File Repository, Workspace.

- **Location**

##### Interactions

- `open(location: Location): System, over Repository`
- `save(system: System, location: Location): Location, over Repository`

#### JSON File Repository

Implements Repository: a System as a JSON file, and a Location as its path. Writing a System as JSON takes a serializer — Systems / JSON — which is not designed yet.

- Uses: Repository
- Exports: none
- Imports: Repository: Repository (Language)
- Implements: Repository

#### Metadata Provider

Interface: a provider of one kind of metadata. It loads its metadata for a System when asked, and saves it when asked, its own way and wherever it likes. The Workspace asks every provider connected to it when a System is opened or saved: that fan-out is the event, and neither side knows the other. `save` gives nothing back.

- Uses: Systems
- Exports: load (Interaction), save (Interaction)
- Imports: Systemathic Metadata: Metadata (Language), Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language)

##### Interactions

- `load(system: System): System, over Systems`
- `save(system: System), over Systems`

#### Documentation Store

Implements Metadata Provider for Documentation (loads and saves Descriptions, its own way) and Edit Kind for it: Describe and Undescribe, each carrying a Description by value — its subject and text.

- Uses: Documentation, Documentation Editing, Editing, Systems
- Exports: Documentation Editing (Language)
- Imports: Metadata Provider, Systemathic Metadata: Metadata (Language), Documentation: Documentation (Language), Editing: Editing (Language), Edit Kind, Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language)
- Implements: Metadata Provider, Edit Kind

##### Documentation Editing — extends Editing, Documentation

Used by Documentation Store, UI, MCP Server, API.

- **Describe** : Edit
- **Undescribe** : Edit

**Describe.description ⟷ Description.(unnamed)**

- Each Describe has exactly one Description, as description. `1..1`
- Each Description has any number of Describes, but cannot navigate to them. `0..N`

**Undescribe.description ⟷ Description.(unnamed)**

- Each Undescribe has exactly one Description, as description. `1..1`
- Each Description has any number of Undescribes, but cannot navigate to them. `0..N`

#### By Value Store

Implements Metadata Provider for By Value (loads and saves which Entities are by value) and Edit Kind for it: Mark and Unmark an Entity.

- Uses: By Value, By Value Editing, Editing, Systems
- Exports: By Value Editing (Language)
- Imports: Metadata Provider, Systemathic Metadata: Metadata (Language), By Value: By Value (Language), Editing: Editing (Language), Edit Kind, Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language)
- Implements: Metadata Provider, Edit Kind

##### By Value Editing — extends Editing, By Value

Used by By Value Store, UI, MCP Server, API.

- **Mark** : Edit
- **Unmark** : Edit

**Mark.mark ⟷ ByValue.(unnamed)**

- Each Mark has exactly one ByValue, as mark. `1..1`
- Each ByValue has any number of Marks, but cannot navigate to them. `0..N`

**Unmark.mark ⟷ ByValue.(unnamed)**

- Each Unmark has exactly one ByValue, as mark. `1..1`
- Each ByValue has any number of Unmarks, but cannot navigate to them. `0..N`

#### Workspace

The Systems open in the tool. `new` starts an empty one; `open` reads one through the Repository and asks every Metadata Provider to load; `save` writes the design through the Repository and asks every provider to save (order left open for now); `close` lets one go. Each Open System is a Target: clients start Sessions on it through the Editor. It is the only part that knows both the Repository and the providers.

- Uses: Workspace, Repository, Editing, Systems
- Exports: Workspace (Language), new (Interaction), open (Interaction), save (Interaction), close (Interaction)
- Imports: Repository: Repository (Language), open (Interaction), save (Interaction), Metadata Provider: load (Interaction), save (Interaction), Systemathic Metadata: Metadata (Language), Editing: Editing (Language), Editor: startSession (Interaction), Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language)

##### Workspace — extends Repository, Editing

Used by Workspace, UI, MCP Server, CLI, API.

- **Open System** : Target

**Open System.system ⟷ System.openAs**

- Each Open System has exactly one System, as system. `1..1`
- Each System has any number of Open Systems, as openAs. `0..N`

##### Interactions

- `new(name: Name): Open System, over Workspace`
- `open(location: Location): Open System, over Workspace`
- `save(system: Open System, location: Location): Location, over Workspace`
- `close(system: Open System): Open System, over Workspace`

#### Editing

The vocabulary of editing, on its own so that the Editor and every Edit Kind share it without depending on each other. A **Target** is what is edited (an Open System, seen from editing); each has one **History**, a single chain of applied Edits shared by all its **Sessions**. An **Edit** is a change, described as data; once applied it is in a History, records its author Session, and has a **reverse**: another Edit that undoes it, computed when it was applied. Undo is applying an Edit's reverse; redo, applying that one's. *Reversible* is a derived term (`some e.reverse`), and every applied Edit is reversible. Editing knows no concept of the core: the kinds of Edit are Entities extending Edit in the editors' Languages.

- Uses: Editing
- Exports: Editing (Language)
- Imports: none

##### Editing — a core Language

Used by Documentation Store, By Value Store, Workspace, Editing, Edit Kind, Kernel Editor, Functions Editor, Contexts Editor, Deployment Editor, Mediation Editor, Systems Editor, Editor, Edit Listener, UI, MCP Server, API, Configuration Store.

- **Target**
- **Session**
- **History**
- **Edit**

**Target.history ⟷ History.target**

- Each Target has exactly one History, as history. `1..1`
- Each History has exactly one Target, as target. `1..1`

**Target.sessions ⟷ Session.target**

- Each Target has any number of Sessions, as sessions. `0..N`
- Each Session has exactly one Target, as target. `1..1`

**History.edits ⟷ Edit.history**

- Each History has any number of Edits, as edits. `0..N`
- Each Edit has at most one History, as history. `0..1`

**Edit.next ⟷ Edit.previous**

- Each Edit has at most one Edit, as next. `0..1`
- Each Edit has at most one Edit, as previous. `0..1`

**Session.edits ⟷ Edit.author**

- Each Session has any number of Edits, as edits. `0..N`
- Each Edit has at most one Session, as author. `0..1`

**Edit.reverse ⟷ Edit.reverseOf**

- Each Edit has at most one Edit, as reverse. `0..1`
- Each Edit has at most one Edit, as reverseOf. `0..1`

- Axiom `all e in Edit. not e in e.^next`
- Axiom `all e in Edit, s in e.author. s.target == e.history.target`
- Axiom `all e in Edit. (some e.history => some e.author and some e.reverse) and (some e.author => some e.history)`

#### Edit Kind

Interface: the kinds of Edit of one Language. `apply` carries out an Edit of its kinds on a Target and gives back the applied Edit with its reverse. Implemented by each concept editor (one per Systemathic Language) and by each metadata provider that can be edited (Documentation, By Value). Which implementation handles a given Edit is code.

- Uses: Editing
- Exports: apply (Interaction)
- Imports: Editing: Editing (Language)

##### Interactions

- `apply(target: Target, edit: Edit): Edit, over Editing`

#### Source

Interface: somewhere to import from. `contents` lists the Packages it offers; `fetch` gives a Package's content, as a System (library content is stored exactly like any other System). Implemented by Catalog Source (the standard catalog), File Source, and later another open System.

- Uses: Sources
- Exports: Sources (Language), contents (Interaction)
- Imports: Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language)

##### Sources — extends Systems

Used by Source, Catalog Source, File Source, Systems Editor, UI, MCP Server, API.

- **Package**
- **Listing**

**Listing.packages ⟷ Package.listings**

- Each Listing has any number of Packages, as packages. `0..N`
- Each Package has any number of Listings, as listings. `0..N`

**Package.name ⟷ Name.(unnamed)**

- Each Package has exactly one Name, as name. `1..1`
- Each Name has any number of Packages, but cannot navigate to them. `0..N`

##### Interactions

- `contents(): Listing, over Sources`
- `fetch(package: Package): System, over Sources`

#### Catalog Source

Implements Source: the standard catalog (JSON, HTTP, TCP, SQL, …).

- Uses: Sources
- Exports: none
- Imports: Source: Sources (Language)
- Implements: Source

#### File Source

Implements Source: a System file, whose Components are its Packages.

- Uses: Sources
- Exports: none
- Imports: Source: Sources (Language)
- Implements: Source

#### Kernel Editor

Implements Edit Kind for Kernel. Every editor's kinds follow one pattern, per thing its Language owns: **Add**T (`into` its owner, the T by value), **Change**T (`subject`, and `to`: the T as it should become, by value), **Remove**T (`subject`; the cascade comes with it). Kernel: Entities, Relationships (their Ends inside), Formulas; Languages are changed and removed here, added by Contexts. Each editor's Language extends the one below it and its own Systemathic Language, so an editor covers a whole Language with its extensions.

- Uses: Kernel Editing, Editing
- Exports: Kernel Editing (Language)
- Imports: Editing: Editing (Language), Edit Kind, Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language)
- Implements: Edit Kind

##### Kernel Editing — extends Editing, Kernel

Used by Kernel Editor.

- **AddEntity** : Edit
- **ChangeEntity** : Edit
- **RemoveEntity** : Edit
- **AddRelationship** : Edit
- **ChangeRelationship** : Edit
- **RemoveRelationship** : Edit
- **AddFormula** : Edit
- **ChangeFormula** : Edit
- **RemoveFormula** : Edit
- **ChangeLanguage** : Edit
- **RemoveLanguage** : Edit

**AddEntity.into ⟷ Language.(unnamed)**

- Each AddEntity has exactly one Language, as into. `1..1`
- Each Language has any number of AddEntities, but cannot navigate to them. `0..N`

**AddEntity.entity ⟷ Entity.(unnamed)**

- Each AddEntity has exactly one Entity, as entity. `1..1`
- Each Entity has any number of AddEntities, but cannot navigate to them. `0..N`

**ChangeEntity.subject ⟷ Entity.(unnamed)**

- Each ChangeEntity has exactly one Entity, as subject. `1..1`
- Each Entity has any number of ChangeEntities, but cannot navigate to them. `0..N`

**ChangeEntity.to ⟷ Entity.(unnamed)**

- Each ChangeEntity has exactly one Entity, as to. `1..1`
- Each Entity has any number of ChangeEntities, but cannot navigate to them. `0..N`

**RemoveEntity.subject ⟷ Entity.(unnamed)**

- Each RemoveEntity has exactly one Entity, as subject. `1..1`
- Each Entity has any number of RemoveEntities, but cannot navigate to them. `0..N`

**AddRelationship.into ⟷ Language.(unnamed)**

- Each AddRelationship has exactly one Language, as into. `1..1`
- Each Language has any number of AddRelationships, but cannot navigate to them. `0..N`

**AddRelationship.relationship ⟷ Relationship.(unnamed)**

- Each AddRelationship has exactly one Relationship, as relationship. `1..1`
- Each Relationship has any number of AddRelationships, but cannot navigate to them. `0..N`

**ChangeRelationship.subject ⟷ Relationship.(unnamed)**

- Each ChangeRelationship has exactly one Relationship, as subject. `1..1`
- Each Relationship has any number of ChangeRelationships, but cannot navigate to them. `0..N`

**ChangeRelationship.to ⟷ Relationship.(unnamed)**

- Each ChangeRelationship has exactly one Relationship, as to. `1..1`
- Each Relationship has any number of ChangeRelationships, but cannot navigate to them. `0..N`

**RemoveRelationship.subject ⟷ Relationship.(unnamed)**

- Each RemoveRelationship has exactly one Relationship, as subject. `1..1`
- Each Relationship has any number of RemoveRelationships, but cannot navigate to them. `0..N`

**AddFormula.into ⟷ Language.(unnamed)**

- Each AddFormula has exactly one Language, as into. `1..1`
- Each Language has any number of AddFormulas, but cannot navigate to them. `0..N`

**AddFormula.formula ⟷ Formula.(unnamed)**

- Each AddFormula has exactly one Formula, as formula. `1..1`
- Each Formula has any number of AddFormulas, but cannot navigate to them. `0..N`

**ChangeFormula.subject ⟷ Formula.(unnamed)**

- Each ChangeFormula has exactly one Formula, as subject. `1..1`
- Each Formula has any number of ChangeFormulas, but cannot navigate to them. `0..N`

**ChangeFormula.to ⟷ Formula.(unnamed)**

- Each ChangeFormula has exactly one Formula, as to. `1..1`
- Each Formula has any number of ChangeFormulas, but cannot navigate to them. `0..N`

**RemoveFormula.subject ⟷ Formula.(unnamed)**

- Each RemoveFormula has exactly one Formula, as subject. `1..1`
- Each Formula has any number of RemoveFormulas, but cannot navigate to them. `0..N`

**ChangeLanguage.subject ⟷ Language.(unnamed)**

- Each ChangeLanguage has exactly one Language, as subject. `1..1`
- Each Language has any number of ChangeLanguages, but cannot navigate to them. `0..N`

**ChangeLanguage.to ⟷ Language.(unnamed)**

- Each ChangeLanguage has exactly one Language, as to. `1..1`
- Each Language has any number of ChangeLanguages, but cannot navigate to them. `0..N`

**RemoveLanguage.subject ⟷ Language.(unnamed)**

- Each RemoveLanguage has exactly one Language, as subject. `1..1`
- Each Language has any number of RemoveLanguages, but cannot navigate to them. `0..N`

#### Functions Editor

Implements Edit Kind for Functions: Parameters (added into a Function, changed — type, name, place — and removed), and any Function — Interaction or Transformation — changed or removed. Functions are added by Contexts, where their owner is.

- Uses: Functions Editing, Editing
- Exports: Functions Editing (Language)
- Imports: Kernel Editor: Kernel Editing (Language), Edit Kind, Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language), Editing: Editing (Language)
- Implements: Edit Kind

##### Functions Editing — extends Kernel Editing, Functions

Used by Functions Editor.

- **AddParameter** : Edit
- **ChangeParameter** : Edit
- **RemoveParameter** : Edit
- **ChangeFunction** : Edit
- **RemoveFunction** : Edit

**AddParameter.into ⟷ Function.(unnamed)**

- Each AddParameter has exactly one Function, as into. `1..1`
- Each Function has any number of AddParameters, but cannot navigate to them. `0..N`

**AddParameter.parameter ⟷ Parameter.(unnamed)**

- Each AddParameter has exactly one Parameter, as parameter. `1..1`
- Each Parameter has any number of AddParameters, but cannot navigate to them. `0..N`

**ChangeParameter.subject ⟷ Parameter.(unnamed)**

- Each ChangeParameter has exactly one Parameter, as subject. `1..1`
- Each Parameter has any number of ChangeParameters, but cannot navigate to them. `0..N`

**ChangeParameter.to ⟷ Parameter.(unnamed)**

- Each ChangeParameter has exactly one Parameter, as to. `1..1`
- Each Parameter has any number of ChangeParameters, but cannot navigate to them. `0..N`

**RemoveParameter.subject ⟷ Parameter.(unnamed)**

- Each RemoveParameter has exactly one Parameter, as subject. `1..1`
- Each Parameter has any number of RemoveParameters, but cannot navigate to them. `0..N`

**ChangeFunction.subject ⟷ Function.(unnamed)**

- Each ChangeFunction has exactly one Function, as subject. `1..1`
- Each Function has any number of ChangeFunctions, but cannot navigate to them. `0..N`

**ChangeFunction.to ⟷ Function.(unnamed)**

- Each ChangeFunction has exactly one Function, as to. `1..1`
- Each Function has any number of ChangeFunctions, but cannot navigate to them. `0..N`

**RemoveFunction.subject ⟷ Function.(unnamed)**

- Each RemoveFunction has exactly one Function, as subject. `1..1`
- Each Function has any number of RemoveFunctions, but cannot navigate to them. `0..N`

#### Contexts Editor

Implements Edit Kind for Contexts: Components (added into a parent; changed — name, parent, uses, implements — and removed), the Languages, Interactions and Transformations added into a Component, and its Exports and Imports, each added and removed.

- Uses: Contexts Editing, Editing
- Exports: Contexts Editing (Language)
- Imports: Functions Editor: Functions Editing (Language), Edit Kind, Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language), Editing: Editing (Language)
- Implements: Edit Kind

##### Contexts Editing — extends Functions Editing, Contexts

Used by Contexts Editor.

- **AddComponent** : Edit
- **ChangeComponent** : Edit
- **RemoveComponent** : Edit
- **AddLanguage** : Edit
- **AddInteraction** : Edit
- **AddTransformation** : Edit
- **AddExport** : Edit
- **RemoveExport** : Edit
- **AddImport** : Edit
- **ChangeImport** : Edit
- **RemoveImport** : Edit

**AddComponent.into ⟷ Component.(unnamed)**

- Each AddComponent has exactly one Component, as into. `1..1`
- Each Component has any number of AddComponents, but cannot navigate to them. `0..N`

**AddComponent.component ⟷ Component.(unnamed)**

- Each AddComponent has exactly one Component, as component. `1..1`
- Each Component has any number of AddComponents, but cannot navigate to them. `0..N`

**ChangeComponent.subject ⟷ Component.(unnamed)**

- Each ChangeComponent has exactly one Component, as subject. `1..1`
- Each Component has any number of ChangeComponents, but cannot navigate to them. `0..N`

**ChangeComponent.to ⟷ Component.(unnamed)**

- Each ChangeComponent has exactly one Component, as to. `1..1`
- Each Component has any number of ChangeComponents, but cannot navigate to them. `0..N`

**RemoveComponent.subject ⟷ Component.(unnamed)**

- Each RemoveComponent has exactly one Component, as subject. `1..1`
- Each Component has any number of RemoveComponents, but cannot navigate to them. `0..N`

**AddLanguage.into ⟷ Component.(unnamed)**

- Each AddLanguage has exactly one Component, as into. `1..1`
- Each Component has any number of AddLanguages, but cannot navigate to them. `0..N`

**AddLanguage.language ⟷ Language.(unnamed)**

- Each AddLanguage has exactly one Language, as language. `1..1`
- Each Language has any number of AddLanguages, but cannot navigate to them. `0..N`

**AddInteraction.into ⟷ Component.(unnamed)**

- Each AddInteraction has exactly one Component, as into. `1..1`
- Each Component has any number of AddInteractions, but cannot navigate to them. `0..N`

**AddInteraction.interaction ⟷ Interaction.(unnamed)**

- Each AddInteraction has exactly one Interaction, as interaction. `1..1`
- Each Interaction has any number of AddInteractions, but cannot navigate to them. `0..N`

**AddTransformation.into ⟷ Component.(unnamed)**

- Each AddTransformation has exactly one Component, as into. `1..1`
- Each Component has any number of AddTransformations, but cannot navigate to them. `0..N`

**AddTransformation.transformation ⟷ Transformation.(unnamed)**

- Each AddTransformation has exactly one Transformation, as transformation. `1..1`
- Each Transformation has any number of AddTransformations, but cannot navigate to them. `0..N`

**AddExport.into ⟷ Component.(unnamed)**

- Each AddExport has exactly one Component, as into. `1..1`
- Each Component has any number of AddExports, but cannot navigate to them. `0..N`

**AddExport.export ⟷ Export.(unnamed)**

- Each AddExport has exactly one Export, as export. `1..1`
- Each Export has any number of AddExports, but cannot navigate to them. `0..N`

**RemoveExport.subject ⟷ Export.(unnamed)**

- Each RemoveExport has exactly one Export, as subject. `1..1`
- Each Export has any number of RemoveExports, but cannot navigate to them. `0..N`

**AddImport.into ⟷ Component.(unnamed)**

- Each AddImport has exactly one Component, as into. `1..1`
- Each Component has any number of AddImports, but cannot navigate to them. `0..N`

**AddImport.import ⟷ Import.(unnamed)**

- Each AddImport has exactly one Import, as import. `1..1`
- Each Import has any number of AddImports, but cannot navigate to them. `0..N`

**ChangeImport.subject ⟷ Import.(unnamed)**

- Each ChangeImport has exactly one Import, as subject. `1..1`
- Each Import has any number of ChangeImports, but cannot navigate to them. `0..N`

**ChangeImport.to ⟷ Import.(unnamed)**

- Each ChangeImport has exactly one Import, as to. `1..1`
- Each Import has any number of ChangeImports, but cannot navigate to them. `0..N`

**RemoveImport.subject ⟷ Import.(unnamed)**

- Each RemoveImport has exactly one Import, as subject. `1..1`
- Each Import has any number of RemoveImports, but cannot navigate to them. `0..N`

#### Deployment Editor

Implements Edit Kind for Deployment: Deployments (into a Component), Instances and Connections (into a Deployment) — each added, changed and removed. Changing an Instance covers its name, what it places and its range; changing a Connection, its ends and its What.

- Uses: Deployment Editing, Editing
- Exports: Deployment Editing (Language)
- Imports: Contexts Editor: Contexts Editing (Language), Edit Kind, Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language), Editing: Editing (Language)
- Implements: Edit Kind

##### Deployment Editing — extends Contexts Editing, Deployment

Used by Deployment Editor.

- **AddDeployment** : Edit
- **ChangeDeployment** : Edit
- **RemoveDeployment** : Edit
- **AddInstance** : Edit
- **ChangeInstance** : Edit
- **RemoveInstance** : Edit
- **AddConnection** : Edit
- **ChangeConnection** : Edit
- **RemoveConnection** : Edit

**AddDeployment.into ⟷ Component.(unnamed)**

- Each AddDeployment has exactly one Component, as into. `1..1`
- Each Component has any number of AddDeployments, but cannot navigate to them. `0..N`

**AddDeployment.deployment ⟷ Deployment.(unnamed)**

- Each AddDeployment has exactly one Deployment, as deployment. `1..1`
- Each Deployment has any number of AddDeployments, but cannot navigate to them. `0..N`

**ChangeDeployment.subject ⟷ Deployment.(unnamed)**

- Each ChangeDeployment has exactly one Deployment, as subject. `1..1`
- Each Deployment has any number of ChangeDeployments, but cannot navigate to them. `0..N`

**ChangeDeployment.to ⟷ Deployment.(unnamed)**

- Each ChangeDeployment has exactly one Deployment, as to. `1..1`
- Each Deployment has any number of ChangeDeployments, but cannot navigate to them. `0..N`

**RemoveDeployment.subject ⟷ Deployment.(unnamed)**

- Each RemoveDeployment has exactly one Deployment, as subject. `1..1`
- Each Deployment has any number of RemoveDeployments, but cannot navigate to them. `0..N`

**AddInstance.into ⟷ Deployment.(unnamed)**

- Each AddInstance has exactly one Deployment, as into. `1..1`
- Each Deployment has any number of AddInstances, but cannot navigate to them. `0..N`

**AddInstance.instance ⟷ Instance.(unnamed)**

- Each AddInstance has exactly one Instance, as instance. `1..1`
- Each Instance has any number of AddInstances, but cannot navigate to them. `0..N`

**ChangeInstance.subject ⟷ Instance.(unnamed)**

- Each ChangeInstance has exactly one Instance, as subject. `1..1`
- Each Instance has any number of ChangeInstances, but cannot navigate to them. `0..N`

**ChangeInstance.to ⟷ Instance.(unnamed)**

- Each ChangeInstance has exactly one Instance, as to. `1..1`
- Each Instance has any number of ChangeInstances, but cannot navigate to them. `0..N`

**RemoveInstance.subject ⟷ Instance.(unnamed)**

- Each RemoveInstance has exactly one Instance, as subject. `1..1`
- Each Instance has any number of RemoveInstances, but cannot navigate to them. `0..N`

**AddConnection.into ⟷ Deployment.(unnamed)**

- Each AddConnection has exactly one Deployment, as into. `1..1`
- Each Deployment has any number of AddConnections, but cannot navigate to them. `0..N`

**AddConnection.connection ⟷ Connection.(unnamed)**

- Each AddConnection has exactly one Connection, as connection. `1..1`
- Each Connection has any number of AddConnections, but cannot navigate to them. `0..N`

**ChangeConnection.subject ⟷ Connection.(unnamed)**

- Each ChangeConnection has exactly one Connection, as subject. `1..1`
- Each Connection has any number of ChangeConnections, but cannot navigate to them. `0..N`

**ChangeConnection.to ⟷ Connection.(unnamed)**

- Each ChangeConnection has exactly one Connection, as to. `1..1`
- Each Connection has any number of ChangeConnections, but cannot navigate to them. `0..N`

**RemoveConnection.subject ⟷ Connection.(unnamed)**

- Each RemoveConnection has exactly one Connection, as subject. `1..1`
- Each Connection has any number of RemoveConnections, but cannot navigate to them. `0..N`

#### Mediation Editor

Implements Edit Kind for Mediation: Mediums (into a Component) and Mediations (into a Connection) — each added, changed (a Medium's Language and call; a Mediation's how, down, up and place in the stack) and removed.

- Uses: Mediation Editing, Editing
- Exports: Mediation Editing (Language)
- Imports: Deployment Editor: Deployment Editing (Language), Edit Kind, Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language), Editing: Editing (Language)
- Implements: Edit Kind

##### Mediation Editing — extends Deployment Editing, Mediation

Used by Mediation Editor.

- **AddMedium** : Edit
- **ChangeMedium** : Edit
- **RemoveMedium** : Edit
- **AddMediation** : Edit
- **ChangeMediation** : Edit
- **RemoveMediation** : Edit

**AddMedium.into ⟷ Component.(unnamed)**

- Each AddMedium has exactly one Component, as into. `1..1`
- Each Component has any number of AddMediums, but cannot navigate to them. `0..N`

**AddMedium.medium ⟷ Medium.(unnamed)**

- Each AddMedium has exactly one Medium, as medium. `1..1`
- Each Medium has any number of AddMediums, but cannot navigate to them. `0..N`

**ChangeMedium.subject ⟷ Medium.(unnamed)**

- Each ChangeMedium has exactly one Medium, as subject. `1..1`
- Each Medium has any number of ChangeMediums, but cannot navigate to them. `0..N`

**ChangeMedium.to ⟷ Medium.(unnamed)**

- Each ChangeMedium has exactly one Medium, as to. `1..1`
- Each Medium has any number of ChangeMediums, but cannot navigate to them. `0..N`

**RemoveMedium.subject ⟷ Medium.(unnamed)**

- Each RemoveMedium has exactly one Medium, as subject. `1..1`
- Each Medium has any number of RemoveMediums, but cannot navigate to them. `0..N`

**AddMediation.into ⟷ Connection.(unnamed)**

- Each AddMediation has exactly one Connection, as into. `1..1`
- Each Connection has any number of AddMediations, but cannot navigate to them. `0..N`

**AddMediation.mediation ⟷ Mediation.(unnamed)**

- Each AddMediation has exactly one Mediation, as mediation. `1..1`
- Each Mediation has any number of AddMediations, but cannot navigate to them. `0..N`

**ChangeMediation.subject ⟷ Mediation.(unnamed)**

- Each ChangeMediation has exactly one Mediation, as subject. `1..1`
- Each Mediation has any number of ChangeMediations, but cannot navigate to them. `0..N`

**ChangeMediation.to ⟷ Mediation.(unnamed)**

- Each ChangeMediation has exactly one Mediation, as to. `1..1`
- Each Mediation has any number of ChangeMediations, but cannot navigate to them. `0..N`

**RemoveMediation.subject ⟷ Mediation.(unnamed)**

- Each RemoveMediation has exactly one Mediation, as subject. `1..1`
- Each Mediation has any number of RemoveMediations, but cannot navigate to them. `0..N`

#### Systems Editor

Implements Edit Kind for Systems: ChangeSystem (its name), ImportPackage (fetched through a Source and copied in beside the root) and RemovePackage.

- Uses: Systems Editing, Sources, Editing
- Exports: Systems Editing (Language)
- Imports: Source: Sources (Language), Mediation Editor: Mediation Editing (Language), Edit Kind, Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language), Editing: Editing (Language)
- Implements: Edit Kind

##### Systems Editing — extends Mediation Editing, Sources

Used by Systems Editor, UI, MCP Server, API.

- **ImportPackage** : Edit
- **ChangeSystem** : Edit
- **RemovePackage** : Edit

**ImportPackage.package ⟷ Package.(unnamed)**

- Each ImportPackage has exactly one Package, as package. `1..1`
- Each Package has any number of ImportPackages, but cannot navigate to them. `0..N`

**ChangeSystem.subject ⟷ System.(unnamed)**

- Each ChangeSystem has exactly one System, as subject. `1..1`
- Each System has any number of ChangeSystems, but cannot navigate to them. `0..N`

**ChangeSystem.to ⟷ System.(unnamed)**

- Each ChangeSystem has exactly one System, as to. `1..1`
- Each System has any number of ChangeSystems, but cannot navigate to them. `0..N`

**RemovePackage.subject ⟷ Component.(unnamed)**

- Each RemovePackage has exactly one Component, as subject. `1..1`
- Each Component has any number of RemovePackages, but cannot navigate to them. `0..N`

#### Editor

The one seam every client edits through, and the one authority per Target. `startSession` opens a Session on a Target for one client; `apply` applies an Edit of any kind in a Session — through the Edit Kinds connected to it — and appends the applied Edit, with its reverse, to the History. Edits from all Sessions are applied in one order; history only grows; editing never refuses an ill-formed result.

- Uses: Editing
- Exports: startSession (Interaction), apply (Interaction)
- Imports: Editing: Editing (Language), Edit Kind: apply (Interaction), Edit Listener: applied (Interaction)

##### Interactions

- `startSession(target: Target): Session, over Editing`
- `apply(session: Session, edit: Edit): Edit, over Editing`

#### Edit Listener

Interface: told of every Edit applied to a Target, by any Session, in the order of the History — so every client sees every other's work. Implemented by the clients (UI, MCP, …). `applied` gives nothing back.

- Uses: Editing
- Exports: applied (Interaction)
- Imports: Editing: Editing (Language)

##### Interactions

- `applied(edit: Edit), over Editing`

#### Views

The vocabulary of points of view on a System, on its own so that Perspectives and every Perspective Kind share it without depending on each other. A **View** is one point of view (its **Perspective**: which, and optionally of which Subject) as **Items**, in an outline of parents and children, and **Links** between them; each Item is about a Subject, and carries **Marks** (diagnostics shown where they are). A View has no positions, sizes or colours: how it is drawn is the client's business, and an LLM reads the same View as data. Text is by value.

- Uses: Views
- Exports: Views (Language)
- Imports: Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language), Systemathic Subjects: Subjects (Language), Kernel Subjects (Language), Functions Subjects (Language), Contexts Subjects (Language), Deployment Subjects (Language), Mediation Subjects (Language), Systems Subjects (Language)

##### Views — extends Systems, Systems Subjects

Used by Views, Perspective Kind, Perspectives, Outline View, Language View, Component View, Deployment View, Mediation Stack View, Statistics View, UI, MCP Server, API.

- **Perspective**
- **View**
- **Item**
- **Link**
- **Mark**
- **Text**

**View.perspective ⟷ Perspective.(unnamed)**

- Each View has exactly one Perspective, as perspective. `1..1`
- Each Perspective has any number of Views, but cannot navigate to them. `0..N`

**View.system ⟷ System.(unnamed)**

- Each View has exactly one System, as system. `1..1`
- Each System has any number of Views, but cannot navigate to them. `0..N`

**View.items ⟷ Item.view**

- Each View has any number of Items, as items. `0..N`
- Each Item has exactly one View, as view. `1..1`

**View.links ⟷ Link.view**

- Each View has any number of Links, as links. `0..N`
- Each Link has exactly one View, as view. `1..1`

**Item.outgoing ⟷ Link.source**

- Each Item has any number of Links, as outgoing. `0..N`
- Each Link has exactly one Item, as source. `1..1`

**Item.incoming ⟷ Link.target**

- Each Item has any number of Links, as incoming. `0..N`
- Each Link has exactly one Item, as target. `1..1`

**Item.children ⟷ Item.parent**

- Each Item has any number of Items, as children. `0..N`
- Each Item has at most one Item, as parent. `0..1`

**Item.marks ⟷ Mark.item**

- Each Item has any number of Marks, as marks. `0..N`
- Each Mark has exactly one Item, as item. `1..1`

**Item.label ⟷ Text.(unnamed)**

- Each Item has exactly one Text, as label. `1..1`
- Each Text has any number of Items, but cannot navigate to them. `0..N`

**Mark.text ⟷ Text.(unnamed)**

- Each Mark has exactly one Text, as text. `1..1`
- Each Text has any number of Marks, but cannot navigate to them. `0..N`

**Perspective.name ⟷ Text.(unnamed)**

- Each Perspective has exactly one Text, as name. `1..1`
- Each Text has any number of Perspectives, but cannot navigate to them. `0..N`

**Item.subject ⟷ Subject.(unnamed)**

- Each Item has exactly one Subject, as subject. `1..1`
- Each Subject has any number of Items, but cannot navigate to them. `0..N`

**Perspective.subject ⟷ Subject.(unnamed)**

- Each Perspective has at most one Subject, as subject. `0..1`
- Each Subject has any number of Perspectives, but cannot navigate to them. `0..N`

- Axiom `all l in Link. l.source.view == l.view and l.target.view == l.view`
- Axiom `all i in Item, c in i.children. c.view == i.view`
- Axiom `all i in Item. not i in i.^parent`

#### Diagnoser

What is wrong with a System. `diagnose` verifies it, through the Systemathic Verifier, against its **structural** Rule — every formula of the Systemathic Languages, as StdLib Formula Assertions, always checked — and against the Rules it is given (the Configuration's profile), and reports each failed Assertion as a **Diagnostic**: its Severity, the Subjects it is about, a message, and Suggestions to fix it, each of which may carry the Edit that fixes it, ready to `apply`. A structural error is a Diagnostic of severity error from the structural Rule; it blocks exporting a Specification, never editing.

- Uses: Diagnostics
- Exports: Diagnostics (Language), diagnose (Interaction)
- Imports: Views: Views (Language), Systemathic Verifier: Rules (Language), verify (Interaction), Systemathic StdLib: Standard Assertions (Language), Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language), Editing: Editing (Language)

##### Diagnostics — extends Views, Rules, Standard Assertions, Editing

Used by Diagnoser, Perspectives, Exporter, UI, MCP Server, CLI, API.

- **Report**
- **Diagnostic** : Assertion Result
- **Severity**
- **Suggestion**

**Report.system ⟷ System.(unnamed)**

- Each Report has exactly one System, as system. `1..1`
- Each System has any number of Reports, but cannot navigate to them. `0..N`

**Report.diagnostics ⟷ Diagnostic.report**

- Each Report has any number of Diagnostics, as diagnostics. `0..N`
- Each Diagnostic has exactly one Report, as report. `1..1`

**Diagnostic.severity ⟷ Severity.(unnamed)**

- Each Diagnostic has exactly one Severity, as severity. `1..1`
- Each Severity has any number of Diagnostics, but cannot navigate to them. `0..N`

**Diagnostic.message ⟷ Text.(unnamed)**

- Each Diagnostic has exactly one Text, as message. `1..1`
- Each Text has any number of Diagnostics, but cannot navigate to them. `0..N`

**Diagnostic.suggestions ⟷ Suggestion.diagnostic**

- Each Diagnostic has any number of Suggestions, as suggestions. `0..N`
- Each Suggestion has exactly one Diagnostic, as diagnostic. `1..1`

**Suggestion.message ⟷ Text.(unnamed)**

- Each Suggestion has exactly one Text, as message. `1..1`
- Each Text has any number of Suggestions, but cannot navigate to them. `0..N`

**Diagnostic.subjects ⟷ Subject.(unnamed)**

- Each Diagnostic has one or more Subjects, as subjects. `1..N`
- Each Subject has any number of Diagnostics, but cannot navigate to them. `0..N`

**Suggestion.subjects ⟷ Subject.(unnamed)**

- Each Suggestion has any number of Subjects, as subjects. `0..N`
- Each Subject has any number of Suggestions, but cannot navigate to them. `0..N`

**Suggestion.fix ⟷ Edit.(unnamed)**

- Each Suggestion has at most one Edit, as fix. `0..1`
- Each Edit has any number of Suggestions, but cannot navigate to them. `0..N`

##### Interactions

- `diagnose(system: System, rules: Rule): Report, over Diagnostics`

#### Perspective Kind

Interface: one point of view on a System. `view` gives the View a Perspective asks for. Implemented by Outline View, Language View, Component View, Deployment View, Mediation Stack View and Statistics View; a new point of view is a new implementation, and nothing else changes.

- Uses: Views
- Exports: view (Interaction)
- Imports: Views: Views (Language)

##### Interactions

- `view(system: System, perspective: Perspective): View, over Views`

#### Perspectives

The one seam clients read a System through. `view` asks the Perspective Kind for the Perspective given, and puts the Diagnoser's Diagnostics on its Items as Marks — so every point of view shows what is wrong where it is.

- Uses: Views, Diagnostics
- Exports: view (Interaction)
- Imports: Views: Views (Language), Perspective Kind: view (Interaction), Diagnoser: Diagnostics (Language), diagnose (Interaction)

##### Interactions

- `view(system: System, perspective: Perspective): View, over Views`

#### Outline View

Implements Perspective Kind: Everything in the System as a tree: its Components, nested, each with its Languages, Interactions, Mediums, Exports, Imports and Deployments.

- Uses: Views
- Exports: none
- Imports: Perspective Kind, Views: Views (Language), Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language)
- Implements: Perspective Kind

#### Language View

Implements Perspective Kind: One Language: its Entities and what they extend, the Relationships between them, its Formulas, and the Interactions over it.

- Uses: Views
- Exports: none
- Imports: Perspective Kind, Views: Views (Language), Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language)
- Implements: Perspective Kind

#### Component View

Implements Perspective Kind: One Component: its Languages and what they extend, its children, the Languages each uses, what each imports from whom, and what it implements.

- Uses: Views
- Exports: none
- Imports: Perspective Kind, Views: Views (Language), Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language)
- Implements: Perspective Kind

#### Deployment View

Implements Perspective Kind: One Deployment: its Instances, with their ranges, and its Connections — each with its What and the Mediations it runs over.

- Uses: Views
- Exports: none
- Imports: Perspective Kind, Views: Views (Language), Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language)
- Implements: Perspective Kind

#### Mediation Stack View

Implements Perspective Kind: Which Language is mediated over which, through which Medium, by level from the top.

- Uses: Views
- Exports: none
- Imports: Perspective Kind, Views: Views (Language), Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language)
- Implements: Perspective Kind

#### Statistics View

Implements Perspective Kind: Counts, depths, fan-in and fan-out.

- Uses: Views
- Exports: none
- Imports: Perspective Kind, Views: Views (Language), Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language)
- Implements: Perspective Kind

#### Exporter

A verified design, as a contract for implementers — people or LLMs. `specify` gives the Specification of a System: **Statements** of design facts (each Language's vocabulary, what each Component may use and import, which crossings exist), the **Requirements** — the Rules it was verified against — and the **Obligations** no design check can discharge (round trips, preservation). It asks the Diagnoser first, and gives none while a structural error remains. How it is written down is a Specification Format's business.

- Uses: Specification, Diagnostics
- Exports: Specification (Language), specify (Interaction)
- Imports: Views: Views (Language), Diagnoser: Diagnostics (Language), diagnose (Interaction), Systemathic Verifier: Rules (Language), Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language)

##### Specification — extends Views, Rules

Used by Exporter, Specification Format, Markdown Format, JSON Format, UI, MCP Server, CLI, API.

- **Specification**
- **Section**
- **Statement**
- **Requirement**
- **Obligation**
- **Document**

**Specification.system ⟷ System.(unnamed)**

- Each Specification has exactly one System, as system. `1..1`
- Each System has any number of Specifications, but cannot navigate to them. `0..N`

**Specification.sections ⟷ Section.specification**

- Each Specification has any number of Sections, as sections. `0..N`
- Each Section has exactly one Specification, as specification. `1..1`

**Section.subsections ⟷ Section.parent**

- Each Section has any number of Sections, as subsections. `0..N`
- Each Section has at most one Section, as parent. `0..1`

**Section.statements ⟷ Statement.section**

- Each Section has any number of Statements, as statements. `0..N`
- Each Statement has exactly one Section, as section. `1..1`

**Statement.text ⟷ Text.(unnamed)**

- Each Statement has exactly one Text, as text. `1..1`
- Each Text has any number of Statements, but cannot navigate to them. `0..N`

**Specification.requirements ⟷ Requirement.specification**

- Each Specification has any number of Requirements, as requirements. `0..N`
- Each Requirement has exactly one Specification, as specification. `1..1`

**Requirement.rule ⟷ Rule.(unnamed)**

- Each Requirement has exactly one Rule, as rule. `1..1`
- Each Rule has any number of Requirements, but cannot navigate to them. `0..N`

**Specification.obligations ⟷ Obligation.specification**

- Each Specification has any number of Obligations, as obligations. `0..N`
- Each Obligation has exactly one Specification, as specification. `1..1`

**Obligation.text ⟷ Text.(unnamed)**

- Each Obligation has exactly one Text, as text. `1..1`
- Each Text has any number of Obligations, but cannot navigate to them. `0..N`

**Document.text ⟷ Text.(unnamed)**

- Each Document has exactly one Text, as text. `1..1`
- Each Text has any number of Documents, but cannot navigate to them. `0..N`

**Statement.subjects ⟷ Subject.(unnamed)**

- Each Statement has one or more Subjects, as subjects. `1..N`
- Each Subject has any number of Statements, but cannot navigate to them. `0..N`

**Obligation.subjects ⟷ Subject.(unnamed)**

- Each Obligation has one or more Subjects, as subjects. `1..N`
- Each Subject has any number of Obligations, but cannot navigate to them. `0..N`

- Axiom `all s in Section. not s in s.^parent`

##### Interactions

- `specify(system: System, rules: Rule): Specification, over Specification`

#### Specification Format

Interface: one representation of a Specification. `render` writes it as a Document. Implemented by Markdown Format (for a person or an LLM, with stable identifiers) and JSON Format (for a machine). The Specification does not depend on its representation.

- Uses: Specification
- Exports: render (Interaction)
- Imports: Exporter: Specification (Language)

##### Interactions

- `render(specification: Specification): Document, over Specification`

#### Markdown Format

Implements Specification Format: Markdown, for a person or an LLM: Sections as headings, Statements and Obligations as items with stable identifiers; it reads back into the Specification it came from.

- Uses: Specification
- Exports: none
- Imports: Specification Format, Exporter: Specification (Language)
- Implements: Specification Format

#### JSON Format

Implements Specification Format: JSON, for a machine.

- Uses: Specification
- Exports: none
- Imports: Specification Format, Exporter: Specification (Language)
- Implements: Specification Format

#### Python Verifier

Implements Systemathic Verifier: Rules and Assertions as Python, over the generated `systemathic.core` and `systemathic.std` bindings; a Violation is a yielded object. Run in a local process or, in the browser, by Pyodide — a choice of Configuration.

- Uses: Rules
- Exports: none
- Imports: Systemathic Verifier: Rules (Language)
- Implements: Systemathic Verifier

#### Documentation Writer

What a System and the things in it are for, written up for people: every Component, Language, Interaction, Medium and Deployment with its Description, each Relationship read both ways ("each Player has any number of Monsters, as prey"), and the Requirements with their Rules' documentation. Not a contract, and it does not read back: that is the Specification.

- Uses: Written Documentation
- Exports: Written Documentation (Language), write (Interaction)
- Imports: Documentation: Documentation (Language), Exporter: Specification (Language), Systemathic Subjects: Subjects (Language), Kernel Subjects (Language), Functions Subjects (Language), Contexts Subjects (Language), Deployment Subjects (Language), Mediation Subjects (Language), Systems Subjects (Language), Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language)

##### Written Documentation — extends Specification, Documentation

Used by Documentation Writer, UI, MCP Server, CLI, API.

##### Interactions

- `write(system: System): Document, over Written Documentation`

#### UI

The visual editor, for people: Explorer, Graph, the editors' panels, the Script and Documentation tabs. It draws Views (layout is its own business, kept as its own metadata), applies Edits built from gestures, shows Diagnostics with their fixes, and is told of every Edit by any client. Implements Edit Listener.

- Uses: Workspace, Editing, Views, Diagnostics, Specification, Written Documentation, Sources, Systems Editing, Documentation Editing, By Value Editing, Configuration Editing
- Exports: none
- Imports: Workspace: Workspace (Language), new (Interaction), open (Interaction), save (Interaction), close (Interaction), Editor: startSession (Interaction), apply (Interaction), Perspectives: view (Interaction), Diagnoser: Diagnostics (Language), diagnose (Interaction), Exporter: Specification (Language), specify (Interaction), Specification Format: render (Interaction), Documentation Writer: Written Documentation (Language), write (Interaction), Source: Sources (Language), contents (Interaction), Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language), Edit Listener, Systems Editor: Systems Editing (Language), Documentation Store: Documentation Editing (Language), By Value Store: By Value Editing (Language), Editing: Editing (Language), Views: Views (Language), Configuration Store: Configuration Editing (Language)
- Implements: Edit Listener

#### MCP Server

The tool for LLMs: every seam as an MCP tool — Views as structured data, every kind of Edit through `apply`, `diagnose`, `specify`. It edits the same Systems as the UI, in a Session of its own, and is told of every Edit. Implements Edit Listener.

- Uses: Workspace, Editing, Views, Diagnostics, Specification, Written Documentation, Sources, Systems Editing, Documentation Editing, By Value Editing, Configuration Editing
- Exports: none
- Imports: Workspace: Workspace (Language), new (Interaction), open (Interaction), save (Interaction), close (Interaction), Editor: startSession (Interaction), apply (Interaction), Perspectives: view (Interaction), Diagnoser: Diagnostics (Language), diagnose (Interaction), Exporter: Specification (Language), specify (Interaction), Specification Format: render (Interaction), Documentation Writer: Written Documentation (Language), write (Interaction), Source: Sources (Language), contents (Interaction), Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language), Edit Listener, Systems Editor: Systems Editing (Language), Documentation Store: Documentation Editing (Language), By Value Store: By Value Editing (Language), Editing: Editing (Language), Views: Views (Language), Configuration Store: Configuration Editing (Language)
- Implements: Edit Listener

#### CLI

The command line, for automation: `new`, `check` (diagnose, with an exit code), `verify`, `export` (a Specification in a Format, or the documentation), and `serve` — starting the Host.

- Uses: Workspace, Diagnostics, Specification, Written Documentation
- Exports: none
- Imports: Workspace: Workspace (Language), new (Interaction), open (Interaction), save (Interaction), close (Interaction), Diagnoser: Diagnostics (Language), diagnose (Interaction), Exporter: Specification (Language), specify (Interaction), Specification Format: render (Interaction), Documentation Writer: Written Documentation (Language), write (Interaction), Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language)

#### API

The tool for programs: every seam — Workspace, Editor, Perspectives, Diagnoser, Exporter, Formats, Documentation Writer, Sources — offered to code, so a script or another tool drives the same Systems as the UI and the MCP server, in a Session of its own. Implements Edit Listener.

- Uses: Workspace, Editing, Views, Diagnostics, Specification, Written Documentation, Sources, Systems Editing, Documentation Editing, By Value Editing, Configuration Editing
- Exports: none
- Imports: Workspace: Workspace (Language), new (Interaction), open (Interaction), save (Interaction), close (Interaction), Editor: startSession (Interaction), apply (Interaction), Perspectives: view (Interaction), Diagnoser: Diagnostics (Language), diagnose (Interaction), Exporter: Specification (Language), specify (Interaction), Specification Format: render (Interaction), Documentation Writer: Written Documentation (Language), write (Interaction), Source: Sources (Language), contents (Interaction), Edit Listener, Editing: Editing (Language), Views: Views (Language), Systems Editor: Systems Editing (Language), Documentation Store: Documentation Editing (Language), By Value Store: By Value Editing (Language), Configuration Store: Configuration Editing (Language)
- Implements: Edit Listener

#### Configuration Store

Implements Metadata Provider for Configurations (loads and saves them, its own way) and Edit Kind for it: Configurations and their Choices, each added, changed and removed.

- Uses: Configurations, Configuration Editing, Editing, Systems
- Exports: Configuration Editing (Language)
- Imports: Metadata Provider, Systemathic Metadata: Metadata (Language), Configurations: Configurations (Language), Editing: Editing (Language), Edit Kind, Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language)
- Implements: Metadata Provider, Edit Kind

##### Configuration Editing — extends Editing, Configurations

The kinds of Edit of Configurations, in the pattern every editor follows: AddConfiguration (the Configuration, by value), ChangeConfiguration and RemoveConfiguration; AddChoice (into the Choice above it), ChangeChoice and RemoveChoice.

Used by UI, MCP Server, API, Configuration Store.

- **AddConfiguration** : Edit
- **ChangeConfiguration** : Edit
- **RemoveConfiguration** : Edit
- **AddChoice** : Edit
- **ChangeChoice** : Edit
- **RemoveChoice** : Edit

**AddConfiguration.configuration ⟷ Configuration.(unnamed)**

- Each AddConfiguration has exactly one Configuration, as configuration. `1..1`
- Each Configuration has any number of AddConfigurations, but cannot navigate to them. `0..N`

**ChangeConfiguration.subject ⟷ Configuration.(unnamed)**

- Each ChangeConfiguration has exactly one Configuration, as subject. `1..1`
- Each Configuration has any number of ChangeConfigurations, but cannot navigate to them. `0..N`

**ChangeConfiguration.to ⟷ Configuration.(unnamed)**

- Each ChangeConfiguration has exactly one Configuration, as to. `1..1`
- Each Configuration has any number of ChangeConfigurations, but cannot navigate to them. `0..N`

**RemoveConfiguration.subject ⟷ Configuration.(unnamed)**

- Each RemoveConfiguration has exactly one Configuration, as subject. `1..1`
- Each Configuration has any number of RemoveConfigurations, but cannot navigate to them. `0..N`

**AddChoice.into ⟷ Choice.(unnamed)**

- Each AddChoice has exactly one Choice, as into. `1..1`
- Each Choice has any number of AddChoices, but cannot navigate to them. `0..N`

**AddChoice.choice ⟷ Choice.(unnamed)**

- Each AddChoice has exactly one Choice, as choice. `1..1`
- Each Choice has any number of AddChoices, but cannot navigate to them. `0..N`

**ChangeChoice.subject ⟷ Choice.(unnamed)**

- Each ChangeChoice has exactly one Choice, as subject. `1..1`
- Each Choice has any number of ChangeChoices, but cannot navigate to them. `0..N`

**ChangeChoice.to ⟷ Choice.(unnamed)**

- Each ChangeChoice has exactly one Choice, as to. `1..1`
- Each Choice has any number of ChangeChoices, but cannot navigate to them. `0..N`

**RemoveChoice.subject ⟷ Choice.(unnamed)**

- Each RemoveChoice has exactly one Choice, as subject. `1..1`
- Each Choice has any number of RemoveChoices, but cannot navigate to them. `0..N`

### Systemathic Metadata

Custom metadata on the things of a System: a **Custom Metadata** is about one Subject. Specific kinds are provided by other Components extending it (By Value, Documentation, UI layouts, …), each extending only the Subject layers it needs. Each provider stores and loads its own metadata, its own way; the Repository knows nothing of metadata.

- Uses: none
- Exports: Metadata (Language)
- Imports: Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language), Systemathic Subjects: Subjects (Language), Kernel Subjects (Language), Functions Subjects (Language), Contexts Subjects (Language), Deployment Subjects (Language), Mediation Subjects (Language), Systems Subjects (Language)

#### Metadata — extends Subjects

No Component uses it yet.

- **Custom Metadata**

**Custom Metadata.subject ⟷ Subject.(unnamed)**

- Each Custom Metadata has exactly one Subject, as subject. `1..1`
- Each Subject has any number of Custom Metadatas, but cannot navigate to them. `0..N`

### By Value

A metadata type provider: marks an Entity as having no identity of its own. A Relationship to a by-value Entity has only one side: the end at it is navigated by its owner (0..1 optional, 1..1 required, 0..N list), and the end at the owner is unnamed. A presentation convenience: the core does not know it.

- Uses: none
- Exports: By Value (Language)
- Imports: Systemathic Metadata: Metadata (Language), Systemathic Subjects: Subjects (Language), Kernel Subjects (Language), Functions Subjects (Language), Contexts Subjects (Language), Deployment Subjects (Language), Mediation Subjects (Language), Systems Subjects (Language)

#### By Value — extends Metadata, Kernel Subjects

Used by By Value Store.

- **ByValue** : Custom Metadata

- Axiom `all m in ByValue. some m.subject.entity`
- Axiom `all m in ByValue, e in m.subject.entity.ends, a in e.relationship.ends. a != e => no a.name`

### Documentation

A metadata type provider: a Description, in prose, of anything in a System — the System itself, a Component, Language, Entity, Relationship, Formula, Function, Medium, Deployment, Instance, Connection, Mediation. Text is by value. Like every provider, it stores and loads its own metadata; the Repository knows nothing of it.

- Uses: none
- Exports: Documentation (Language)
- Imports: Systemathic Metadata: Metadata (Language), Systemathic Subjects: Subjects (Language), Kernel Subjects (Language), Functions Subjects (Language), Contexts Subjects (Language), Deployment Subjects (Language), Mediation Subjects (Language), Systems Subjects (Language)

#### Documentation — extends Metadata, Systems Subjects

Used by Documentation Store.

- **Description** : Custom Metadata
- **Text**

**Description.text ⟷ Text.(unnamed)**

- Each Description has exactly one Text, as text. `1..1`
- Each Text has any number of Descriptions, but cannot navigate to them. `0..N`

### Systemathic Subjects

What can be talked about: a **Subject** is one thing of a System — exactly one Language, Entity, Relationship, End, Formula, Function, Parameter, Component, Deployment, Instance, Connection, Medium, Mediation or System. It is a closed sum, as the foundation composes one: **Subjects** is the core Language; each extension, one per layer of Systemathic, adds that layer's variants, so a consumer extends only the layers it talks about; Systems Subjects, which sees them all, states that exactly one is set. A Subject is by value: the things of a System never see the Subjects that name them. Metadata, Views, Diagnostics and Specifications are all about Subjects.

- Uses: none
- Exports: Subjects (Language), Kernel Subjects (Language), Functions Subjects (Language), Contexts Subjects (Language), Deployment Subjects (Language), Mediation Subjects (Language), Systems Subjects (Language)
- Imports: Systemathic: Kernel (Language), Functions (Language), Contexts (Language), Deployment (Language), Mediation (Language), Systems (Language)

#### Subjects — a core Language

No Component uses it yet.

- **Subject**

#### Kernel Subjects — extends Subjects, Kernel

No Component uses it yet.

**Subject.language ⟷ Language.(unnamed)**

- Each Subject has at most one Language, as language. `0..1`
- Each Language has any number of Subjects, but cannot navigate to them. `0..N`

**Subject.entity ⟷ Entity.(unnamed)**

- Each Subject has at most one Entity, as entity. `0..1`
- Each Entity has any number of Subjects, but cannot navigate to them. `0..N`

**Subject.relationship ⟷ Relationship.(unnamed)**

- Each Subject has at most one Relationship, as relationship. `0..1`
- Each Relationship has any number of Subjects, but cannot navigate to them. `0..N`

**Subject.end ⟷ End.(unnamed)**

- Each Subject has at most one End, as end. `0..1`
- Each End has any number of Subjects, but cannot navigate to them. `0..N`

**Subject.formula ⟷ Formula.(unnamed)**

- Each Subject has at most one Formula, as formula. `0..1`
- Each Formula has any number of Subjects, but cannot navigate to them. `0..N`

#### Functions Subjects — extends Kernel Subjects, Functions

No Component uses it yet.

**Subject.function ⟷ Function.(unnamed)**

- Each Subject has at most one Function, as function. `0..1`
- Each Function has any number of Subjects, but cannot navigate to them. `0..N`

**Subject.parameter ⟷ Parameter.(unnamed)**

- Each Subject has at most one Parameter, as parameter. `0..1`
- Each Parameter has any number of Subjects, but cannot navigate to them. `0..N`

#### Contexts Subjects — extends Functions Subjects, Contexts

No Component uses it yet.

**Subject.component ⟷ Component.(unnamed)**

- Each Subject has at most one Component, as component. `0..1`
- Each Component has any number of Subjects, but cannot navigate to them. `0..N`

#### Deployment Subjects — extends Contexts Subjects, Deployment

No Component uses it yet.

**Subject.deployment ⟷ Deployment.(unnamed)**

- Each Subject has at most one Deployment, as deployment. `0..1`
- Each Deployment has any number of Subjects, but cannot navigate to them. `0..N`

**Subject.instance ⟷ Instance.(unnamed)**

- Each Subject has at most one Instance, as instance. `0..1`
- Each Instance has any number of Subjects, but cannot navigate to them. `0..N`

**Subject.connection ⟷ Connection.(unnamed)**

- Each Subject has at most one Connection, as connection. `0..1`
- Each Connection has any number of Subjects, but cannot navigate to them. `0..N`

#### Mediation Subjects — extends Deployment Subjects, Mediation

No Component uses it yet.

**Subject.medium ⟷ Medium.(unnamed)**

- Each Subject has at most one Medium, as medium. `0..1`
- Each Medium has any number of Subjects, but cannot navigate to them. `0..N`

**Subject.mediation ⟷ Mediation.(unnamed)**

- Each Subject has at most one Mediation, as mediation. `0..1`
- Each Mediation has any number of Subjects, but cannot navigate to them. `0..N`

#### Systems Subjects — extends Mediation Subjects, Systems

No Component uses it yet.

**Subject.system ⟷ System.(unnamed)**

- Each Subject has at most one System, as system. `0..1`
- Each System has any number of Subjects, but cannot navigate to them. `0..N`

- Axiom `all s in Subject. (some s.language and no s.entity and no s.relationship and no s.end and no s.formula and no s.function and no s.parameter and no s.component and no s.deployment and no s.instance and no s.connection and no s.medium and no s.mediation and no s.system) or (some s.entity and no s.language and no s.relationship and no s.end and no s.formula and no s.function and no s.parameter and no s.component and no s.deployment and no s.instance and no s.connection and no s.medium and no s.mediation and no s.system) or (some s.relationship and no s.language and no s.entity and no s.end and no s.formula and no s.function and no s.parameter and no s.component and no s.deployment and no s.instance and no s.connection and no s.medium and no s.mediation and no s.system) or (some s.end and no s.language and no s.entity and no s.relationship and no s.formula and no s.function and no s.parameter and no s.component and no s.deployment and no s.instance and no s.connection and no s.medium and no s.mediation and no s.system) or (some s.formula and no s.language and no s.entity and no s.relationship and no s.end and no s.function and no s.parameter and no s.component and no s.deployment and no s.instance and no s.connection and no s.medium and no s.mediation and no s.system) or (some s.function and no s.language and no s.entity and no s.relationship and no s.end and no s.formula and no s.parameter and no s.component and no s.deployment and no s.instance and no s.connection and no s.medium and no s.mediation and no s.system) or (some s.parameter and no s.language and no s.entity and no s.relationship and no s.end and no s.formula and no s.function and no s.component and no s.deployment and no s.instance and no s.connection and no s.medium and no s.mediation and no s.system) or (some s.component and no s.language and no s.entity and no s.relationship and no s.end and no s.formula and no s.function and no s.parameter and no s.deployment and no s.instance and no s.connection and no s.medium and no s.mediation and no s.system) or (some s.deployment and no s.language and no s.entity and no s.relationship and no s.end and no s.formula and no s.function and no s.parameter and no s.component and no s.instance and no s.connection and no s.medium and no s.mediation and no s.system) or (some s.instance and no s.language and no s.entity and no s.relationship and no s.end and no s.formula and no s.function and no s.parameter and no s.component and no s.deployment and no s.connection and no s.medium and no s.mediation and no s.system) or (some s.connection and no s.language and no s.entity and no s.relationship and no s.end and no s.formula and no s.function and no s.parameter and no s.component and no s.deployment and no s.instance and no s.medium and no s.mediation and no s.system) or (some s.medium and no s.language and no s.entity and no s.relationship and no s.end and no s.formula and no s.function and no s.parameter and no s.component and no s.deployment and no s.instance and no s.connection and no s.mediation and no s.system) or (some s.mediation and no s.language and no s.entity and no s.relationship and no s.end and no s.formula and no s.function and no s.parameter and no s.component and no s.deployment and no s.instance and no s.connection and no s.medium and no s.system) or (some s.system and no s.language and no s.entity and no s.relationship and no s.end and no s.formula and no s.function and no s.parameter and no s.component and no s.deployment and no s.instance and no s.connection and no s.medium and no s.mediation)`

### Configurations

A metadata type provider: how a System is put together to run, and checked. A **Configuration** is about the System: from its root, it chooses for each Instance occupant the Component that fills it — the placed Component or one implementing it — and, for that Component, the Deployment it runs as; and it names its profile, the Rules it is verified against. Like every provider, it stores and loads its own metadata; the core knows nothing of it.

- Uses: none
- Exports: Configurations (Language)
- Imports: Systemathic Metadata: Metadata (Language), Systemathic Subjects: Subjects (Language), Kernel Subjects (Language), Functions Subjects (Language), Contexts Subjects (Language), Deployment Subjects (Language), Mediation Subjects (Language), Systems Subjects (Language), Systemathic Verifier: Rules (Language)

#### Configurations — extends Metadata, Systems Subjects, Rules

Configurations and their Choices. A Choice is for one occupant of an Instance: an Instance of range `0..N` has as many Choices as it has occupants. The root Choice is for the System's root, and has no Instance.

Used by Configuration Store.

- **Configuration** : Custom Metadata — One way to put the whole System together, and the Rules it must satisfy. Its root Choice is for the System's root Component.
- **Choice** — Which Component fills one occupant of an Instance (the Instance's own Component, or one implementing it), and which of that Component's Deployments it runs as; the Choices below it are for the Instances of that Deployment. A Component without Deployments is chosen with none.

**Configuration.name ⟷ Name.(unnamed)**

- Each Configuration has exactly one Name, as name. `1..1`
- Each Name has any number of Configurations, but cannot navigate to them. `0..N`

**Configuration.root ⟷ Choice.configuration**

- Each Configuration has exactly one Choice, as root. `1..1`
- Each Choice has at most one Configuration, as configuration. `0..1`

**Configuration.rules ⟷ Rule.(unnamed)**

- Each Configuration has any number of Rules, as rules. `0..N`
- Each Rule has any number of Configurations, but cannot navigate to them. `0..N`

**Choice.choices ⟷ Choice.parent**

- Each Choice has any number of Choices, as choices. `0..N`
- Each Choice has at most one Choice, as parent. `0..1`

**Choice.instance ⟷ Instance.(unnamed)**

- Each Choice has at most one Instance, as instance. `0..1`
- Each Instance has any number of Choices, but cannot navigate to them. `0..N`

**Choice.component ⟷ Component.(unnamed)**

- Each Choice has exactly one Component, as component. `1..1`
- Each Component has any number of Choices, but cannot navigate to them. `0..N`

**Choice.deployment ⟷ Deployment.(unnamed)**

- Each Choice has at most one Deployment, as deployment. `0..1`
- Each Deployment has any number of Choices, but cannot navigate to them. `0..N`

- Axiom `all c in Configuration. no c.root.parent and no c.root.instance`
- Axiom `all h in Choice. some h.parent or some h.configuration`
- Axiom `all h in Choice, p in h.parent. some h.instance and h.instance.deployment == p.deployment`
- Axiom `all h in Choice, i in h.instance. h.component == i.of or i.of in h.component.^implements`
- Axiom `all h in Choice, d in h.deployment. d.component == h.component`
- Axiom `all h in Choice. not h in h.^parent`

## Packages

### HTTP

- Uses: HTTP
- Exports: HTTP (Language), HTTP (Medium)
- Imports: none

#### HTTP — a core Language

Used by HTTP.

- **Request**
- **Response**
- **Method**
- **Target**
- **Header**
- **Body**
- **Status**

**Request.method ⟷ Method.requests**

- Each Request has exactly one Method, as method. `1..1`
- Each Method has any number of Requests, as requests. `0..N`

**Request.target ⟷ Target.requests**

- Each Request has exactly one Target, as target. `1..1`
- Each Target has any number of Requests, as requests. `0..N`

**Request.headers ⟷ Header.request**

- Each Request has any number of Headers, as headers. `0..N`
- Each Header has at most one Request, as request. `0..1`

**Request.body ⟷ Body.request**

- Each Request has at most one Body, as body. `0..1`
- Each Body has at most one Request, as request. `0..1`

**Response.status ⟷ Status.responses**

- Each Response has exactly one Status, as status. `1..1`
- Each Status has any number of Responses, as responses. `0..N`

**Response.headers ⟷ Header.response**

- Each Response has any number of Headers, as headers. `0..N`
- Each Header has at most one Response, as response. `0..1`

**Response.body ⟷ Body.response**

- Each Response has at most one Body, as body. `0..1`
- Each Body has at most one Response, as response. `0..1`

#### Interactions

- `exchange(request: Request): Response, over HTTP`

#### Mediums

- **HTTP**: over HTTP, through `exchange`

## Verification rules

### `opacity` — error, standard

Every mediated Connection is opaque: what uses and what offers do not know how they are connected.

For a Connection mediated over a stack, neither end's Component uses any Language below
its What's — the Languages of the Mediums it passes through. They import the realization,
and only the Deployment, and the realization, know the how.

This is what makes a how swappable: the Connection can move from one Medium to another
without touching either end. An end that speaks the Medium's Language is coupled to it.

To fix it, stop the end using the Medium's Language, and move whatever needed it into the
realization.

### `mediation_separate` — error, standard

Every Mediation joins two levels: its What's Language and its Medium's are not one, nor does either extend the other.

A Mediation is a step down in abstraction: what is carried, over what carries it. JSON
over Text: the Text holds the JSON. A Language over itself, or over one it extends or that
extends it, carries nothing across: the two are one level.

A level is a position in a stack, not a property of a Language. The same Language may be
mediated more than once in one stack, as Text is in `Name / Text / JSON / Text / HTTP`,
and above another in one stack and below it in the next; so each Mediation is checked
with its own two Languages only.

To fix it, mediate over a Medium of another Language, or remove the Mediation.

### `medium_blind` — error, standard

No Medium knows what it carries: the Component defining a Medium uses no Language mediated over it.

The other half of opacity. The ends of a Connection do not know how they are connected,
and what connects them does not know what it carries: a Text does not know it holds
JSON, nor TCP that it carries HTTP. Only the realization knows both.

A Medium that knows its What reaches up a level, and serves only that What.

To fix it, stop the Medium's Component using the What's Language, and move whatever
needed it into the realization.

### `mediators_minimal` — error, standard

A mediator knows its two Languages, and only them: a Component realizing a Mediation uses nothing else.

Only the realization of a Mediation knows both of its levels, and it needs nothing
more: CombatOverNetwork knows Combat and Network. A mediator that knows a third Language
mixes in another level or another concern; one realizing Mediations between different
pairs of Languages is several mediators in one. Between one pair, both ways are one
mediator: Text over JSON, and JSON over Text.

To fix it, give each pair of Languages a mediator of its own, and move whatever else the
Component does elsewhere.

### `projection_acyclic` — error, standard

No Language is projected, eventually, into itself.

A projection is a one-way Transformation: a view of an identity in another context, from
a Language into one that extends it. If one-way Transformations lead back to where they
began, there is no core: each Language is a view of another, and none is the identity
the others are views of.

To fix it, decide which Language holds the identities, and keep projections out of it.

### `generic_level` — error, standard

All arguments of a generic instantiation belong to one Language.

`Optional<X>` or `Result<X, E>` lifts through a Transformation only if every argument is at
the same level of abstraction; mixing Languages in one instantiation crosses levels
inside a single Entity.

A System records no generic instantiations yet, so nothing can violate this rule; it is
offered so that it applies as soon as they are recorded.

### `imports_acyclic` — warning, standard

No Component depends, eventually, on itself through its siblings: no two import from each other.

A Component's dependencies are its imports. Two Components importing from each other are
two dependencies, not one two-way link, and neither can be understood, replaced or
deployed without the other.

To fix it, move what both need into a Component of its own, which both import.

### `deployments_complete` — error, standard

In every Deployment, every Interaction an Instance's Component imports is reached by a Connection.

An import says a Component needs another's operation. A Deployment that places the
Component and connects none of its Instance's needs leaves that need unmet: the
Deployment does not say who serves it.

To fix it, connect the Instance to an Instance that offers the Interaction, or to the
deployed Component.

### `interactions_abstract` — warning, standard

Every imported Interaction is abstract: no Component is reached through an implementation vocabulary.

An Interaction over a Language some Mediation is over — a how — ties whoever imports it
to one way of carrying things out.

To fix it, offer the Interaction over the abstract Language, and mediate it over the how.

### `exports_interfaces` — warning, standard

Only interfaces are exported: no Export makes reachable a Component that has children.

A Component's children are its implementation. Exporting one with children of its own
hands that implementation out as API: whoever imports it can place it, and depends on
how it is built.

To fix it, export an interface — a Component without children, offering what the API
needs — and keep the Component with children as its implementation, unexported.

### `core_is_pure` — error

The language package imports and uses nothing, and its Languages are one chain, Kernel to Systems.

The core is the math only. Every tool feature is a Component of its own that imports it; the
core never knows one. Each layer extends exactly the one below it, so a consumer can stop at the
layer it needs.

### `vocabulary_only` — error

A vocabulary Component holds Languages and nothing that acts: no Interactions, Transformations, Mediums or Deployments.

Editing, Views, Subjects, Metadata and the like are on their own so that the parts sharing
them need not depend on each other. Anything that acts belongs to a part that imports them.

### `editing_knows_no_core` — error

Editing reaches nothing: it knows no concept of the core.

The kinds of Edit are Entities extending Edit in the editors' Languages; Editing itself is
only Targets, Sessions, History and Edits, so any Language can be edited the same way.

### `readers_dont_edit` — error

Nothing that reads a System — Views, Perspectives, Diagnoser, Exporter, Formats, Writer, Verifier — reaches anything that changes one.

Readers take a System, not a Target. They may speak of Edits (a Suggestion carries the Edit that
fixes it), so the Editing vocabulary is theirs to use; the Editor, the Edit Kinds and the
Workspace are not.

### `repository_knows_no_metadata` — error

The Repository and its implementations reach no metadata, nor any Metadata Provider.

A Repository stores the design only. Each provider stores and loads its own metadata, its own
way; the Workspace asks both.

### `workspace_joins_storage` — error

Only the Workspace imports both the Repository and the Metadata Provider.

Opening and saving a System is reading the design and asking every provider; that is the
Workspace's whole job, and no other part may do it on the side.

### `clients_are_hows` — error

No Component imports a client, clients offer no Interactions, and no Connection goes to one.

The UI, the MCP server, the CLI and the API are ways in. They are told of Edits only as Edit
Listeners, an interface they implement; nothing calls a client by name.

### `every_interface_implemented` — error

Every seam offers Interactions and has an implementation; each implementation uses the Languages of its Interactions; and only the seams are implemented.

The tool is defined at its seams, and its own implementations plug in the way anyone else's
would. A seam nobody implements is a hole; an implementation that cannot speak its
interface's Languages is not one; a Component implemented but not named a seam here is a
seam this profile does not know of.

### `editors_follow_layers` — error

Each concept editor implements Edit Kind, and its Language extends the editor's below it and speaks its own Systemathic layer.

So an editor covers a whole Language with its extensions, and the editors stack exactly as the
Languages they edit do.

