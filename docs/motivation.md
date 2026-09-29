# Motivation

## The problem

Most tools for drawing system architecture fall into one of two camps.

Free-form diagramming tools (whiteboards, generic box-and-arrow editors) let you draw
anything, which means they enforce nothing. You can draw a dependency that doesn't
actually make sense, model a boundary that isn't real, or let a diagram quietly drift
out of sync with the system it's supposed to describe — and nothing in the tool will
ever tell you.

Formal modelling notations (UML, C4, and the like) go the other way: they demand a lot
of ceremony and up-front notational correctness before they're useful, and they still
don't distinguish an *intentional* boundary from an accidental one. They describe
shape, not meaning.

This tool exists to sit between those two: a place to actually model a system's
structure — precisely enough that the model can be checked for internal consistency,
loosely enough that you can sketch and reshape it while you're still figuring out what
the system even is.

## What a system architecture actually is

The starting insight is that a system is not one flat graph of boxes and arrows. It's
several different things layered together, and most tools collapse them into one:

- A **vocabulary** — the nouns and verbs a part of the system talks in: what things
  exist, how they relate, what they can do. This is closed and self-consistent on its
  own; it doesn't reference anything outside itself.
- A **bounded context** — a scope in which some set of vocabularies are in play
  together, and where translations between them live. This is where architecture
  decisions actually get made: what talks to what, and how.
- A **translation** — an explicit, inspectable mapping from one vocabulary to another.
  Nothing crosses from one vocabulary into another silently; if it crosses, there's a
  named mapping you can look at.
- A **mediation** — the idea that a high-level intent can be carried out by more than
  one concrete executor, with the translation between them swappable without changing
  the intent itself.

Keeping these as distinct, explicit concepts — rather than flattening them into "boxes
and arrows" — is what makes the model checkable. A tool that understands the
difference between a vocabulary and a bounded context can tell you when a "boundary"
you drew isn't really a boundary, or when two things that never share a context are
nonetheless talking to each other directly.

## A vocabulary is a shared resource, not private property

An early and important correction to this model: a bounded context does not *own* the
vocabularies used inside it. It *references* them.

The reason this matters is simple and comes up constantly in real systems: the same
vocabulary is legitimately used inside more than one context. An HTTP vocabulary isn't
reinvented per service; a domain vocabulary might be consumed by more than one bounded
process. If a context owned its vocabulary outright, the model would force you to
either duplicate it per context (and let the duplicates drift apart) or arbitrarily
pick one "true" owner (which doesn't reflect reality either).

So a vocabulary is a top-level, independent thing. It can exist before it's used
anywhere. Multiple contexts can reference the same one. Deleting a context doesn't
delete the vocabularies it referenced — only the reference, and whatever that context
alone was responsible for (its own translations). Deleting a vocabulary, on the other
hand, is a real, cascading removal, because everything inside it — its entities, their
relationships and actions, the interactions it defines — genuinely stops existing with
it, wherever it was referenced from.

This is the same distinction as owning a value versus holding a reference to a shared
one, applied to architecture instead of to memory.

## Why validation matters, and what it actually checks

A model like this is only useful if it can be checked, and the checks worth having are
the ones that catch mistakes a person would otherwise only notice much later:

- A vocabulary should be **closed under itself** — the things it defines shouldn't
  quietly leak identity from another vocabulary. If an operation in one vocabulary
  claims to work with something from a different one, without an explicit translation,
  that's a structural leak, not a detail.
- A relationship *between* two vocabularies should only exist where there's an actual
  shared context that intends them to interact. Two vocabularies interacting with no
  bounded context in common is a sign the model is missing a decision, not that
  everything's fine.
- A translation should be **complete** — every concept on the source side should have
  somewhere to go on the target side, or the omission should be visible and named
  rather than silently absent.
- A relationship's cardinality and its constraints should be **well-formed** — the
  numbers should mean what they claim to mean, and a declared invariant should
  actually hold.

None of these are about style. They're about catching the moment a model stops
describing a coherent system and starts describing something that merely looks like
one.

## Mediation: letting intent outlive its execution

A recurring shape in real systems is that a piece of intent (what should happen) is
carried out by some concrete executor (how it happens), and the same intent may
reasonably be carried out by more than one executor over the system's life — a local
implementation today, a different one tomorrow, without the intent itself changing.

Modelling this directly — an intent context, an executor context, and an explicit
translation layer between them — makes that swap a first-class, visible operation
instead of an implicit assumption buried in code. It also means the tool can be honest
about what's actually connected to what: not "these two things are related" in the
abstract, but "this specific translation is what makes them work together, and here it
is."

## The standing design principle

Underneath all of this is a consistent preference: build the smallest real core, and
make sure it's shaped so that new capability is added by extending a seam that already
exists, not by reshaping what's already there. A model that starts almost empty — a
vocabulary with no entities yet, a context referencing nothing yet — should be exactly
as valid and exactly as useful a starting point as a fully fleshed-out one. Growth
should look like *filling in* an intentionally-left extension point, not like
renovating a structure that was built assuming it would never need to change.

That preference is the reason the vocabulary/context split above exists at all, and
it's the thing worth carrying forward even if every other detail of the model gets
redrawn.
