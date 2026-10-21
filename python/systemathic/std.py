"""systemathic.std: the standard concepts and rules (docs/foundation.md, Part II and Part IV).

Everything here is defined in terms of the core. A **rule** is a function from a System to
the Violations it finds; a **profile** is the set of rules a System is verified against.

    from systemathic.core import *
    from systemathic.std import *

    @rule(severity=ERROR)
    def core_is_core(system: System):
        if not is_core(system.language("Core")):
            yield Violation(system.language("Core"), "Core must build on nothing")

    profile = Profile(core_is_core, *standard_rules, mediation_primitives("In-process"))

The standard rules are offered, never imposed: a profile has exactly the rules it lists.
Rules that need arguments — which Mediums are primitive, how deep a stack must go — take
them explicitly, with no defaults.

What is verified is the **current Configuration**: the Deployment chosen for the root, and
everything chosen below it (docs/foundation.md, *What is verified*). Rules over Deployments,
Connections and Mediations read only those; a System with no Configuration has every
Deployment read.
"""

from __future__ import annotations

import inspect
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Callable, Iterable, Iterator, Sequence

from .core import Element, System

__all__ = [
    "ERROR", "WARNING", "Rule", "Profile", "Violation", "rule",
    "vocab", "ancestry", "siblings", "scope", "is_core", "is_extension",
    "leaf", "self_contained", "pure", "standalone", "shared", "dependencies",
    "resolve", "imported", "imported_components", "offered",
    "Occupant", "configuration", "occupants", "in_use", "connections", "mediations",
    "what_language", "ends", "source", "target", "round_trip", "is_projection", "hows", "abstract_language", "abstract",
    "items", "interface", "implementations",
    "opacity", "mediation_separate", "medium_blind", "mediators_minimal", "projection_acyclic", "generic_level", "imports_acyclic",
    "interactions_abstract", "fan_out_silent", "construction_acyclic", "apis_placed",
    "mediation_primitives", "mediation_depth", "mediations_realized",
    "spoken", "containing", "disjoint", "uniform", "pipeline",
    "standard_rules", "standard",
]

ERROR = "error"
WARNING = "warning"


# -- rules, profiles, violations ----------------------------------------------------------

@dataclass(frozen=True)
class Violation:
    """What a rule found: the Elements it is about, and why."""

    subjects: Element | Sequence[Element]
    message: str

    @property
    def elements(self) -> list[Element]:
        return [self.subjects] if isinstance(self.subjects, Element) else list(self.subjects)


@dataclass(frozen=True)
class Rule:
    function: Callable[[System], Iterable[Violation]]
    severity: str

    @property
    def name(self) -> str:
        return self.function.__name__

    @property
    def doc(self) -> str:
        """The rule's docstring, as written: what it checks, then why, at any length."""
        return inspect.cleandoc(self.function.__doc__ or "")

    @property
    def about(self) -> str:
        """What it checks, in a sentence: the docstring's first paragraph, on one line."""
        return " ".join(self.doc.split("\n\n")[0].split())

    def __call__(self, system: System) -> list[Violation]:
        return list(self.function(system) or [])

    def at(self, severity: str) -> Rule:
        """The same rule, at another severity."""
        return Rule(self.function, severity)


def rule(severity: str = ERROR) -> Callable[[Callable[[System], Iterable[Violation]]], Rule]:
    if severity not in (ERROR, WARNING):
        raise ValueError(f"a severity is {ERROR!r} or {WARNING!r}, not {severity!r}")
    return lambda function: Rule(function, severity)


@dataclass(frozen=True)
class Profile:
    """The rules a System is verified against. A later rule of the same name replaces an earlier one."""

    rules: tuple[Rule, ...] = field(default_factory=tuple)

    def __init__(self, *rules: Rule):
        by_name: dict[str, Rule] = {}
        for each in rules:
            if not isinstance(each, Rule):
                raise TypeError(f"a Profile holds rules, not {each!r}")
            by_name.pop(each.name, None)
            by_name[each.name] = each
        object.__setattr__(self, "rules", tuple(by_name.values()))


# -- Languages ----------------------------------------------------------------------------

def vocab(language: Element) -> list[Element]:
    """`L.*extends`: a Language and every Language it extends, eventually, nearest first."""
    found: list[Element] = []
    pending = [language]
    while pending:
        current = pending.pop(0)
        if current not in found:
            found.append(current)
            pending.extend(current.extends)
    return found


