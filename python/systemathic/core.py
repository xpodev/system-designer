"""systemathic.core: the Systemathic Languages in Python (docs/tool-design.md, `L / Python`).

A System is a model of the core Languages: Elements, each an instance of one Entity, linked
through named ends. The vocabulary is generated from schema/ (`_schema.py`); nothing here
knows any particular Entity except where Python's natural forms differ from the model's:

- navigating an end whose range is at most one gives an Element or None, otherwise a list;
- a Name is its text and a Bound its number;
- an Interaction's `parameters` and a Connection's `mediations` are lists, in the order of
  their first/next chains.

`load` reads a System file (docs/format.md). It is tolerant: a reference to nothing is dropped,
as the tool's own reader does, so a script can run on an ill-formed System.

    from systemathic.core import *
    system = load("examples/game.systemathic.json")
    system.component("Server").interactions
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
    """An instance of an Entity of the Systemathic Languages: an Entity, a Component, a Mediation, …

    Which of them it is, is its `kind`; `entity`, like any other end, is navigated (`end.entity`).
    """

    __slots__ = ("model", "id", "kind", "value")

    def __init__(self, model: Model, id: str, kind: str, value: Any = None):
        self.model = model
        self.id = id
        self.kind = kind
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
        name = self.model.navigate(self, "name") if "name" in _STEPS.get(self.kind, {}) else None
        return f"<{self.kind} {name!r}>" if name else f"<{self.kind} {self.id}>"


class System(Element):
    """The System: what is opened and saved. Lookups by name — anywhere in the System —
    raise if missing or ambiguous."""

    __slots__ = ()

    def component(self, name: str) -> Element:
        return _one(self.all("Component"), name, "Component")

    def language(self, name: str) -> Element:
        return _one(self.all("Language"), name, "Language")

    def interaction(self, name: str) -> Element:
        return _one(self.all("Interaction"), name, "Interaction")

    def medium(self, name: str) -> Element:
        return _one(self.all("Medium"), name, "Medium")

    def deployment(self, name: str) -> Element:
        return _one(self.all("Deployment"), name, "Deployment")

    def element(self, id: str) -> Element:
        return self.model.elements[id]

    def all(self, entity: str) -> list[Element]:
        """Every Element of an Entity, in the order they were read."""
        return [element for element in self.model.elements.values() if element.kind == entity]


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
        step = _STEPS.get(source.kind, {}).get(end)
        if step is None:
            raise AttributeError(f"{source.kind} has no end {end!r}")
        forward, backward = self._links.setdefault(step.relationship, ({}, {}))
        a, b = (source.id, target.id) if step.far == 1 else (target.id, source.id)
        if b not in forward.setdefault(a, []):
            forward[a].append(b)
            backward.setdefault(b, []).append(a)

    def ids(self, element: Element, end: str) -> list[str]:
        step = _STEPS.get(element.kind, {}).get(end)
        if step is None:
            raise AttributeError(f"{element.kind} has no end {end!r}")
        forward, backward = self._links.get(step.relationship, ({}, {}))
        return list((forward if step.far == 1 else backward).get(element.id, []))

    def navigate(self, element: Element, end: str) -> Any:
        step = _STEPS[element.kind].get(end) if element.kind in _STEPS else None
        if step is None:
            raise AttributeError(f"{element.kind} has no end {end!r}")
        if (element.kind, end) in _CHAINS:
            return _chain(self, element)
        found = [self.elements[id] for id in self.ids(element, end)]
        if step.entity in _VALUES:
            values = [found_element.value for found_element in found]
            return (values[0] if values else None) if step.max == 1 else values
        return (found[0] if found else None) if step.max == 1 else found


_CHAINS = {("Interaction", "parameters"), ("Connection", "mediations")}


def _chain(model: Model, owner: Element) -> list[Element]:
    ordered: list[Element] = []
    current = model.navigate(owner, "first")
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
        if json["name"] is not None:  # an unnamed end has none
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
            step = _STEPS[element.kind].get(end)
            if target is None or step is None or target.kind != step.entity:
                self.problems.append(f"{element.id}.{end}: cannot refer to {id!r}")
                continue
            self.model.connect(element, end, target)


FORMAT = "systemathic/2"


def read(file: dict) -> System:
    """A System from a parsed System file."""
    if file.get("format") != FORMAT:
        raise ValueError(f'not a System file of this model: expected "format": "{FORMAT}"')
    reader = _Reader()
    design = file["design"]
    system = reader.named("System", design, None, None)
    assert isinstance(system, System)
    for component in design["components"]:
        _read_component(reader, component, system, "components")
    reader.refer(system, "root", design["root"])
    for configuration in design.get("configurations", []):
        element = reader.named("Configuration", configuration, system, "configurations")
        if element is not None:
            root = _read_choice(reader, configuration["root"], f"{element.id}#root")
            if root is not None:
                reader.model.connect(element, "root", root)
    reader.finish()
    system.model.problems = reader.problems  # type: ignore[attr-defined]
    system.model.attachments = file.get("attachments", [])  # type: ignore[attr-defined]
    return system


def load(path: str | Path) -> System:
    """A System from a System file on disk."""
    return read(json.loads(Path(path).read_text(encoding="utf-8")))


_IMPORTS = {"components": "importedComponents", "transformations": "importedTransformations", "interactions": "importedInteractions", "mediums": "importedMediums"}


def _read_component(reader: _Reader, json: dict, owner: Element, end: str) -> None:
    component = reader.named("Component", json, owner, end)
    if component is None:
        return
    for id in json["uses"]:
        reader.refer(component, "uses", id)
    for key, imported in _IMPORTS.items():
        for id in json["imports"].get(key, []):
            reader.refer(component, imported, id)
    for language in json["languages"]:
        _read_language(reader, component, language)
    for transformation in json["transformations"]:
        _read_transformation(reader, component, transformation)
    for interaction in json.get("interactions", []):
        _read_interaction(reader, component, interaction)
    for medium in json.get("mediums", []):
        element = reader.named("Medium", medium, component, "mediums")
        if element is not None:
            reader.refer(element, "language", medium["language"])
            reader.refer(element, "call", medium["call"])
    for deployment in json.get("deployments", []):
        _read_deployment(reader, component, deployment)
    for child in json["components"]:
        _read_component(reader, child, component, "components")


def _read_language(reader: _Reader, component: Element, json: dict) -> None:
    language = reader.named("Language", json, component, "languages")
    if language is None:
        return
    for id in json["extends"]:
        reader.refer(language, "extends", id)
    for entity in json["entities"]:
        element = reader.named("Entity", entity, language, "entities")
        if element is not None:
            for id in entity["extends"]:
                reader.refer(element, "extends", id)
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


def _read_chain(reader: _Reader, owner: Element, members: list[Element]) -> None:
    for index, member in enumerate(members):
        if index == 0:
            reader.model.connect(owner, "first", member)
        else:
            reader.model.connect(members[index - 1], "next", member)


def _read_interaction(reader: _Reader, component: Element, json: dict) -> None:
    element = reader.named("Interaction", json, component, "interactions")
    if element is None:
        return
    reader.refer(element, "language", json["language"])
    parameters = []
    for parameter in json["parameters"]:
        parameter_element = reader.named("Parameter", parameter, element, "parameters")
        if parameter_element is not None:
            reader.refer(parameter_element, "type", parameter["type"])
            parameters.append(parameter_element)
    _read_chain(reader, element, parameters)
    reader.refer(element, "output", json["output"])
    if json.get("primary") is not None:
        reader.refer(element, "primary", json["primary"])
    for id in json.get("compares", []):
        reader.refer(element, "comparedEntities", id)


def _read_transformation(reader: _Reader, component: Element, json: dict) -> None:
    transformation = reader.named("Transformation", json, component, "transformations")
    if transformation is None:
        return
    reader.refer(transformation, "source", json["source"])
    reader.refer(transformation, "target", json["target"])
    for id in json["context"]:
        reader.refer(transformation, "context", id)
    for key, entity, prefix in (("entityMappings", "EntityMapping", "em"), ("relationshipMappings", "RelationshipMapping", "rm")):
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
        for item in ("entity", "relationship"):
            if item in deferral:
                reader.refer(element, item, deferral[item])


def _read_deployment(reader: _Reader, component: Element, json: dict) -> None:
    deployment = reader.named("Deployment", json, component, "deployments")
    if deployment is None:
        return
    for instance in json["instances"]:
        element = reader.named("Instance", instance, deployment, "instances")
        if element is not None:
            reader.refer(element, "of", instance["of"])
    for connection in json["connections"]:
        element = reader.create("Connection", connection["id"])
        if element is None:
            continue
        reader.model.connect(deployment, "connections", element)
        reader.refer(element, "from", connection["from"])
        for end in ("toInstance", "toComponent"):
            if connection[end] is not None:
                reader.refer(element, end, connection[end])
        for id in connection["what"]:
            reader.refer(element, "what", id)
        mediations = []
        for index, mediation in enumerate(connection.get("mediations", [])):
            mediation_element = reader.create("Mediation", f"{element.id}#m{index}")
            if mediation_element is None:
                continue
            reader.model.connect(element, "mediations", mediation_element)
            reader.refer(mediation_element, "how", mediation["how"])
            for end in ("down", "up"):
                if mediation[end] is not None:
                    reader.refer(mediation_element, end, mediation[end])
            mediations.append(mediation_element)
        _read_chain(reader, element, mediations)


def _read_choice(reader: _Reader, json: dict, id: str) -> Element | None:
    choice = reader.create("Choice", id)
    if choice is None:
        return None
    if json["instance"] is not None:
        reader.refer(choice, "instance", json["instance"])
    reader.refer(choice, "deployment", json["deployment"])
    for index, child in enumerate(json["choices"]):
        element = _read_choice(reader, child, f"{id}.{index}")
        if element is not None:
            reader.model.connect(choice, "choices", element)
    return choice
