"""Bring a System file forward from `systemathic/2` to `systemathic/3` (docs/format.md).

    python scripts/migrate.py FILE [FILE ...]          rewrite each file in place

What changes:
- the System's `components` become its `root` and its `packages`;
- a Component gains `implements` (empty: an import that stands in for one stays an import);
- a Formula loses `constrains`; an Interaction loses `primary` and `compares`;
- a Transformation's source and target Languages, mappings, context and deferrals become a
  signature: one Parameter and an output. A signature cannot be read off two Languages, so
  each Transformation must be listed in SIGNATURES, by id; an unlisted one stops the
  migration;
- an Instance gains a range, `1..1`; a Connection's `toInstance` becomes `to`;
- the System's `configurations` become the `configurations` attachment, each Choice naming
  the Component that fills it;
- a Component's `imports` become Imports, one per Component it imports from, each taking
  some of that Component's Exports; whatever another Component imported from a Component,
  it now exports (see `exports`).

A file in the draft of `systemathic/3` that still lists `imports` by kind is brought forward
the same way.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

#: Transformation id → (parameter name, parameter type id, output id).
SIGNATURES: dict[str, tuple[str, str, str]] = {
    "pkg.http-over-tcp.down": ("request", "lib.http.request", "lib.tcp.stream"),
    "pkg.http-over-tcp.up": ("stream", "lib.tcp.stream", "lib.http.response"),
    "game.combat-over-network.down": ("monster", "combat.combat-monster", "lib.network.entity-id"),
    "game.combat-over-network.up": ("id", "lib.network.entity-id", "combat.combat-monster"),
    "game.network-over-wire.down": ("message", "lib.network.message", "lib.transport.packet"),
    "game.network-over-wire.up": ("packet", "lib.transport.packet", "lib.network.message"),
}

IMPORT_KEYS = ["components", "interactions", "transformations", "mediums"]


def component(c: dict, ids: set[str]) -> dict:
    return {
        "id": c["id"], "name": c["name"],
        "uses": c["uses"],
        "imports": {key: c["imports"].get(key, []) for key in IMPORT_KEYS},
        "implements": [],
        "languages": [language(l) for l in c["languages"]],
        "interactions": [interaction(i) for i in c.get("interactions", [])],
        "transformations": [transformation(t, ids) for t in c["transformations"]],
        "mediums": c.get("mediums", []),
        "deployments": [deployment(d) for d in c.get("deployments", [])],
        "components": [component(child, ids) for child in c["components"]],
    }


def language(l: dict) -> dict:
    return {**l, "formulas": [{"id": f["id"], "text": f["text"]} for f in l["formulas"]]}


def interaction(i: dict) -> dict:
    return {"id": i["id"], "name": i["name"], "language": i["language"], "parameters": i["parameters"], "output": i["output"]}


def transformation(t: dict, ids: set[str]) -> dict:
    if t["id"] not in SIGNATURES:
        raise SystemExit(f"no signature for Transformation {t['id']} ({t['name']}): add it to SIGNATURES")
    name, type_, output = SIGNATURES[t["id"]]
    for ref in (type_, output):
        if ref not in ids:
            raise SystemExit(f"the signature of {t['id']} names {ref}, which is not in the file")
    return {"id": t["id"], "name": t["name"], "parameters": [{"id": f"{t['id']}.{name}", "name": name, "type": type_}], "output": output}


def deployment(d: dict) -> dict:
    return {
        "id": d["id"], "name": d["name"],
        "instances": [{"id": i["id"], "name": i["name"], "of": i["of"], "min": 1, "max": 1} for i in d["instances"]],
        "connections": [
            {"id": c["id"], "from": c["from"], "to": c["toInstance"], "toComponent": c["toComponent"], "what": c["what"],
             "mediations": c.get("mediations", [])}
            for c in d["connections"]
        ],
    }


def choice(h: dict, components_of: dict[str, str]) -> dict:
    return {
        "id": h["id"], "instance": h["instance"], "component": components_of[h["deployment"]], "deployment": h["deployment"],
        "choices": [choice(child, components_of) for child in h["choices"]],
    }


def all_ids(value) -> set[str]:
    found: set[str] = set()
    if isinstance(value, dict):
        if isinstance(value.get("id"), str):
            found.add(value["id"])
        for item in value.values():
            found |= all_ids(item)
    elif isinstance(value, list):
        for item in value:
            found |= all_ids(item)
    return found


EXPORTED = {"interactions": "interaction", "transformations": "transformation", "mediums": "medium", "languages": "language"}


def exports(design: dict) -> dict:
    """Replaces every Component's `imports` by kind with Exports and Imports, in place.

    An import of a Component becomes an Import from it, taking the Languages, Transformations
    and Mediums it owns (all of which an import of the Component gave access to), and those of
    its Interactions that the importer's Connections use. An import of an Interaction,
    Transformation or Medium becomes an Import from its owner, taking it. Whatever is taken,
    its owner exports.
    """
    components: dict[str, dict] = {}
    owner: dict[str, tuple[str, str]] = {}  # id → (owning Component, export key)
    instance_of: dict[str, str] = {}

    def index(c: dict) -> None:
        components[c["id"]] = c
        for key, kind in EXPORTED.items():
            for item in c.get(key, []):
                owner[item["id"]] = (c["id"], kind)
        for d in c.get("deployments", []):
            for i in d["instances"]:
                instance_of[i["id"]] = i["of"]
        for child in c["components"]:
            index(child)

    for c in [design["root"], *design["packages"]]:
        index(c)
    used: dict[str, set[str]] = {cid: set() for cid in components}  # Component → Interactions its Connections use
    for c in components.values():
        for d in c.get("deployments", []):
            for x in d["connections"]:
                for end in (instance_of.get(x["from"]), x["toComponent"]):
                    if end is not None:
                        used[end] |= set(x["what"])
    made: dict[str, list[dict]] = {cid: [] for cid in components}

    def export(target: str) -> str:
        exporter, kind = owner[target]
        id = f"{exporter}:{target}"
        if not any(e["id"] == id for e in made[exporter]):
            made[exporter].append({"id": id, kind: target})
        return id

    taken: dict[str, dict[str, list[str]]] = {cid: {} for cid in components}
    for cid, c in components.items():
        old = c["imports"]
        if isinstance(old, list):
            continue
        for k in old.get("components", []):
            whole = components[k]
            targets = [item["id"] for key in ("languages", "transformations", "mediums") for item in whole.get(key, [])]
            targets += [i["id"] for i in whole.get("interactions", []) if i["id"] in used[cid]]
            taken[cid].setdefault(k, []).extend(export(t) for t in targets)
        for key in ("interactions", "transformations", "mediums"):
            for target in old.get(key, []):
                taken[cid].setdefault(owner[target][0], []).append(export(target))
    for cid, c in components.items():
        if isinstance(c["imports"], list):
            continue
        imports = [{"id": f"{cid}<{k}", "from": k, "exports": list(dict.fromkeys(ids))} for k, ids in taken[cid].items()]
        rebuilt = {}
        for key, value in c.items():
            if key == "imports":
                rebuilt["exports"] = made[cid]
                rebuilt["imports"] = imports
            else:
                rebuilt[key] = value
        c.clear()
        c.update(rebuilt)
    return design


def migrate(file: dict) -> dict:
    if file.get("format") == "systemathic/3":
        exports(file["design"])
        return file
    if file.get("format") != "systemathic/2":
        raise SystemExit(f"not a systemathic/2 file: {file.get('format')!r}")
    design = file["design"]
    ids = all_ids(design)
    components = [component(c, ids) for c in design["components"]]
    root = next(c for c in components if c["id"] == design["root"])
    components_of: dict[str, str] = {}

    def index(c: dict) -> None:
        for d in c["deployments"]:
            components_of[d["id"]] = c["id"]
        for child in c["components"]:
            index(child)

    for c in components:
        index(c)
    attachments = [a for a in file.get("attachments", []) if a["owner"] != "configurations"]
    configurations = design.get("configurations", [])
    if configurations:
        attachments.append({"owner": "configurations", "data": {"configurations": [
            {"id": c["id"], "name": c["name"], "rules": [], "root": choice(c["root"], components_of)} for c in configurations
        ]}})
    return {
        "format": "systemathic/3",
        "design": exports({"id": design["id"], "name": design["name"], "root": root, "packages": [c for c in components if c is not root]}),
        "attachments": attachments,
    }


def main(paths: list[str]) -> int:
    if not paths:
        print(__doc__)
        return 2
    for path in map(Path, paths):
        file = json.loads(path.read_text(encoding="utf-8"))
        path.write_text(json.dumps(migrate(file), ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
        print(f"migrated {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