def is_core(language: Element) -> bool:
    """A core Language: it extends nothing of its own Component — nothing at all, or only
    Languages from the Components it is nested in or imports."""
    return all(extended.component is not language.component for extended in language.extends)


def is_extension(language: Element) -> bool:
    """An extension: a Language that extends another of its own Component."""
    return not is_core(language)


def items(language: Element) -> list[Element]:
    """A Language's own Entities and Relationships."""
    return [*language.entities, *language.relationships]


# -- Components ---------------------------------------------------------------------------

def ancestry(component: Element) -> list[Element]:
    """`C.*parent`: a Component and every Component it is nested in, nearest first."""
    found: list[Element] = []
    current: Element | None = component
    while current is not None and current not in found:
        found.append(current)
        current = current.parent
    return found


def siblings(component: Element) -> list[Element]:
    """The Components beside it: its parent's other children; for the root and the packages, each other."""
    if component.parent is not None:
        return [other for other in component.parent.components if other is not component]
    system = component.model.system
    top = [] if system is None else [c for c in [system.root, *system.packages] if c is not None]
    return [other for other in top if other is not component]


def resolve(export: Element) -> Element | None:
    """What an Export makes reachable: its target."""
    return next((target for end in _EXPORTED if (target := getattr(export, end)) is not None), None)


_EXPORTED = ("component", "interaction", "transformation", "language", "medium")


def offered(component: Element, kind: str) -> list[Element]:
    """What a Component exports of one kind ("Interaction", "Component", ...): its API, resolved."""
    return _of_kind((resolve(export) for export in component.exports), kind)


def imported(component: Element, kind: str) -> list[Element]:
    """What a Component's Imports resolve to, of one kind ("Interaction", "Language", ...)."""
    return _of_kind((resolve(export) for each in component.imports for export in each.exports), kind)


def _of_kind(elements: Iterable[Element | None], kind: str) -> list[Element]:
    found: list[Element] = []
    for element in elements:
        if element is not None and element.kind == kind and element not in found:
            found.append(element)
    return found


def imported_components(component: Element) -> list[Element]:
    """The Components a Component imports: those its Imports are from, and those they resolve to."""
    found = [getattr(each, "from") for each in component.imports if getattr(each, "from") is not None]  # `from` is a Python keyword
    found += imported(component, "Component")
    return list(dict.fromkeys(found))


def scope(component: Element) -> list[Element]:
    """The Languages a Component may use: its own and its parents', and those it imports."""
    found: list[Element] = []
    for owner in ancestry(component):
        found += [language for language in owner.languages if language not in found]
    found += [language for language in imported(component, "Language") if language not in found]
    return found


def leaf(component: Element) -> bool:
    return not component.components


def self_contained(component: Element) -> bool:
    """It uses only Languages it owns."""
    return all(language.component is component for language in component.uses)


def pure(component: Element) -> bool:
    """It imports nothing: it depends only on Languages."""
    return not component.imports


def dependencies(component: Element) -> list[Element]:
    """The Components it depends on: those its Imports, and those of the Deployments it keeps and
    the current Configuration uses, are from or take, and the box of each identity they import.
    Depending on a Component nested in another is depending on what it is nested in, up to the
    first Component both share: a child does not exist without its parent."""
    used = set(in_use(component.model.system)) if component.model.system is not None else set()
    owners = [component, *(d for d in component.kept if d in used)]
    targets: list[Element] = []
    for owner in owners:
        targets += imported_components(owner)
        for each in owner.imports:
            if each.steps and each.steps[-1].instance is not None and each.steps[-1].instance.of is not None:
                targets.append(each.steps[-1].instance.of)
    mine = set(ancestry(component))
    found: list[Element] = []
    for target in targets:
        for outer in ancestry(target):
            if outer in mine:
                break
            if outer is not component and outer not in found:
                found.append(outer)
    return found


def standalone(component: Element) -> bool:
    """It has an Instance in a Deployment of its parent."""
    return any(instance.deployment is not None and instance.deployment.component is component.parent for instance in component.instances)


def interface(component: Element) -> bool:
    """It has no Deployment: its implementation is undefined, and nothing relies on more than its interface."""
    return not component.deployments


