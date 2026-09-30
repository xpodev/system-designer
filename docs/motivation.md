# Motivation

## The problem

A system's design usually lives in prose and diagrams. Both say what the system is meant
to be, and neither can be checked.

Free-form diagrams let you draw anything, so they enforce nothing. A boundary on a
whiteboard is an intention; nothing tells you when a dependency crosses it the wrong
way, or when the diagram and the system quietly drift apart. Formal modelling notations
go the other way: they demand heavy ceremony before they are useful, and still describe
shape rather than meaning. They do not distinguish an intentional boundary from an
accidental one.

Written design rules fare no better. "The game core must not know about networking" is
clear to its author and ambiguous to everyone else — and increasingly, "everyone else"
includes the LLMs writing much of the code. A model given rules in natural language
follows them approximately, and there is no way to tell, short of reading everything,
whether it did.

## The idea

Design a system as a **precise model** before writing code: exact enough to be checked
mechanically, light enough to sketch and reshape while you are still working out what
the system is.

The model captures what most tools flatten into boxes and arrows:

- **Vocabularies.** Each part of a system speaks its own closed vocabulary — the things
  it knows about and what can be done with them — at one level of abstraction.
- **Contexts.** A context is where some vocabularies are in play together. It is the
  unit a team or a module actually owns.
- **Explicit crossings.** Nothing moves from one vocabulary into another silently.
  Every crossing is a named, inspectable mapping, and it has a direction: a *what*
  carried out over a *how*, like IP over avian carriers. The what never needs to know
  which how is carrying it, so the how can be swapped.

Keeping these apart is what makes a design checkable: whether each context is
self-contained, and whether everything that crosses between contexts does so
explicitly and in the right direction.

The precise definitions are in [foundation.md](foundation.md).

## Design, verify, validate

The tool itself does one thing: it lets you build the model, visually, and exports it.
Everything that *checks* anything is a **script** run against the model — ordinary code
over a well-defined structure, rather than features built into the tool.

- **Verifying the design.** A script checks the model against rules: whether contexts
  are self-contained, whether crossings go the right way, and whatever house rules a
  particular system adopts ("the game core is never an implementation detail"). Which
  rules apply, and how strictly, is chosen per system — anything from a lenient sketch
  to a strict contract.
- **Validating implementations.** Once a design is verified, it becomes a contract.
  Exported as a formal specification, it tells an implementer — a person or an LLM —
  exactly what vocabularies exist, what each context may use, and which crossings are
  allowed, with no natural language left to interpret. Scripts can then check an
  implementation against that contract: today by the implementer checking its own work
  against the specification, later by tools that inspect actual artifacts, such as
  compiled .NET assemblies.

The model is the single source of truth; verification and validation are both just
scripts over it. That keeps the tool small, and makes checking extensible without
changing the tool.

## What it is not

- **Not a verifier of internal logic.** It checks how parts of a system relate, not
  whether any part is internally correct.
- **Not a programming language.** It says what exists and how levels map onto each
  other, not how anything is computed.
- **Not about wiring.** How implementations are constructed and connected — dependency
  injection, containers, lifetimes — is a mechanism of coupling. The tool is about
  decoupling.

## The standing design principle

Build the smallest real core, shaped so that new capability is added by extending a
seam that already exists rather than by reshaping what is there. A model that starts
almost empty — one vocabulary, no contexts — is as valid a starting point as a complete
one. Growth should look like filling in an intentionally left extension point, not like
renovating a structure built on the assumption it would never change.

The foundation holds itself to this: its kernel is three concepts and a logic, and
everything else — including the vocabulary the tool itself is built from — is written
in terms of them.
