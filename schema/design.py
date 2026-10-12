"""Check that schema/*.json is the vocabulary the tool's own design gives the Systemathic Languages.

    python schema/design.py [design file]      (default: docs/system-designer.systemathic.json)

The design (its Component named Systemathic) is where the core Languages are decided; the
schema is how every realization reads them. Both must have the same Languages, each extending
the same Languages, with the same Entities, extending the same Entities, and the same
Relationships: the same ends, by name (or unnamed), Entity and range. Axioms are the schema's
own: the design states only some of them.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from check import declared

ROOT = Path(__file__).resolve().parent.parent


def from_schema() -> dict[str, dict]:
    languages = {}
    for path in sorted((ROOT / "schema").glob("*.json")):
        language = json.loads(path.read_text(encoding="utf-8"))
        names, parents = declared(language)
        relationships = {frozenset((e["name"], e["entity"], e["range"]) for e in r["ends"]) for r in language["relationships"]}
        languages[language["language"]] = {"extends": sorted(language["extends"]), "entities": {n: sorted(parents[n]) for n in names}, "relationships": relationships}
    return languages


def from_design(path: Path) -> dict[str, dict]:
    design = json.loads(path.read_text(encoding="utf-8"))["design"]
    found = []

    def walk(component):
        if component["name"] == "Systemathic":
            found.append(component)
        for child in component["components"]:
            walk(child)

    for component in design["components"]:
        walk(component)
    if len(found) != 1:
        raise LookupError(f"{path} has {len(found)} Components named Systemathic, not one")
    names = {}
    for language in found[0]["languages"]:
        names[language["id"]] = language["name"]
        for entity in language["entities"]:
            names[entity["id"]] = entity["name"]
    languages = {}
    for language in found[0]["languages"]:
        relationships = {
            frozenset((end["name"], names[end["entity"]], f"{end['min']}..{end['max']}") for end in relationship["ends"])
            for relationship in language["relationships"]
        }
        languages[language["name"]] = {
            "extends": sorted(names[x] for x in language["extends"]),
            "entities": {e["name"]: sorted(names[x] for x in e["extends"]) for e in language["entities"]},
            "relationships": relationships,
        }
    return languages


def show(relationship: frozenset) -> str:
    return " <-> ".join(f"{name or '·'}:{entity} {range}" for name, entity, range in sorted(relationship, key=str))


def differences(schema: dict[str, dict], design: dict[str, dict]) -> list[str]:
    problems = []
    for name in sorted(set(schema) | set(design)):
        if name not in design:
            problems.append(f"{name} is in the schema, not the design")
            continue
        if name not in schema:
            problems.append(f"{name} is in the design, not the schema")
            continue
        s, d = schema[name], design[name]
        if s["extends"] != d["extends"]:
            problems.append(f"{name} extends {s['extends']} in the schema, {d['extends']} in the design")
        if s["entities"] != d["entities"]:
            problems.append(f"{name} has Entities {s['entities']} in the schema, {d['entities']} in the design")
        for relationship in sorted(s["relationships"] - d["relationships"], key=str):
            problems.append(f"{name}: only the schema has {show(relationship)}")
        for relationship in sorted(d["relationships"] - s["relationships"], key=str):
            problems.append(f"{name}: only the design has {show(relationship)}")
    return problems


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs" / "system-designer.systemathic.json"
    problems = differences(from_schema(), from_design(path))
    for problem in problems:
        print(f"  {problem}")
    print(f"schema/ and {path.name}: {'the same vocabulary' if not problems else f'{len(problems)} difference(s)'}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