def implementations(component: Element) -> list[Element]:
    """Its Deployments: the ways it may be built, wherever they are kept."""
    return list(component.deployments)


def shared(component: Element) -> bool:
    """Its siblings' Deployments place it, each an Instance of its own."""
    beside = set(siblings(component))
    return any(instance.deployment is not None and instance.deployment.component in beside for instance in component.instances)


# -- what is verified: the current Configuration ------------------------------------------

@dataclass(eq=False)
class Occupant:
    """One real Instance under the current Configuration: the placement it occupies (none for the
    System's root), the Deployment it runs, if any, and the occupant it is inside."""

    instance: Element | None
    deployment: Element | None
    parent: "Occupant | None"

    @property
    def path(self) -> tuple[Element, ...]:
        """Its identity: the placements from the root down to it."""
        found: list[Element] = []
        current: Occupant | None = self
        while current is not None and current.instance is not None:
            found.append(current.instance)
            current = current.parent
        return tuple(reversed(found))


def configuration(system: System) -> dict | None:
    """The current Configuration, as stored: the one the Configurations name `current`, or the first."""
    for attachment in getattr(system.model, "attachments", []):
        if attachment.get("owner") == "configurations":
            data = attachment.get("data") or {}
            found = data.get("configurations") or []
            current = data.get("current")
            return next((c for c in found if c.get("id") == current), found[0] if found else None)
    return None


def occupants(system: System) -> list[Occupant]:
    """Every real Instance under the current Configuration, from the root down. A placement the
    Configuration makes no Choice for is one occupant, running the Deployment the design fixes, if any."""
    chosen = configuration(system)
    if chosen is None:
        return []
    elements = system.model.elements
    found: list[Occupant] = []

    def walk(occupant: Occupant, choices: list[dict]) -> None:
        found.append(occupant)
        if occupant.deployment is None:
            return
        for placement in occupant.deployment.instances:
            mine = [c for c in choices if c.get("instance") == placement.id]
            if not mine:
                walk(Occupant(placement, placement.runs, occupant), [])
            for choice in mine:
                deployment = elements.get(choice["deployment"]) if choice.get("deployment") else placement.runs
                walk(Occupant(placement, deployment, occupant), choice.get("choices", []))

    root = chosen.get("root") or {}
    walk(Occupant(None, elements.get(root.get("deployment") or ""), None), root.get("choices", []))
    return found


def in_use(system: System) -> list[Element]:
    """The Deployments the current Configuration uses; every Deployment, if there is no Configuration."""
    if configuration(system) is None:
        return system.all("Deployment")
    return list(dict.fromkeys(o.deployment for o in occupants(system) if o.deployment is not None))


def connections(system: System) -> list[Element]:
    """The Connections of the Deployments in use."""
    return [c for d in in_use(system) for c in d.connections]


def mediations(system: System) -> list[Element]:
    """The Mediations of the Connections in use."""
    return [m for c in connections(system) for m in c.mediations]


# -- Connections and Mediations -----------------------------------------------------------

def ends(connection: Element) -> list[Element]:
    """The Components at a Connection's ends: what it goes from, and what it goes to."""
    source = getattr(connection, "from")  # `from` is a Python keyword
    found = [source.of if source is not None else None]
    found.append(connection.to.of if connection.to is not None else connection.toComponent)
    return [component for component in found if component is not None]


def what_language(mediation: Element) -> Element | None:
    """The Language a Mediation's What is over: its Connection's What's, or the call's of the Medium above it."""
    connection = mediation.connection
    if connection is None:
        return None
    stack = connection.mediations
    position = stack.index(mediation) if mediation in stack else 0
    if position == 0:
        return connection.what[0].language if connection.what else None
    above = stack[position - 1].how
    return above.language if above is not None else None


def source(transformation: Element) -> Element | None:
    """A Transformation's source Language: its inputs'."""
    parameters = transformation.parameters
    return parameters[0].type.language if parameters and parameters[0].type is not None else None


def target(transformation: Element) -> Element | None:
    """A Transformation's target Language: its output's."""
    output = transformation.output
    return output.language if output is not None else None


def round_trip(transformation: Element) -> bool:
    """Some Transformation leads back from its target to its source."""
    there, back = target(transformation), source(transformation)
    if there is None:
        return False
    others = transformation.model.system.all("Transformation") if transformation.model.system is not None else []
    return any(source(other) is there and target(other) is back for other in others)


