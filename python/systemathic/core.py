"""systemathic.core: the Systemathic Languages in Python (docs/tool-design.md, `L / Python`).

A System is a model of the core Languages: Elements, each an instance of one Entity, linked
through named ends. The vocabulary is generated from schema/ (`_schema.py`); nothing here
knows any particular Entity except where Python's natural forms differ from the model's:

- navigating an end whose range is at most one gives an Element or None, otherwise a list;
- a Name is its text and a Bound its number;
- an Interaction's `parameters` are a list, in the order of its first/next chain.

`load` reads a System file (docs/format.md). It is tolerant: a reference to nothing is dropped,
as the tool's own reader does, so a script can run on an ill-formed System.

    from systemathic.core import *
    system = load("examples/game.systemathic.json")
    system.domain("Combat").languages
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable

from ._schema import AXIOMS, ENTITIES, RELATIONSHIPS

__all__ = ["Element", "System", "Model", "load", "read", "ENTITIES", "AXIOMS"]

_VALUES = {"Name", "Bound"}


class _Step:
    __slots__ = ("relationship", "far", "name", "entity", "min", "max")

    def __init__(self, relationship: str, far: int, end: tuple[str, str, int, int | None]):
        self.relationship = relationship
        self.far = far
        self.name, self.entity, self.min, self.max = end


def _steps() -> dict[str, dict[str, _Step | None]]:
    """Entity → end name → where it leads; None where a name is ambiguous."""
    table: dict[str, dict[str, _Step | None]] = {}
    for relationship, a, b in RELATIONSHIPS:
        for near, far, index in ((a, b, 1), (b, a, 0)):
            ends = table.setdefault(near[1], {})
            ends[far[0]] = None if far[0] in ends else _Step(relationship, index, far)
    return table


_STEPS = _steps()


class Element:
    """An instance of an Entity of the Systemathic Languages: an Entity, a Domain, a Mediation, …"""

    __slots__ = ("model", "id", "entity", "value")

    def __init__(self, model: Model, id: str, entity: str, value: Any = None):
        self.model = model
        self.id = id
        self.entity = entity
        self.value = value

    def __getattr__(self, end: str) -> Any:
        if end.startswith("__"):
            raise AttributeError(end)
        return self.model.navigate(self, end)

    @property
    def text(self) -> Any:
        """A Formula's text."""
        return self.value

    def __repr__(self) -> str:
        name = self.model.navigate(self, "name") if "name" in _STEPS.get(self.entity, {}) else None
        return f"<{self.entity} {name!r}>" if name else f"<{self.entity} {self.id}>"


class System(Element):
    """The System: what is opened and saved. Lookups by name raise if missing or ambiguous."""

    __slots__ = ()

    def language(self, name: str) -> Element:
        return _one(self.languages, name, "Language")

    def domain(self, name: str) -> Element:
        return _one(self.domains, name, "Domain")

    def element(self, id: str) -> Element:
        return self.model.elements[id]

    def all(self, entity: str) -> list[Element]:
        """Every Element of an Entity, in the order they were read."""
        return [element for element in self.model.elements.values() if element.entity == entity]


def _one(elements: Iterable[Element], name: str, kind: str) -> Element:
    found = [element for element in elements if element.name == name]
    if not found:
        raise LookupError(f"no {kind} named {name!r}")
    if len(found) > 1:
        raise LookupError(f"{len(found)} {kind}s are named {name!r}")
    return found[0]


class Model:
    """Elements and the links between them, by Relationship id."""

    def __init__(self) -> None:
        self.elements: dict[str, Element] = {}
        self._links: dict[str, tuple[dict[str, list[str]], dict[str, list[str]]]] = {}

    def add(self, entity: str, id: str, value: Any = None) -> Element:
        if entity not in ENTITIES:
            raise ValueError(f"unknown Entity {entity}")
        element = (System if entity == "System" else Element)(self, id, entity, value)
        self.elements[id] = element
        return element

    def connect(self, source: Element, end: str, target: Element) -> None:
        step = _STEPS.get(source.entity, {}).get(end)
        if step is None:
            raise AttributeError(f"{source.entity} has no end {end!r}")
        forward, backward = self._links.setdefault(step.relationship, ({}, {}))
        a, b = (source.id, target.id) if step.far == 1 else (target.id, source.id)
        if b not in forward.setdefault(a, []):
            forward[a].append(b)
            backward.setdefault(b, []).append(a)

    def ids(self, element: Element, end: str) -> list[str]:
        step = _STEPS.get(element.entity, {}).get(end)
        if step is None:
            raise AttributeError(f"{element.entity} has no end {end!r}")
        forward, backward = self._links.get(step.relationship, ({}, {}))
        return list((forward if step.far == 1 else backward).get(element.id, []))

    def navigate(self, element: Element, end: str) -> Any:
        step = _STEPS[element.entity].get(end) if element.entity in _STEPS else None
        if step is None:
            raise AttributeError(f"{element.entity} has no end {end!r}")
        if element.entity == "Interaction" and end == "parameters":
            return _chain(self, element)
        found = [self.elements[id] for id in self.ids(element, end)]
        if step.entity in _VALUES:
            values = [found_element.value for found_element in found]
            return (values[0] if values else None) if step.max == 1 else values
        return (found[0] if found else None) if step.max == 1 else found


def _chain(model: Model, interaction: Element) -> list[Element]:
    ordered: list[Element] = []
    current = model.navigate(interaction, "first")
    while current is not None and current not in ordered:
        ordered.append(current)
        current = model.navigate(current, "next")
    return ordered


# -- reading a System file ----------------------------------------------------------------

