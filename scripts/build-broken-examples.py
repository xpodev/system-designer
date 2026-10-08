"""Writes examples/broken/*: the game example, each with one thing wrong.

    python scripts/build-broken-examples.py

Each file breaks the condition its name says (`w5` breaks W5), which
packages/tool-json/test/broken.test.ts checks; the diagnoser's snapshots show what it reports.
"""
import copy
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent / "examples"
game = json.loads((ROOT / "game.systemathic.json").read_text(encoding="utf-8"))


def find(node, cid):
    if isinstance(node, dict):
        if node.get("id") == cid:
            return node
        for value in node.values():
            found = find(value, cid)
            if found is not None:
                return found
    elif isinstance(node, list):
        for value in node:
            found = find(value, cid)
            if found is not None:
                return found
    return None


def mutate(name, note, change):
    file = copy.deepcopy(game)
    change(file)
    file["attachments"] = [{"owner": "example", "data": {"note": note}}]
    path = ROOT / "broken" / f"{name}.systemathic.json"
    path.write_text(json.dumps(file, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def dangling(f):
    find(f, "game.server")["uses"].append("nothing")


def formula(f):
    find(f, "core")["formulas"][0]["text"] = "all m in Monster. m.^leader == m.customer"


def range_(f):
    find(f, "pkg.netstack.medium")["call"] = "nothing"


def w1_relationship(f):
    find(f, "core.hunts")["ends"][0]["entity"] = "fighting.attacker"


def w1_extends(f):
    find(f, "fighting.damage")["extends"] = ["fighting.attacker"]


def w2(f):
    end = find(f, "core.pack")["ends"][0]
    end["min"], end["max"] = 2, 1


def w3(f):
    find(f, "core.pack")["ends"][1]["name"] = "hunters"


def w4(f):
    find(f, "core")["extends"] = ["combat"]


def w5(f):
    find(f, "game.server")["uses"].append("lib.network")


def w6(f):
    find(f, "game.network-over-wire")["uses"].remove("lib.transport")


def w7(f):
    find(f, "game.combat-over-network.down")["relationshipMappings"] = [{"source": "combat.chasing", "targets": ["lib.network.carries"]}]


def w8(f):
    find(f, "game.server.attack")["parameters"][1]["type"] = "lib.network.message"


def w9(f):
    find(f, "game.physics")["imports"]["components"].append("game.client.input")


def w10(f):
    find(f, "game.online.client-2-attacks")["toInstance"] = "game.online.client-1"


def w11(f):
    find(f, "pkg.netstack.medium")["call"] = "pkg.link.transmit"


def w12(f):
    mediation = find(f, "game.online.client-1-attacks")["mediations"][0]
    mediation["down"], mediation["up"] = mediation["up"], mediation["down"]


def w13(f):
    find(f, "game.release")["root"]["choices"][0]["deployment"] = "game.client.desktop"


for name, note, change in [
    ("dangling", "A reference to nothing: the reader drops it.", dangling),
    ("formula", "A formula that does not fit its Language.", formula),
    ("range", "A Medium whose call refers to nothing, so it has none.", range_),
    ("w1-relationship", "W1: a Relationship of Core reaches an Entity of Fighting.", w1_relationship),
    ("w1-extends", "W1: an Entity extends one of its own Language's.", w1_extends),
    ("w2", "W2: a range whose min is above its max.", w2),
    ("w3", "W3: Monster reaches two ends named 'hunters'.", w3),
    ("w4", "W4: Core and Combat extend each other.", w4),
    ("w5", "W5: Server uses Network without importing the Component that defines it.", w5),
    ("w6", "W6: a Transformation into a Language its holder does not use.", w6),
    ("w7", "W7: a Relationship mapping whose Entities are not mapped.", w7),
    ("w8", "W8: an Interaction with a Parameter outside its Language.", w8),
    ("w9", "W9: Physics imports a Component from inside its sibling Client.", w9),
    ("w10", "W10: a Connection to an Instance that does not offer its What.", w10),
    ("w11", "W11: a Medium whose call is another Component's Interaction.", w11),
    ("w12", "W12: a Mediation realized upside down.", w12),
    ("w13", "W13: a choice of a Deployment of another Component.", w13),
]:
    mutate(name, note, change)