def is_projection(transformation: Element) -> bool:
    """A one-way Transformation: none leads back."""
    return not round_trip(transformation)


def _hows(mediations: Iterable[Element]) -> set[Element]:
    return {m.how.language for m in mediations if m.how is not None and m.how.language is not None}


def hows(system: System) -> set[Element]:
    """The Languages some Mediation is over: the Languages of the Mediums it passes through."""
    return _hows(system.all("Mediation"))


def abstract_language(language: Element) -> bool:
    """A Language that is never the how of a Mediation."""
    return language not in _hows(e for e in language.model.elements.values() if e.kind == "Mediation")


def abstract(element: Element) -> bool:
    """A Language that is never a how, or an Interaction over one."""
    language = element.language if element.kind == "Interaction" else element
    return language is not None and abstract_language(language)


# -- the standard rules -----------------------------------------------------------------------

def _cycles(nodes: Iterable[Element], edges: Callable[[Element], Iterable[Element]]) -> list[list[Element]]:
    """The strongly connected components with a cycle (Tarjan)."""
    index: dict[Element, int] = {}
    low: dict[Element, int] = {}
    stack: list[Element] = []
    on_stack: set[Element] = set()
    found: list[list[Element]] = []

    def visit(node: Element) -> None:
        index[node] = low[node] = len(index)
        stack.append(node)
        on_stack.add(node)
        for other in edges(node):
            if other not in index:
                visit(other)
                low[node] = min(low[node], low[other])
            elif other in on_stack:
                low[node] = min(low[node], index[other])
        if low[node] == index[node]:
            component = []
            while True:
                member = stack.pop()
                on_stack.discard(member)
                component.append(member)
                if member is node:
                    break
            if len(component) > 1 or node in edges(node):
                found.append(component[::-1])

    for node in nodes:
        if node not in index:
            visit(node)
    return found


def _names(elements: Iterable[Element]) -> str:
    return ", ".join(sorted(str(e.name) for e in elements))


@rule(severity=ERROR)
def opacity(system: System) -> Iterator[Violation]:
    """Every mediated Connection is opaque: what uses and what offers do not know how they are connected.

    For a Connection mediated over a stack, neither end's Component uses any Language below
    its What's — the Languages of the Mediums it passes through. The realization is the
    Deployment's, and only the Deployment, through it, knows the how.

    This is what makes a how swappable: the Connection can move from one Medium to another
    without touching either end. An end that speaks the Medium's Language is coupled to it.

    To fix it, stop the end using the Medium's Language, and move whatever needed it into the
    realization.
    """
    for connection in connections(system):
        below = [m.how.language for m in connection.mediations if m.how is not None and m.how.language is not None]
        for end in ends(connection):
            spoken = {language for used in end.uses for language in vocab(used)}
            for language in below:
                if language in spoken:
                    yield Violation([connection, end], f"{end.name} knows {language.name}, which its Connection is mediated over")


@rule(severity=ERROR)
def mediation_separate(system: System) -> Iterator[Violation]:
    """Every Mediation joins two levels: its What's Language and its Medium's are not one, nor does either extend the other.

    A Mediation is a step down in abstraction: what is carried, over what carries it. JSON
    over Text: the Text holds the JSON. A Language over itself, or over one it extends or that
    extends it, carries nothing across: the two are one level.

    A level is a position in a stack, not a property of a Language. The same Language may be
    mediated more than once in one stack, as Text is in `Name / Text / JSON / Text / HTTP`,
    and above another in one stack and below it in the next; so each Mediation is checked
    with its own two Languages only.

    To fix it, mediate over a Medium of another Language, or remove the Mediation.
    """
    seen: set[tuple[Element, Element]] = set()
    for mediation in mediations(system):
        what = what_language(mediation)
        how = mediation.how.language if mediation.how is not None else None
        if what is None or how is None or (what, how) in seen:
            continue
        seen.add((what, how))
        if what is how:
            yield Violation([mediation.connection, mediation], f"{what.name} is mediated over itself")
        elif how in vocab(what) or what in vocab(how):
            yield Violation([mediation.connection, mediation], f"{what.name} is mediated over {how.name}, and one extends the other")


