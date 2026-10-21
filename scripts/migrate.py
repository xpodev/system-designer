"""Bring a System file forward, from `systemathic/2` or `systemathic/3`, to `systemathic/4` (docs/format.md).

    python scripts/migrate.py FILE [FILE ...]                       rewrite each file in place
    python scripts/migrate.py --signatures SIGS.json FILE [FILE ...]   with more signatures

What changes:
- the System's `components` become its `root` and its `packages`;
- a Component gains `implements` (empty: an import that stands in for one stays an import);
- a Formula loses `constrains`; an Interaction loses `primary` and `compares`;
- a Transformation's source and target Languages, mappings, context and deferrals become a
  signature: one Parameter and an output. A signature cannot be read off two Languages, so
  each Transformation must be listed in SIGNATURES, by id, or in a signatures file —
  `{"<transformation id>": ["<parameter name>", "<parameter type id>", "<output id>"]}`;
  an unlisted one stops the migration;
- an Instance gains a range, `1..1`; a Connection's `toInstance` becomes `to`;
- the System's `configurations` become the `configurations` attachment, each Choice naming
  the Component that fills it;
- a Component's `imports` become Imports, one per Component it imports from, each taking
  some of that Component's Exports; whatever another Component imported from a Component,
  it now exports (see `exports`).

A file in the draft of `systemathic/3` that still lists `imports` by kind is brought forward
the same way.

Exports are global, so a `systemathic/3` file with re-exports is brought forward too:
- an Import that takes a re-export takes the Export it re-exports, from the Component that
  exports it, instead; an Import left with nothing to take is kept only where the importer
  places or implements what it is from;
- re-exports, and their descriptions, go;
- a Component that is placed beyond where its parent's parts reach is exported by its
  parent, so that it may be placed;
- a Component that re-exported an Interaction of its child exports the child instead, as
  an API: a Component offers the Interactions of the APIs it exports.

Boxes and their Deployments (`systemathic/4`, docs/proposals/boxes-and-deployments.md):
- `implements` goes. A Component `X` implementing `I` keeps a Deployment of `I` instead: its
  own Deployments, for the first `I`, or an empty one, named for `X` — an implementation with
  its insides redacted;
- an Instance of an `X` that implements one `I` becomes an Instance of `I` that `runs` it;
- a Component imports only vocabulary: its Imports of anything but Languages move to the
  Deployments it keeps, as their needs; one that keeps none, and calls or is built on
  something, gets an empty Deployment of its own, to hold those needs;
- a Deployment names its box, `of`; gains `imports` and `exposes`; an Instance gains `runs`,
  a Connection `toIdentity`; a Deployment imports each top-level Component it places, and its
  box if it is kept outside it;
- a Connection's Deployment imports the Mediums and realizations its Mediations use, where it
  has no access to them otherwise: realizations are the Deployment's, not the ends', whose
  imports of them go;
- a Configuration's Choice names only a Deployment of its occupant's box, or none.
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


def global_exports(file: dict) -> dict:
    """Takes re-exports out: each Import takes the Export at the end of the chain instead."""
    design = file["design"]
    components: dict[str, dict] = {}
    parents: dict[str, str | None] = {}

    def index(c: dict, parent: str | None) -> None:
        components[c["id"]] = c
        parents[c["id"]] = parent
        for child in c["components"]:
            index(child, c["id"])

    for top in [design["root"], *design["packages"]]:
        index(top, None)
    exporter = {e["id"]: c["id"] for c in components.values() for e in c.get("exports", [])}
    by_id = {e["id"]: e for c in components.values() for e in c.get("exports", [])}

    def base(export: str) -> str:
        seen: set[str] = set()
        while by_id[export].get("export") and export not in seen:
            seen.add(export)
            export = by_id[export]["export"]
        return export

    removed = {id for id, e in by_id.items() if e.get("export")}
    # A Component that re-exported an Interaction of a child offered it: it now exports the child, as an API.
    for id in removed:
        target = base(id)
        owner, outer = exporter[target], exporter[id]
        if by_id[target].get("interaction") and parents.get(owner) == outer:
            exports = components[outer]["exports"]
            if not any(e.get("component") == owner for e in exports):
                exports.append({"id": f"{outer}:{owner}", "component": owner})
    for c in components.values():
        placed = {i["of"] for d in c.get("deployments", []) for i in d["instances"]} | set(c.get("implements", []))
        imports: list[dict] = []
        for each in c.get("imports", []):
            moved: dict[str, list[str]] = {}
            kept = []
            for export in each["exports"]:
                target = base(export)
                if exporter[target] == each["from"]:
                    kept.append(target)
                else:
                    moved.setdefault(exporter[target], []).append(target)
            if kept or not moved or each["from"] in placed:
                imports.append({**each, "exports": list(dict.fromkeys(kept))})
            for source, taken in moved.items():
                same = next((m for m in imports if m["from"] == source), None)
                if same is not None:
                    same["exports"] = list(dict.fromkeys([*same["exports"], *taken]))
                    continue
                id, n = f"{c['id']}<{source}", 1
                while id in exporter or any(m["id"] == id for m in imports):
                    n += 1
                    id = f"{c['id']}<{source}#{n}"
                imports.append({"id": id, "from": source, "exports": list(dict.fromkeys(taken))})
        c["imports"] = imports
        c["exports"] = [e for e in c.get("exports", []) if e["id"] not in removed]

    def lineage(id: str | None) -> list[str]:
        found = []
        while id is not None:
            found.append(id)
            id = parents[id]
        return found

    for c in list(components.values()):
        for d in c.get("deployments", []):
            for instance in d["instances"]:
                placed, parent = instance["of"], parents.get(instance["of"])
                if parent is None or parent in lineage(c["id"]):
                    continue
                owner = components[parent]
                if not any(e.get("component") == placed for e in owner["exports"]):
                    owner["exports"].append({"id": f"{parent}:{placed}", "component": placed})
    file["attachments"] = [a for a in file.get("attachments", []) if a.get("owner") not in removed]
    return file


def slug(name: str) -> str:
    return "-".join("".join(ch.lower() if ch.isalnum() else " " for ch in name).split()) or "x"


def boxes(file: dict) -> dict:
    """`systemathic/3` to `systemathic/4`: implementations become Deployments, needs move to them."""
    design = file["design"]
    components: dict[str, dict] = {}
    parents: dict[str, str | None] = {}

    def index(c: dict, parent: str | None) -> None:
        components[c["id"]] = c
        parents[c["id"]] = parent
        for child in c["components"]:
            index(child, c["id"])

    for top in [design["root"], *design["packages"]]:
        index(top, None)
    ids = all_ids(design)

    def fresh(id: str) -> str:
        found, n = id, 2
        while found in ids:
            found, n = f"{id}-{n}", n + 1
        ids.add(found)
        return found

    def lineage(id: str | None) -> list[str]:
        found = []
        while id is not None:
            found.append(id)
            id = parents[id]
        return found

    def new_deployment(id: str, name: str, box: str) -> dict:
        return {"id": fresh(id), "name": name, "of": box, "instances": [], "connections": [], "imports": [], "exposes": []}

    for c in components.values():
        for d in c.get("deployments", []):
            d.setdefault("of", c["id"])
            d.setdefault("imports", [])
            d.setdefault("exposes", [])
            for instance in d["instances"]:
                instance.setdefault("runs", None)
            for connection in d["connections"]:
                connection.setdefault("toIdentity", None)

    # Implementations become Deployments of what they implement.
    made: dict[tuple[str, str], str] = {}
    moved_from: dict[str, str] = {}  # a Deployment of X now of I: its id -> I
    for c in components.values():
        for n, interface in enumerate(c.get("implements", [])):
            own = [d for d in c.get("deployments", []) if d["of"] == c["id"]]
            if n == 0 and own:
                for d in own:
                    d["of"] = interface
                    moved_from[d["id"]] = interface
                made[(c["id"], interface)] = own[0]["id"]
                continue
            d = new_deployment(f"{c['id']}.{slug(components[interface]['name'] if interface in components else interface)}", c["name"], interface)
            c.setdefault("deployments", []).append(d)
            made[(c["id"], interface)] = d["id"]
        c.pop("implements", None)

    exporter = {e["id"]: comp["id"] for comp in components.values() for e in comp.get("exports", [])}
    by_id = {e["id"]: e for comp in components.values() for e in comp.get("exports", [])}

    # Realizations are the Connection's Deployment's (added below): the ends' imports of them go.
    realizations = {m.get(end) for comp in components.values() for d in comp.get("deployments", [])
                    for connection in d["connections"] for m in connection.get("mediations", []) for end in ("down", "up")} - {None}

    # A Component imports only vocabulary; the rest of what it imports is its Deployments' needs.
    for c in components.values():
        kept, needs = [], []
        for m in c.get("imports", []):
            languages = [e for e in m["exports"] if by_id.get(e, {}).get("language")]
            others = [e for e in m["exports"] if e not in languages and by_id.get(e, {}).get("transformation") not in realizations]
            if not languages and not others and m["exports"]:
                continue
            if languages:
                kept.append({**m, "exports": languages})
            if others or not m["exports"]:
                needs.append({**m, "id": m["id"] if not languages else f"{m['id']}#needs", "exports": others})
        c["imports"] = kept
        holders = c.setdefault("deployments", [])
        if not holders:
            # A box with no layout places nothing and mediates nothing: only what it calls, or is
            # built on, is a need of its implementation, redacted.
            needs = [{**m, "exports": [e for e in m["exports"] if by_id.get(e, {}).get("interaction") or by_id.get(e, {}).get("deployment")]} for m in needs]
            needs = [m for m in needs if m["exports"]]
        if not needs:
            continue
        if not holders:
            holders.append(new_deployment(f"{c['id']}.implementation", c["name"], c["id"]))
        for n, holder in enumerate(holders):
            for m in needs:
                copy = {**m, "id": m["id"] if n == 0 else fresh(f"{m['id']}#{n + 1}")}
                ids.add(copy["id"])
                holder["imports"].append(copy)

    # An Instance of an implementation becomes an Instance of what it implements, running it.
    implemented = {}
    for (x, i), d in made.items():
        implemented.setdefault(x, []).append((i, d))
    for c in components.values():
        for d in c.get("deployments", []):
            for instance in d["instances"]:
                options = implemented.get(instance["of"], [])
                if len(options) == 1:
                    instance["of"], instance["runs"] = options[0]

    # A Deployment imports a top-level Component it places, and a box it is kept outside of.
    for keeper in components.values():
        for d in keeper.get("deployments", []):
            wanted = [i["of"] for i in d["instances"] if i["of"] in parents and parents[i["of"]] is None]
            if d["of"] != keeper["id"]:
                wanted.append(d["of"])
            for needed in dict.fromkeys(wanted):
                if not any(m.get("from") == needed for m in d["imports"]):
                    d["imports"].append({"id": fresh(f"{d['id']}<{needed}"), "from": needed, "exports": []})

    # Realizations and Mediums are the Deployment's: import those it has no access to.
    def export_of(owner: str, key: str, item: str) -> str:
        comp = components[owner]
        for e in comp.setdefault("exports", []):
            if e.get(key) == item:
                return e["id"]
        e = {"id": fresh(f"{owner}:{item}"), key: item}
        comp["exports"].append(e)
        by_id[e["id"]] = e
        exporter[e["id"]] = owner
        return e["id"]

    owner_of: dict[str, str] = {}
    for comp in components.values():
        for t in comp.get("transformations", []):
            owner_of[t["id"]] = comp["id"]
        for m in comp.get("mediums", []):
            owner_of[m["id"]] = comp["id"]

    for keeper in components.values():
        for d in keeper.get("deployments", []):
            reach = set(lineage(d["of"])) | set(lineage(keeper["id"]))
            for connection in d["connections"]:
                for mediation in connection.get("mediations", []):
                    for key, item in (("medium", mediation.get("how")), ("transformation", mediation.get("down")), ("transformation", mediation.get("up"))):
                        if not item or item not in owner_of or owner_of[item] in reach:
                            continue
                        taken = {by_id[e].get(key) for m in d["imports"] for e in m.get("exports", []) if e in by_id}
                        if item in taken:
                            continue
                        owner = owner_of[item]
                        e = export_of(owner, key, item)
                        m = next((m for m in d["imports"] if m.get("from") == owner), None)
                        if m is None:
                            m = {"id": fresh(f"{d['id']}<{owner}"), "from": owner, "exports": []}
                            d["imports"].append(m)
                        m["exports"].append(e)

    # A Choice names only a Deployment of its occupant's box.
    instance_box = {i["id"]: i["of"] for comp in components.values() for d in comp.get("deployments", []) for i in d["instances"]}

    def choose(choice: dict) -> dict:
        deployment = choice.get("deployment")
        component = choice.get("component")
        box = instance_box.get(choice["instance"]) if choice.get("instance") else component
        if component is not None and component != box:
            if deployment is None or deployment not in moved_from:
                deployment = made.get((component, box), deployment)
        return {"id": choice["id"], "instance": choice.get("instance"), "deployment": deployment,
                "choices": [choose(child) for child in choice.get("choices", [])]}

    for attachment in file.get("attachments", []):
        if attachment.get("owner") == "configurations":
            for configuration in attachment["data"].get("configurations", []):
                configuration["root"] = choose(configuration["root"])
    file["format"] = "systemathic/4"
    return file


def migrate(file: dict) -> dict:
    if file.get("format") == "systemathic/4":
        return file
    if file.get("format") == "systemathic/3":
        exports(file["design"])
        return boxes(global_exports(file))
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
    return boxes(global_exports({
        "format": "systemathic/3",
        "design": exports({"id": design["id"], "name": design["name"], "root": root, "packages": [c for c in components if c is not root]}),
        "attachments": attachments,
    }))


def main(paths: list[str]) -> int:
    if paths[:1] == ["--signatures"] and len(paths) >= 2:
        extra = json.loads(Path(paths[1]).read_text(encoding="utf-8"))
        SIGNATURES.update({id: tuple(signature) for id, signature in extra.items()})
        paths = paths[2:]
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