class _Reader:
    def __init__(self) -> None:
        self.model = Model()
        self.pending: list[tuple[Element, str, str]] = []
        self.problems: list[str] = []

    def create(self, entity: str, id: str, value: Any = None) -> Element | None:
        if id in self.model.elements:
            self.problems.append(f"duplicate id {id!r}")
            return None
        return self.model.add(entity, id, value)

    def named(self, entity: str, json: dict, owner: Element | None, end: str | None) -> Element | None:
        element = self.create(entity, json["id"])
        if element is None:
            return None
        self.value(element, "name", "Name", json["name"])
        if owner is not None and end is not None:
            self.model.connect(owner, end, element)
        return element

    def value(self, element: Element, end: str, entity: str, value: Any) -> None:
        id = f"{entity.lower()}:{value}"
        target = self.model.elements.get(id) or self.model.add(entity, id, value)
        self.model.connect(element, end, target)

    def refer(self, element: Element, end: str, id: str) -> None:
        self.pending.append((element, end, id))

    def finish(self) -> None:
        for element, end, id in self.pending:
            target = self.model.elements.get(id)
            step = _STEPS[element.entity].get(end)
            if target is None or step is None or target.entity != step.entity:
                self.problems.append(f"{element.id}.{end}: cannot refer to {id!r}")
                continue
            self.model.connect(element, end, target)


def read(file: dict) -> System:
    """A System from a parsed System file."""
    if file.get("format") != "systemathic/1":
        raise ValueError('not a System file: expected "format": "systemathic/1"')
    reader = _Reader()
    design = file["design"]
    system = reader.named("System", design, None, None)
    assert isinstance(system, System)
    for language in design["languages"]:
        _read_language(reader, system, language)
    for domain in design["domains"]:
        element = reader.named("Domain", domain, system, "domains")
        if element is None:
            continue
        for id in domain["languages"]:
            reader.refer(element, "languages", id)
        for id in domain["references"]:
            reader.refer(element, "references", id)
        for transformation in domain["transformations"]:
            _read_transformation(reader, element, transformation)
    for mediation in design["mediations"]:
        element = reader.create("Mediation", mediation["id"])
        if element is None:
            continue
        reader.model.connect(system, "mediations", element)
        for role in ("what", "how", "mediator"):
            reader.refer(element, role, mediation[role])
    reader.finish()
    system.model.problems = reader.problems  # type: ignore[attr-defined]
    system.model.attachments = file.get("attachments", [])  # type: ignore[attr-defined]
    return system


def load(path: str | Path) -> System:
    """A System from a System file on disk."""
    return read(json.loads(Path(path).read_text(encoding="utf-8")))


def _read_language(reader: _Reader, system: System, json: dict) -> None:
    language = reader.named("Language", json, system, "languages")
    if language is None:
        return
    for entity in json["entities"]:
        reader.named("Entity", entity, language, "entities")
    for relationship in json["relationships"]:
        element = reader.create("Relationship", relationship["id"])
        if element is None:
            continue
        reader.model.connect(language, "relationships", element)
        for end in relationship["ends"]:
            end_element = reader.named("End", end, element, "ends")
            if end_element is None:
                continue
            reader.refer(end_element, "entity", end["entity"])
            reader.value(end_element, "min", "Bound", end["min"])
            if end["max"] != "N":
                reader.value(end_element, "max", "Bound", end["max"])
    for formula in json["formulas"]:
        element = reader.create("Formula", formula["id"], formula["text"])
        if element is None:
            continue
        reader.model.connect(language, "formulas", element)
        if "constrains" in formula:
            reader.refer(element, "constrains", formula["constrains"])
    for interaction in json.get("interactions", []):
        element = reader.named("Interaction", interaction, language, "interactions")
        if element is None:
            continue
        previous = None
        for parameter in interaction["parameters"]:
            parameter_element = reader.named("Parameter", parameter, element, "parameters")
            if parameter_element is None:
                continue
            reader.refer(parameter_element, "type", parameter["type"])
            if previous is None:
                reader.model.connect(element, "first", parameter_element)
            else:
                reader.model.connect(previous, "next", parameter_element)
            previous = parameter_element
        reader.refer(element, "output", interaction["output"])
        if interaction.get("primary") is not None:
            reader.refer(element, "primary", interaction["primary"])
        for id in interaction.get("compares", []):
            reader.refer(element, "comparedEntities", id)


def _read_transformation(reader: _Reader, domain: Element, json: dict) -> None:
    transformation = reader.named("Transformation", json, domain, "transformations")
    if transformation is None:
        return
    reader.refer(transformation, "source", json["source"])
    reader.refer(transformation, "target", json["target"])
    if json["reverse"] is not None:
        reverse = reader.create("Reverse", f"{transformation.id}#reverse")
        if reverse is not None:
            reader.model.connect(transformation, "reverse", reverse)
            for id in json["reverse"]["context"]:
                reader.refer(reverse, "context", id)
    for key, entity, prefix in (
        ("entityMappings", "EntityMapping", "em"),
        ("relationshipMappings", "RelationshipMapping", "rm"),
        ("interactionMappings", "InteractionMapping", "im"),
    ):
        for index, mapping in enumerate(json.get(key, [])):
            element = reader.create(entity, f"{transformation.id}#{prefix}{index}")
            if element is None:
                continue
            reader.model.connect(transformation, key, element)
            reader.refer(element, "source", mapping["source"])
            for id in mapping["targets"]:
                reader.refer(element, "targets", id)
    for index, deferral in enumerate(json.get("deferred", [])):
        element = reader.create("Deferred", f"{transformation.id}#d{index}")
        if element is None:
            continue
        reader.model.connect(transformation, "deferred", element)
        for item in ("entity", "relationship", "interaction"):
            if item in deferral:
                reader.refer(element, item, deferral[item])