@rule(severity=ERROR)
def medium_blind(system: System) -> Iterator[Violation]:
    """No Medium knows what it carries: the Component defining a Medium uses no Language mediated over it.

    The other half of opacity. The ends of a Connection do not know how they are connected,
    and what connects them does not know what it carries: a Text does not know it holds
    JSON, nor TCP that it carries HTTP. Only the realization knows both.

    A Medium that knows its What reaches up a level, and serves only that What.

    To fix it, stop the Medium's Component using the What's Language, and move whatever
    needed it into the realization.
    """
    seen: set[tuple[Element, Element]] = set()
    for mediation in mediations(system):
        what, medium = what_language(mediation), mediation.how
        if what is None or medium is None or medium.component is None or (medium, what) in seen:
            continue
        seen.add((medium, what))
        spoken = {language for used in medium.component.uses for language in vocab(used)}
        if what in spoken:
            yield Violation([medium.component, mediation], f"{medium.component.name} knows {what.name}, which its Medium {medium.name} carries")


@rule(severity=ERROR)
def mediators_minimal(system: System) -> Iterator[Violation]:
    """A mediator knows its two Languages, and only them: a Component realizing a Mediation uses nothing else.

    Only the realization of a Mediation knows both of its levels, and it needs nothing
    more: CombatOverNetwork knows Combat and Network. A mediator that knows a third Language
    mixes in another level or another concern; one realizing Mediations between different
    pairs of Languages is several mediators in one. Between one pair, both ways are one
    mediator: Text over JSON, and JSON over Text.

    To fix it, give each pair of Languages a mediator of its own, and move whatever else the
    Component does elsewhere.
    """
    pairs: dict[Element, list[frozenset[Element]]] = {}
    for mediation in mediations(system):
        what = what_language(mediation)
        how = mediation.how.language if mediation.how is not None else None
        if what is None or how is None:
            continue
        for realization in (mediation.down, mediation.up):
            if realization is not None and realization.component is not None:
                found = pairs.setdefault(realization.component, [])
                if frozenset((what, how)) not in found:
                    found.append(frozenset((what, how)))
    for mediator, found in pairs.items():
        if len(found) > 1:
            yield Violation(mediator, f"{mediator.name} mediates between {', '.join(_names(pair).replace(', ', ' and ') for pair in found)}")
            continue
        known = {language for each in found[0] for language in vocab(each)}
        extra = [language for language in mediator.uses if language not in known]
        if extra:
            yield Violation(mediator, f"{mediator.name} mediates between {_names(found[0]).replace(', ', ' and ')}, and knows {_names(extra)} too")


@rule(severity=ERROR)
def projection_acyclic(system: System) -> Iterator[Violation]:
    """No Language is projected, eventually, into itself.

    A projection is a one-way Transformation: a view of an identity in another context, from
    a Language into one that extends it. If one-way Transformations lead back to where they
    began, there is no core: each Language is a view of another, and none is the identity
    the others are views of.

    To fix it, decide which Language holds the identities, and keep projections out of it.
    """
    projections = [t for t in system.all("Transformation") if is_projection(t) and source(t) is not None and target(t) is not None]
    for cycle in _cycles(system.all("Language"), lambda l: [target(t) for t in projections if source(t) is l]):
        yield Violation(cycle, f"projected into themselves: {_names(cycle)}")


@rule(severity=ERROR)
def generic_level(system: System) -> Iterator[Violation]:
    """All arguments of a generic instantiation belong to one Language.

    `Optional<X>` or `Result<X, E>` lifts through a Transformation only if every argument is at
    the same level of abstraction; mixing Languages in one instantiation crosses levels
    inside a single Entity.

    A System records no generic instantiations yet, so nothing can violate this rule; it is
    offered so that it applies as soon as they are recorded.
    """
    return iter(())


@rule(severity=WARNING)
def imports_acyclic(system: System) -> Iterator[Violation]:
    """No Component depends, eventually, on itself: no two import from each other, wherever they are.

    A Component's dependencies are its imports. Two Components importing from each other are
    two dependencies, not one two-way link, and neither can be understood, replaced or
    deployed without the other. That they may talk both ways is another matter: a reply is
    the callee's, and a notification goes through an interface the caller owns.

    To fix it, move what both need into a Component of its own, which both import, or turn
    one direction around, through an interface.
    """
    for cycle in _cycles(system.all("Component"), dependencies):
        yield Violation(cycle, f"depend on each other: {_names(cycle)}")


