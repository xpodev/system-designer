"""systemathic.core: the Systemathic Languages in Python (`Systems / Python`).

A System is a model of the core Languages: Elements, each an instance of one Entity, linked
through named ends. The vocabulary is generated from schema/ (`_schema.py`); nothing here
knows any particular Entity except where Python's natural forms differ from the model's:

- navigating an end whose range is at most one gives an Element or None, otherwise a list;
- an Element has the ends of every Entity its Entity extends: an Interaction is a Function;
- a Name is its text and a Bound its number;
- a Function's `parameters`, a Connection's `mediations` and an identity's `steps` are lists,
  in the order of their previous/next and above/below chains.

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

from ._schema import AXIOMS, ENTITIES, EXTENDS, RELATIONSHIPS

__all__ = ["Element", "System", "Model", "load", "read", "is_a", "ENTITIES", "AXIOMS"]

_VALUES = {"Name", "Bound"}


def _ancestry(entity: str) -> list[str]:
    found, pending = [], [entity]
    while pending:
        current = pending.pop(0)
        if current not in found:
            found.append(current)
            pending.extend(EXTENDS.get(current, []))
    return found


def is_a(kind: str, entity: str) -> bool:
    """An instance of `kind` is an instance of `entity`: it is that Entity, or extends it."""
    return entity in _ancestry(kind)


class _Step:
    __slots__ = ("relationship", "far", "name", "entity", "min", "max")

    def __init__(self, relationship: str, far: int, end: tuple[str, str, int, int | None]):
        self.relationship = relationship
        self.far = far
        self.name, self.entity, self.min, self.max = end


def _steps() -> dict[str, dict[str, _Step | None]]:
    """Entity → end name → where it leads, inherited ends included; None where a name is ambiguous."""
    own: dict[str, dict[str, _Step | None]] = {}
    for relationship, a, b in RELATIONSHIPS:
        for near, far, index in ((a, b, 1), (b, a, 0)):
            if far[0] is None:
                continue
            ends = own.setdefault(near[1], {})
            ends[far[0]] = None if far[0] in ends else _Step(relationship, index, far)
    table: dict[str, dict[str, _Step | None]] = {}
    for entity in ENTITIES:
        merged: dict[str, _Step | None] = {}
        for each in _ancestry(entity):
            for name, step in own.get(each, {}).items():
                merged[name] = None if name in merged and merged[name] is not step else step
        table[entity] = merged
    return table


_STEPS = _steps()

#: Ends whose members are ordered by a chain: the end, and the ends to the previous and next member.
_CHAINS = {"parameters": ("previous", "next"), "mediations": ("above", "below"), "steps": ("previous", "next")}


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

    def transformation(self, name: str) -> Element:
        return _one(self.all("Transformation"), name, "Transformation")

    def medium(self, name: str) -> Element:
        return _one(self.all("Medium"), name, "Medium")

    def deployment(self, name: str) -> Element:
        return _one(self.all("Deployment"), name, "Deployment")

    def element(self, id: str) -> Element:
        return self.model.elements[id]

    def all(self, entity: str) -> list[Element]:
        """Every Element of an Entity, or of an Entity extending it, in the order they were read."""
        return [element for element in self.model.elements.values() if is_a(element.kind, entity)]


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
        self.system: System | None = None
        self._links: dict[str, tuple[dict[str, list[str]], dict[str, list[str]]]] = {}

    def add(self, entity: str, id: str, value: Any = None) -> Element:
        if entity not in ENTITIES:
            raise ValueError(f"unknown Entity {entity}")
        element = (System if entity == "System" else Element)(self, id, entity, value)
        self.elements[id] = element
        if isinstance(element, System) and self.system is None:
            self.system = element
        return element

    def step(self, element: Element, end: str) -> _Step:
        step = _STEPS.get(element.kind, {}).get(end)
        if step is None:
            raise AttributeError(f"{element.kind} has no end {end!r}")
        return step

    def connect(self, source: Element, end: str, target: Element) -> None:
        step = self.step(source, end)
        forward, backward = self._links.setdefault(step.relationship, ({}, {}))
        a, b = (source.id, target.id) if step.far == 1 else (target.id, source.id)
        if b not in forward.setdefault(a, []):
            forward[a].append(b)
            backward.setdefault(b, []).append(a)

    def ids(self, element: Element, end: str) -> list[str]:
        step = self.step(element, end)
        forward, backward = self._links.get(step.relationship, ({}, {}))
        return list((forward if step.far == 1 else backward).get(element.id, []))

    def navigate(self, element: Element, end: str) -> Any:
        step = self.step(element, end)
        found = [self.elements[id] for id in self.ids(element, end)]
        if end in _CHAINS:
            found = _ordered(found, *_CHAINS[end])
        if step.entity in _VALUES:
            values = [found_element.value for found_element in found]
            return (values[0] if values else None) if step.max == 1 else values
        return (found[0] if found else None) if step.max == 1 else found


def _ordered(members: list[Element], previous: str, next_: str) -> list[Element]:
    """Members in chain order: from each that nothing among them precedes, along `next_`;
    any left over (a broken chain) after, in the order they were read."""
    among = set(members)
    ordered: list[Element] = []
    for head in members:
        if getattr(head, previous) in among:
            continue
        current: Element | None = head
        while current is not None and current in among and current not in ordered:
            ordered.append(current)
            current = getattr(current, next_)
    return ordered + [m for m in members if m not in ordered]


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

    def bounds(self, element: Element, json: dict) -> None:
        self.value(element, "min", "Bound", json["min"])
        if json["max"] != "N":
            self.value(element, "max", "Bound", json["max"])

    def refer(self, element: Element, end: str, id: str) -> None:
        self.pending.append((element, end, id))

    def chain(self, end: str, members: list[Element]) -> None:
        _, next_ = _CHAINS[end]
        for before, after in zip(members, members[1:]):
            self.model.connect(before, next_, after)

    def finish(self) -> None:
        for element, end, id in self.pending:
            target = self.model.elements.get(id)
            step = _STEPS[element.kind].get(end)
            if target is None or step is None or not is_a(target.kind, step.entity):
                self.problems.append(f"{element.id}.{end}: cannot refer to {id!r}")
                continue
            self.model.connect(element, end, target)


FORMAT = "systemathic/4"


def read(file: dict) -> System:
    """A System from a parsed System file."""
    if file.get("format") != FORMAT:
        raise ValueError(f'not a System file of this model: expected "format": "{FORMAT}"')
    reader = _Reader()
    design = file["design"]
    system = reader.named("System", design, None, None)
    assert isinstance(system, System)
    root = _read_component(reader, design["root"], None)
    if root is not None:
        reader.model.connect(system, "root", root)
    for package in design["packages"]:
        element = _read_component(reader, package, None)
        if element is not None:
            reader.model.connect(system, "packages", element)
    reader.finish()
    system.model.problems = reader.problems  # type: ignore[attr-defined]
    system.model.attachments = file.get("attachments", [])  # type: ignore[attr-defined]
    return system


def load(path: str | Path) -> System:
    """A System from a System file on disk."""
    return read(json.loads(Path(path).read_text(encoding="utf-8")))


_EXPORTED = ("component", "interaction", "transformation", "language", "medium", "deployment")


def _read_component(reader: _Reader, json: dict, parent: Element | None) -> Element | None:
    component = reader.named("Component", json, parent, "components" if parent is not None else None)
    if component is None:
        return None
    for id in json["uses"]:
        reader.refer(component, "uses", id)
    for export in json["exports"]:
        element = reader.create("Export", export["id"])
        if element is not None:
            reader.model.connect(component, "exports", element)
            for end in _EXPORTED:
                if end in export:
                    reader.refer(element, end, export[end])
    _read_imports(reader, component, json["imports"])
    for language in json["languages"]:
        _read_language(reader, component, language)
    for interaction in json["interactions"]:
        element = _read_function(reader, "Interaction", component, "interactions", interaction)
        if element is not None:
            reader.refer(element, "language", interaction["language"])
    for transformation in json["transformations"]:
        _read_function(reader, "Transformation", component, "transformations", transformation)
    for medium in json["mediums"]:
        element = reader.named("Medium", medium, component, "mediums")
        if element is not None:
            reader.refer(element, "language", medium["language"])
            reader.refer(element, "call", medium["call"])
    for deployment in json["deployments"]:
        _read_deployment(reader, component, deployment)
    for child in json["components"]:
        _read_component(reader, child, component)
    return component


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
            reader.bounds(end_element, end)
    for formula in json["formulas"]:
        element = reader.create("Formula", formula["id"], formula["text"])
        if element is not None:
            reader.model.connect(language, "formulas", element)


def _read_function(reader: _Reader, entity: str, component: Element, end: str, json: dict) -> Element | None:
    function = reader.named(entity, json, component, end)
    if function is None:
        return None
    parameters = []
    for parameter in json["parameters"]:
        element = reader.named("Parameter", parameter, function, "parameters")
        if element is not None:
            reader.refer(element, "type", parameter["type"])
            parameters.append(element)
    reader.chain("parameters", parameters)
    if json["output"] is not None:
        reader.refer(function, "output", json["output"])
    return function


def _read_imports(reader: _Reader, owner: Element, imports: list[dict]) -> None:
    """The Imports of a Component or a Deployment: from a Component, or an identity's `path`."""
    for import_ in imports:
        element = reader.create("Import", import_["id"])
        if element is None:
            continue
        reader.model.connect(owner, "imports", element)
        if "path" in import_:
            steps = []
            for index, id in enumerate(import_["path"]):
                step = reader.create("Step", f"{import_['id']}#{index}")
                if step is not None:
                    reader.model.connect(element, "steps", step)
                    reader.refer(step, "instance", id)
                    steps.append(step)
            reader.chain("steps", steps)
            continue
        reader.refer(element, "from", import_["from"])
        for id in import_["exports"]:
            reader.refer(element, "exports", id)


