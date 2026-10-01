"""systemathic.std: the standard concepts and rules (docs/foundation.md, Part II and Part IV).

Everything here is defined in terms of the core. A **rule** is a function from a System to
the Violations it finds; a **profile** is the set of rules a System is verified against.

    from systemathic.core import *
    from systemathic.std import *

    @rule(severity=ERROR)
    def core_is_pure(system: System):
        if not pure(system.domain("Core")):
            yield Violation(system.domain("Core"), "Core must be defined purely in its own terms")

    profile = Profile(core_is_pure, *standard_rules)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Iterable, Iterator, Sequence

from .core import Element, System

__all__ = [
    "ERROR", "WARNING", "Rule", "Profile", "Violation", "rule",
    "langs", "standalone", "pure", "is_projection", "is_mediation", "witnesses",
    "abstract", "abstract_language", "top_domains", "mediators", "hows", "items",
    "opacity", "mediation_acyclic", "projection_acyclic", "domain_refs_acyclic", "generic_level",
    "pure_domain_transformation", "wide_mediator", "top_domains_abstract", "completeness",
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
    def about(self) -> str:
        return " ".join((self.function.__doc__ or "").split())

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


# -- Domains ------------------------------------------------------------------------------

def langs(domain: Element) -> set[Element]:
    """`langs*(D)`: a Domain's own Languages and, transitively, those of the Domains it references."""
    found: set[Element] = set()
    seen: set[Element] = set()
    pending = [domain]
    while pending:
        current = pending.pop()
        if current in seen:
            continue
        seen.add(current)
        found.update(current.languages)
        pending.extend(current.references)
    return found


def standalone(domain: Element) -> bool:
    return not domain.references


def pure(domain: Element) -> bool:
    """A Domain defined entirely in terms of one Language."""
    return len(langs(domain)) == 1


# -- Transformations and Mediations ---------------------------------------------------------

def is_projection(transformation: Element) -> bool:
    return transformation.reverse is None


def is_mediation(transformation: Element) -> bool:
    return transformation.reverse is not None


def witnesses(mediation: Element) -> list[Element]:
    """The mediator's reversible Transformations from the what's Languages to the how's."""
    what, how, mediator = mediation.what, mediation.how, mediation.mediator
    if what is None or how is None or mediator is None:
        return []
    whats, hows = langs(what), langs(how)
    return [t for t in mediator.transformations if is_mediation(t) and t.source in whats and t.target in hows]


def hows(system: System) -> set[Element]:
    """The Languages that are the "how" side of some Mediation's witness."""
    return {t.target for m in system.mediations for t in witnesses(m) if t.target is not None}


def abstract_language(language: Element) -> bool:
    """A Language that is never the "how" side of a Mediation."""
    return language not in hows(language.system)


def abstract(element: Element) -> bool:
    """A Language that is never the "how" side of a Mediation, or a Domain all of whose Languages are."""
    if element.entity == "Language":
        return abstract_language(element)
    return not (langs(element) & hows(element.system))


def mediators(system: System) -> set[Element]:
    return {m.mediator for m in system.mediations if m.mediator is not None}


def top_domains(system: System) -> list[Element]:
    """The Domains that are neither the how nor the mediator of any Mediation."""
    below = {m.how for m in system.mediations} | mediators(system)
    return [d for d in system.domains if d not in below]


def items(language: Element) -> list[Element]:
    """A Language's Entities, Relationships and Interactions."""
    return [*language.entities, *language.relationships, *language.interactions]


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
    """Every Mediation is opaque: the what does not know how it is carried out, and the how does not know what it carries."""
    for mediation in system.mediations:
        for witness in witnesses(mediation):
            if witness.target in langs(mediation.what):
                yield Violation([mediation, mediation.what], f"{mediation.what.name} knows {witness.target.name}, the Language it is carried out in")
            if witness.source in langs(mediation.how):
                yield Violation([mediation, mediation.how], f"{mediation.how.name} knows {witness.source.name}, the Language it carries")


@rule(severity=ERROR)
def mediation_acyclic(system: System) -> Iterator[Violation]:
    """No Domain is carried out, eventually, over itself."""
    for cycle in _cycles(system.domains, lambda d: [m.how for m in d.asWhat if m.how is not None]):
        yield Violation(cycle, f"carried out over themselves: {_names(cycle)}")


@rule(severity=ERROR)
def projection_acyclic(system: System) -> Iterator[Violation]:
    """No Language is projected, eventually, into itself."""
    for cycle in _cycles(system.languages, lambda l: [t.target for t in l.outgoing if is_projection(t) and t.target is not None]):
        yield Violation(cycle, f"projected into themselves: {_names(cycle)}")


@rule(severity=ERROR)
def domain_refs_acyclic(system: System) -> Iterator[Violation]:
    """No Domain references itself, eventually."""
    for cycle in _cycles(system.domains, lambda d: d.references):
        yield Violation(cycle, f"reference themselves: {_names(cycle)}")


@rule(severity=ERROR)
def generic_level(system: System) -> Iterator[Violation]:
    """All arguments of a generic instantiation belong to one Language. A System records no generic instantiations yet, so nothing can violate it."""
    return iter(())


@rule(severity=WARNING)
def pure_domain_transformation(system: System) -> Iterator[Violation]:
    """A pure Domain holds no Transformation."""
    for domain in system.domains:
        if pure(domain) and domain.transformations:
            yield Violation(domain, f"{domain.name} is pure, but holds {len(domain.transformations)} Transformation(s)")


@rule(severity=WARNING)
def wide_mediator(system: System) -> Iterator[Violation]:
    """A mediator references at most two Languages."""
    for mediator in mediators(system):
        if len(langs(mediator)) > 2:
            yield Violation(mediator, f"{mediator.name} is a mediator with {len(langs(mediator))} Languages: {_names(langs(mediator))}")


@rule(severity=ERROR)
def top_domains_abstract(system: System) -> Iterator[Violation]:
    """Every top Domain is abstract."""
    implementation = hows(system)
    for domain in top_domains(system):
        concrete = langs(domain) & implementation
        if concrete:
            yield Violation(domain, f"{domain.name} is a top Domain, but uses implementation Languages: {_names(concrete)}")


@rule(severity=WARNING)
def completeness(system: System) -> Iterator[Violation]:
    """Every item of a mediation's source Language is mapped or deferred."""
    for domain in system.domains:
        for transformation in domain.transformations:
            if not is_mediation(transformation) or transformation.source is None:
                continue
            covered = {m.source for key in ("entityMappings", "relationshipMappings", "interactionMappings") for m in getattr(transformation, key)}
            for deferral in transformation.deferred:
                covered.update(x for x in (deferral.entity, deferral.relationship, deferral.interaction) if x is not None)
            missing = [item for item in items(transformation.source) if item not in covered]
            if missing:
                yield Violation([transformation, *missing], f"{transformation.name} leaves {len(missing)} item(s) of {transformation.source.name} neither mapped nor deferred")


standard_rules: tuple[Rule, ...] = (
    opacity, mediation_acyclic, projection_acyclic, domain_refs_acyclic, generic_level,
    pure_domain_transformation, wide_mediator, top_domains_abstract, completeness,
)

#: Every standard rule, at its default severity.
standard = Profile(*standard_rules)