@rule(severity=WARNING)
def interactions_abstract(system: System) -> Iterator[Violation]:
    """Every imported Interaction is abstract: no Component is reached through an implementation vocabulary.

    An Interaction over a Language some Mediation is over — a how — ties whoever imports it
    to one way of carrying things out.

    To fix it, offer the Interaction over the abstract Language, and mediate it over the how.
    """
    implementation = hows(system)
    for deployment in in_use(system):
        for interaction in imported(deployment, "Interaction"):
            if interaction.language in implementation:
                yield Violation([deployment, interaction], f"{deployment.name} imports {interaction.name}, over {interaction.language.name}, which Mediations are over")


@rule(severity=ERROR)
def fan_out_silent(system: System) -> Iterator[Violation]:
    """An Interaction carried to a ranged Instance gives nothing back.

    A Connection to an Instance of range more than one reaches every occupant: that is how one
    caller informs many without knowing them. A reply from each would leave the caller with as
    many answers as there are occupants, and the design saying nothing of which it gets.

    To fix it, give the Interaction no output, and have each occupant answer through an
    interface the caller owns, if it must answer at all.
    """
    for connection in connections(system):
        target = connection.to
        if target is None or (target.max is not None and target.max <= 1):
            continue
        for interaction in connection.what:
            if interaction.output is not None:
                yield Violation([connection, interaction], f"{interaction.name} is carried to {target.name}, ranged, and gives something back")


@rule(severity=ERROR)
def construction_acyclic(system: System) -> Iterator[Violation]:
    """The current Configuration can be built: no occupant waits, eventually, on itself.

    Building a Deployment's occupant waits for what it is built on: some occupant running each
    Deployment it imports, and the very occupant of each identity it imports, if that runs a
    Deployment. Calls bind late, once everything is built, and do not count: construction
    performs no Interactions. Build, repeatedly, any occupant whose waits are met; whatever is
    left waits on itself, or on a Deployment no occupant runs.

    To fix it, take one Import out of the loop — often one that only calls, and so need not be a
    Deployment's — or choose a Deployment that does not wait on it.
    """
    running = [o for o in occupants(system) if o.deployment is not None]
    by_deployment: dict[Element, list[Occupant]] = defaultdict(list)
    by_path: dict[tuple[Element, ...], list[Occupant]] = defaultdict(list)
    for o in running:
        by_deployment[o.deployment].append(o)
        by_path[o.path].append(o)

    def waits(o: Occupant) -> list[tuple[str, list[Occupant]]]:
        found: list[tuple[str, list[Occupant]]] = []
        for each in o.deployment.imports:
            if each.steps:
                path = tuple(step.instance for step in each.steps)
                for there in by_path.get(path, []):
                    found.append(("/" + "/".join(str(i.name) for i in path), [there]))
            else:
                for export in each.exports:
                    if export.deployment is not None:
                        found.append((str(export.deployment.name), by_deployment.get(export.deployment, [])))
        return found

    built: set[Occupant] = set()
    pending = list(running)
    progress = True
    while progress:
        progress = False
        for o in list(pending):
            if all(any(p in built for p in options) for _, options in waits(o)):
                built.add(o)
                pending.remove(o)
                progress = True
    for o in pending:
        stuck = [name for name, options in waits(o) if not any(p in built for p in options)]
        where = "/" + "/".join(str(i.name) for i in o.path) if o.path else "the root"
        yield Violation(o.deployment, f"{o.deployment.name}, at {where}, cannot be built: it waits for {', '.join(stuck)}")


@rule(severity=WARNING)
def apis_placed(system: System) -> Iterator[Violation]:
    """A Deployment places every API its box exports: an extension point an interface declares is
    there in every implementation.

    A box that exports a child as an API says that whoever implements the box offers it, and that
    plug-ins can attach to it. A Deployment that places none of it leaves them nothing to attach
    to in that implementation. A Deployment with nothing placed has its insides redacted, and is
    not judged.

    To fix it, place an Instance of the API in the Deployment.
    """
    for deployment in in_use(system):
        box = deployment.component
        if box is None or not deployment.instances:
            continue
        placed = {instance.of for instance in deployment.instances}
        for export in box.exports:
            api = export.component
            if api is not None and api not in placed:
                yield Violation([deployment, api], f"{deployment.name} of {box.name} places no {api.name}, an API its box exports")