def _read_deployment(reader: _Reader, keeper: Element, json: dict) -> None:
    deployment = reader.named("Deployment", json, keeper, "kept")
    if deployment is None:
        return
    reader.refer(deployment, "component", json.get("of", keeper.id))
    for instance in json["instances"]:
        element = reader.named("Instance", instance, deployment, "instances")
        if element is not None:
            reader.refer(element, "of", instance["of"])
            if instance.get("runs") is not None:
                reader.refer(element, "runs", instance["runs"])
            reader.bounds(element, instance)
    _read_imports(reader, deployment, json.get("imports", []))
    for exposed in json.get("exposes", []):
        element = reader.create("Export", exposed["id"])
        if element is not None:
            reader.model.connect(deployment, "exposes", element)
            reader.refer(element, "instance", exposed["instance"])
    for connection in json["connections"]:
        element = reader.create("Connection", connection["id"])
        if element is None:
            continue
        reader.model.connect(deployment, "connections", element)
        reader.refer(element, "from", connection["from"])
        for end in ("to", "toComponent", "toIdentity"):
            if connection.get(end) is not None:
                reader.refer(element, end, connection[end])
        for id in connection["what"]:
            reader.refer(element, "what", id)
        mediations = []
        for mediation in connection["mediations"]:
            mediation_element = reader.create("Mediation", mediation["id"])
            if mediation_element is None:
                continue
            reader.model.connect(element, "mediations", mediation_element)
            reader.refer(mediation_element, "how", mediation["how"])
            for end in ("down", "up"):
                if mediation[end] is not None:
                    reader.refer(mediation_element, end, mediation[end])
            mediations.append(mediation_element)
        reader.chain("mediations", mediations)