def _mediums(system: System, names: Sequence[str]) -> set[Element]:
    return {system.medium(name) for name in names}


def mediation_primitives(*mediums: str, severity: str = ERROR) -> Rule:
    """A rule: every Connection is mediated down to a primitive — its last Mediation is over one of `mediums`, by name."""
    if not mediums:
        raise ValueError("mediation_primitives needs the Mediums a script accepts as primitive, by name")

    def mediation_primitives(system: System) -> Iterator[Violation]:
        """Every Connection is mediated down to a primitive: a Medium the script accepts as trivial.

        Below a primitive, how a Connection passes needs no saying. A Connection with no
        Mediation, or whose stack stops above a primitive, leaves part of its how unsaid.

        To fix it, mediate the Connection, down to one of the primitive Mediums.
        """
        primitive = _mediums(system, mediums)
        for connection in connections(system):
            stack = connection.mediations
            if not stack or stack[-1].how not in primitive:
                yield Violation(connection, f"{connection.id} is not mediated down to a primitive ({', '.join(mediums)})")

    return Rule(mediation_primitives, severity)


def mediation_depth(levels: int, severity: str = ERROR) -> Rule:
    """A rule: every Connection has at least `levels` levels of Mediation."""
    def mediation_depth(system: System) -> Iterator[Violation]:
        """Every Connection has at least the required levels of Mediation.

        To fix it, mediate the Connection further down.
        """
        for connection in connections(system):
            if len(connection.mediations) < levels:
                yield Violation(connection, f"{connection.id} has {len(connection.mediations)} level(s) of Mediation, not {levels}")

    return Rule(mediation_depth, severity)


def mediations_realized(*mediums: str, severity: str = ERROR) -> Rule:
    """A rule: every Mediation over one of `mediums`, by name, is realized."""
    if not mediums:
        raise ValueError("mediations_realized needs the Mediums whose Mediations must be realized, by name")

    def mediations_realized(system: System) -> Iterator[Violation]:
        """Every Mediation over one of the given Mediums is realized: it has a way down and a way up.

        To fix it, realize the Mediation, or create its realization.
        """
        required = _mediums(system, mediums)
        for mediation in mediations(system):
            if mediation.how in required and (mediation.down is None or mediation.up is None):
                yield Violation([mediation.connection, mediation], f"a Mediation of {mediation.connection.id} over {mediation.how.name} is not realized")

    return Rule(mediations_realized, severity)



# -- the shape of a level ----------------------------------------------------------------

def spoken(connection: Element) -> Element | None:
    """The Language a Connection is over: its What's."""
    return connection.what[0].language if connection.what else None


def containing(languages: Sequence[Element]) -> Element | None:
    """The one of `languages` whose vocabulary contains all the others, if any."""
    return next((top for top in languages if all(other in vocab(top) for other in languages)), None)


def disjoint(a: Element, b: Element) -> bool:
    """Two Languages with no Language in both vocabularies: neither extends the other, nor do they extend one in common."""
    return not set(vocab(a)) & set(vocab(b))


def _deployments(system: System, names: Sequence[str]) -> Iterator[tuple[Element, Element]]:
    used = set(in_use(system))
    for name in names:
        component = system.component(name)
        for deployment in component.deployments:
            if deployment in used:
                yield component, deployment


def uniform(*components: str, severity: str = ERROR) -> Rule:
    """A rule: every Deployment of each of `components`, by name, is uniform."""
    if not components:
        raise ValueError("uniform needs the Components that must be uniform, by name")

    def uniform(system: System) -> Iterator[Violation]:
        """A uniform level is one domain: one Language its Connections are over contains all the others.

        Its parts talk in one Language, or in Languages that one extends: Combat, and Core and
        Fighting, which Combat extends. Two sibling extensions of one core, Combat and Rendering,
        are two contexts, not one domain: neither contains the other.

        To fix it, make one Language the domain, give each domain a Component of its own, or
        join the domains in a pipeline.
        """
        for component, deployment in _deployments(system, components):
            languages = list(dict.fromkeys(l for c in deployment.connections if (l := spoken(c)) is not None))
            if languages and containing(languages) is None:
                yield Violation([component, deployment], f"{deployment.name} of {component.name} is not uniform: it speaks {_names(languages)}")

    return Rule(uniform, severity)


def pipeline(*components: str, severity: str = ERROR) -> Rule:
    """A rule: every Deployment of each of `components`, by name, is a pipeline."""
    if not components:
        raise ValueError("pipeline needs the Components that must be pipelines, by name")

    def pipeline(system: System) -> Iterator[Violation]:
        """A pipeline is a straight chain of disjoint domains, each joined to the next by a translator that knows only those two.

        Its Instances form one chain: each calls at most one other, and is called by at most
        one, in one direction. Along the chain, the Connections' Languages stay in one domain
        for a while, then change to a disjoint one; the Instance where they change is a
        translator, and knows only the domain it is called in and the one it calls. Every other
        Instance is a stage, and knows only its own domain. The pipeline starts and ends with a
        stage. Connections to the deployed Component itself are not part of the chain.

        A translator changes what the data means, one way. A mediator keeps it, there and back.

        To fix it, straighten the chain, split a translator that knows more than two domains,
        or give a domain that overlaps its neighbour a Language of its own.
        """
        for component, deployment in _deployments(system, components):
            yield from _pipeline(component, deployment)

    return Rule(pipeline, severity)


def _pipeline(component: Element, deployment: Element) -> Iterator[Violation]:
    where = f"{deployment.name} of {component.name}"
    links = [c for c in deployment.connections if c.to is not None]
    after: dict[Element, set[Element]] = {}
    before: dict[Element, set[Element]] = {}
    for link in links:
        after.setdefault(getattr(link, "from"), set()).add(link.to)
        before.setdefault(link.to, set()).add(getattr(link, "from"))
    branching = [i for i in deployment.instances if len(after.get(i, ())) > 1 or len(before.get(i, ())) > 1]
    if branching:
        yield Violation([deployment, *branching], f"{where} is not a straight chain: {_names(branching)} branch")
        return
    starts = [i for i in deployment.instances if i not in before]
    chain: list[Element] = []
    current = starts[0] if len(starts) == 1 else None
    while current is not None and current not in chain:
        chain.append(current)
        current = next(iter(after.get(current, ())), None)
    if len(chain) != len(deployment.instances):
        yield Violation(deployment, f"{where} is not a straight chain: its Instances are not one path")
        return

    def over(a: Element, b: Element) -> list[Element]:
        return list(dict.fromkeys(l for c in links if getattr(c, "from") is a and c.to is b and (l := spoken(c)) is not None))

    def known(instance: Element) -> set[Element]:
        return {language for used in instance.of.uses for language in vocab(used)}

    # The domain each Instance is in, read along the chain; a translator is in two.
    hops = [over(a, b) for a, b in zip(chain, chain[1:])]
    for (a, b), languages in zip(zip(chain, chain[1:]), hops):
        if languages and containing(languages) is None:
            yield Violation([a, b], f"in {where}, {a.name} calls {b.name} over {_names(languages)}, more than one domain")
    domains = [containing(languages) for languages in hops]
    for position, instance in enumerate(chain):
        called = domains[position - 1] if position > 0 else None
        calls = domains[position] if position < len(domains) else None
        sides = [d for d in (called, calls) if d is not None]
        if called is not None and calls is not None and not (called in vocab(calls) or calls in vocab(called)):
            if not disjoint(called, calls):
                yield Violation(instance, f"in {where}, {instance.name} joins {called.name} and {calls.name}, which overlap")
                continue
        else:
            top = containing(sides)
            sides = [top] if top is not None else sides
        allowed = {language for side in sides for language in vocab(side)}
        extra = sorted((l for l in known(instance) if l not in allowed), key=lambda l: str(l.name))
        if sides and extra:
            role = "translates" if len(sides) == 2 else "is a stage of"
            between = " and ".join(str(side.name) for side in sides)
            yield Violation(instance, f"in {where}, {instance.name} {role} {between}, and knows {_names(extra)} too")


standard_rules: tuple[Rule, ...] = (
    opacity, mediation_separate, medium_blind, mediators_minimal, projection_acyclic, generic_level,
    imports_acyclic, interactions_abstract, fan_out_silent, construction_acyclic, apis_placed,
)

#: Every standard rule that needs no arguments, at its default severity.
standard = Profile(*standard_rules)
