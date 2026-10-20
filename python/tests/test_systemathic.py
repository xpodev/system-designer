"""systemathic.core, systemathic.std and the RuleHost.

    python -m unittest discover -s python/tests
"""

from __future__ import annotations

import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

PYTHON = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PYTHON))

from generate import generate  # noqa: E402
from systemathic.core import load, read  # noqa: E402
from systemathic.std import (  # noqa: E402
    ERROR,
    Profile,
    Violation,
    abstract,
    is_core,
    mediation_depth,
    mediation_primitives,
    mediations_realized,
    pure,
    rule,
    scope,
    shared,
    standalone,
    standard,
    vocab,
)
from systemathic import assist, host  # noqa: E402

EXAMPLES = PYTHON.parent / "examples"
DOCS = PYTHON.parent / "docs"
GAME = json.loads((EXAMPLES / "game.systemathic.json").read_text(encoding="utf-8"))


def find(node, id: str) -> dict:
    """The object with `id` anywhere in a parsed System file."""
    if isinstance(node, dict):
        if node.get("id") == id:
            return node
        node = list(node.values())
    if isinstance(node, list):
        for value in node:
            found_ = find(value, id) if isinstance(value, (dict, list)) else None
            if found_ is not None:
                return found_
    return None  # type: ignore[return-value]


def medium_package(key: str, name: str) -> dict:
    """A package defining one Language and a Medium over it, exporting both."""
    language, call, medium = f"lib.{key}", f"pkg.{key}.carry", f"pkg.{key}.medium"
    return {
        "id": f"pkg.{key}", "name": name, "uses": [language], "imports": [], "implements": [],
        "exports": [{"id": f"pkg.{key}:{language}", "language": language}, {"id": f"pkg.{key}:{medium}", "medium": medium}],
        "languages": [{"id": language, "name": name, "extends": [], "entities": [{"id": f"{language}.value", "name": "Value", "extends": []}], "relationships": [], "formulas": []}],
        "interactions": [{"id": call, "name": "carry", "language": language, "parameters": [{"id": f"{call}.value", "name": "value", "type": f"{language}.value"}], "output": f"{language}.value"}],
        "transformations": [], "mediums": [{"id": medium, "name": name, "language": language, "call": call}],
        "deployments": [], "components": [],
    }


def with_stack(game: dict, *mediums: str) -> dict:
    """The game, with client 1's attacks mediated over the given Mediums, top down: Text and JSON, or the game's own."""
    file = copy.deepcopy(game)
    file["design"]["packages"] += [medium_package("text", "Text"), medium_package("json", "JSON")]
    find(file, "game")["imports"] += [{"id": f"game<{k}", "from": f"pkg.{k}", "exports": [f"pkg.{k}:lib.{k}", f"pkg.{k}:pkg.{k}.medium"]} for k in ("text", "json")]
    stack = [{"id": f"m{i}", "how": f"pkg.{how}.medium", "down": None, "up": None} for i, how in enumerate(mediums)]
    find(file, "game.online.client-1-attacks")["mediations"] = stack
    return file


def found(file: dict, *rules) -> dict[str, list[str]]:
    system = read(file)
    return {r.name: [v.message for v in r(system)] for r in (rules or standard.rules) if r(system)}


class Binding(unittest.TestCase):
    def test_schema_module_is_up_to_date(self):
        current = (PYTHON / "systemathic" / "_schema.py").read_text(encoding="utf-8").replace("\r\n", "\n")
        self.assertEqual(current, generate())

    def test_navigates_in_natural_forms(self):
        system = load(EXAMPLES / "game.systemathic.json")
        attack = system.component("Server").interactions[0]
        self.assertEqual([p.name for p in attack.parameters], ["attacker", "target"])
        self.assertEqual(attack.output.name, "Damage")
        self.assertEqual(attack.language.name, "Combat")
        end = system.language("Core").relationships[1].ends[0]
        self.assertEqual((end.name, end.min, end.max), ("leader", 0, 1))
        self.assertEqual(system.language("Core").formulas[0].text, "all m in Monster. not m in m.^leader")
        self.assertEqual([m.how.name for m in system.element("game.online.client-1-attacks").mediations], ["Network", "Wire"])
        self.assertEqual(system.root.name, "Game")
        down = system.transformation("Combat down to Network")
        self.assertEqual((down.parameters[0].type.name, down.output.name), ("CombatMonster", "EntityId"))
        self.assertIs(system.interaction("send").parameters[0].function, system.interaction("send"))
        self.assertEqual(system.model.problems, [])

    def test_reads_an_unnamed_end(self):
        file = copy.deepcopy(GAME)
        find(file, "core.hunts")["ends"][1]["name"] = None
        end = read(file).language("Core").relationships[0].ends[1]
        self.assertIsNone(end.name)
        self.assertEqual(end.entity.name, "Monster")

    def test_lookups_raise_on_missing_or_ambiguous_names(self):
        file = copy.deepcopy(GAME)
        find(file, "game.physics")["name"] = "Server"
        system = read(file)
        with self.assertRaisesRegex(LookupError, "no Component named 'Nothing'"):
            system.component("Nothing")
        with self.assertRaisesRegex(LookupError, "2 Components are named 'Server'"):
            system.component("Server")

    def test_drops_references_to_nothing(self):
        file = copy.deepcopy(GAME)
        find(file, "game.server")["uses"] = ["nowhere"]
        system = read(file)
        self.assertEqual(system.component("Server").uses, [])
        self.assertEqual(len(system.model.problems), 1)

    def test_rejects_the_previous_model(self):
        with self.assertRaisesRegex(ValueError, "systemathic/3"):
            read({"format": "systemathic/2"})

    def test_orders_chains_however_they_were_linked(self):
        file = copy.deepcopy(GAME)
        attack = find(file, "game.server.attack")
        attack["parameters"].reverse()
        system = read(file)
        self.assertEqual([p.name for p in system.interaction("attack").parameters], ["target", "attacker"])
        self.assertIsNone(system.interaction("attack").parameters[0].previous)


class Standard(unittest.TestCase):
    def test_concepts(self):
        system = load(EXAMPLES / "game.systemathic.json")
        self.assertEqual([l.name for l in vocab(system.language("Combat"))], ["Combat", "Core", "Fighting"])
        self.assertTrue(is_core(system.language("Core")))
        self.assertFalse(is_core(system.language("Combat")))
        self.assertEqual({l.name for l in scope(system.component("CombatOverNetwork"))}, {"Core", "Fighting", "Combat", "Network"})
        self.assertTrue(pure(system.component("Physics")))
        self.assertFalse(pure(system.component("Client")))
        self.assertTrue(shared(system.component("Physics")))
        self.assertTrue(standalone(system.component("Server")))
        self.assertFalse(standalone(system.component("Physics")))
        self.assertTrue(abstract(system.language("Combat")))
        self.assertFalse(abstract(system.language("Network")))
        self.assertTrue(abstract(system.interaction("attack")))

    def test_the_game_breaks_no_standard_rule(self):
        self.assertEqual(found(GAME), {})

    def test_opacity(self):
        file = copy.deepcopy(GAME)
        find(file, "game.client")["uses"].append("lib.network")
        self.assertIn("Client knows Network, which its Connection is mediated over", found(file)["opacity"])

    def test_cycles(self):
        file = copy.deepcopy(GAME)
        find(file, "game.physics")["imports"].append({"id": "physics<server", "from": "game.server", "exports": []})
        result = found(file)
        self.assertEqual(result["imports_acyclic"], ["depend on each other: Physics, Server"])
        def projection(id: str, type_: str, output: str) -> dict:
            return {"id": id, "name": id, "parameters": [{"id": f"{id}.x", "name": "x", "type": type_}], "output": output}

        back = projection("back", "combat.combat-monster", "core.monster")
        forward = projection("forth", "core.monster", "fighting.attacker")
        onward = projection("onward", "fighting.attacker", "combat.combat-monster")
        find(file, "game")["transformations"] += [back, forward, onward]
        find(file, "game")["uses"] += ["core", "fighting", "combat"]
        self.assertEqual(found(file)["projection_acyclic"], ["projected into themselves: Combat, Core, Fighting"])

    def test_a_language_may_recur_in_a_stack(self):
        file = with_stack(GAME, "text", "json", "text", "netstack")
        self.assertEqual(found(file), {})

    def test_mediation_separate(self):
        file = with_stack(GAME, "text", "text", "netstack")
        self.assertEqual(found(file)["mediation_separate"], ["Text is mediated over itself"])
        file = with_stack(GAME, "text", "json", "netstack")
        find(file, "lib.json")["extends"].append("lib.text")
        self.assertEqual(found(file)["mediation_separate"], ["Text is mediated over JSON, and one extends the other"])

    def test_medium_blind(self):
        file = copy.deepcopy(GAME)
        find(file, "pkg.netstack")["uses"].append("combat")
        self.assertEqual(found(file)["medium_blind"], ["NetStack knows Combat, which its Medium Network carries"])

    def test_mediators_minimal(self):
        file = copy.deepcopy(GAME)
        find(file, "game.combat-over-network")["uses"].append("lib.transport")
        self.assertEqual(found(file)["mediators_minimal"], ["CombatOverNetwork mediates between Combat and Network, and knows Transport too"])
        file = copy.deepcopy(GAME)
        for mediation in find(file, "game.online.client-1-attacks")["mediations"]:
            mediation["down"] = "game.combat-over-network.down"
        self.assertEqual(found(file)["mediators_minimal"], ["CombatOverNetwork mediates between Combat and Network, Network and Transport"])

    def test_deployments_complete(self):
        file = copy.deepcopy(GAME)
        connections = find(file, "game.local")["connections"]
        connections.clear()
        self.assertEqual(found(file)["deployments_complete"], ["in Local, nothing serves client's attack"])

    def test_interactions_abstract(self):
        file = copy.deepcopy(GAME)
        find(file, "pkg.netstack")["exports"].append({"id": "netstack:send", "interaction": "pkg.netstack.send"})
        find(file, "game.client")["imports"].append({"id": "client<netstack", "from": "pkg.netstack", "exports": ["netstack:send"]})
        self.assertIn("Client imports send, over Network, which Mediations are over", found(file)["interactions_abstract"])

    def test_exports_interfaces(self):
        file = copy.deepcopy(GAME)
        find(file, "game")["exports"].append({"id": "game:game.server", "component": "game.server"})
        self.assertNotIn("exports_interfaces", found(file))
        find(file, "game")["exports"].append({"id": "game:game.client", "component": "game.client"})
        self.assertEqual(found(file)["exports_interfaces"], ["Game exports Client, which has children: an implementation"])

    def test_mediation_rules_take_their_arguments_and_have_none_by_default(self):
        with self.assertRaises(TypeError):
            mediation_depth()  # type: ignore[call-arg]
        with self.assertRaisesRegex(ValueError, "needs the Mediums"):
            mediation_primitives()
        primitives = mediation_primitives("Network", "Wire", "In-process")
        self.assertEqual(primitives.name, "mediation_primitives")
        self.assertEqual(found(GAME, primitives, mediation_depth(1), mediations_realized("Network", "Wire")), {})
        self.assertEqual(found(GAME, mediation_primitives("In-process")), {
            "mediation_primitives": [
                "game.online.client-1-attacks is not mediated down to a primitive (In-process)",
                "game.online.client-2-attacks is not mediated down to a primitive (In-process)",
            ],
        })
        self.assertEqual(len(found(GAME, mediation_depth(2))["mediation_depth"]), 2)
        self.assertEqual(found(GAME, mediations_realized("In-process"))["mediations_realized"], [
            "a Mediation of game.local.client-attacks over In-process is not realized",
            "a Mediation of game.client.desktop.input-attacks over In-process is not realized",
        ])

    def test_profiles(self):
        @rule(severity=ERROR)
        def nothing(system):
            """Finds nothing."""
            return []

        profile = Profile(*standard.rules, nothing, nothing)
        self.assertEqual(len(profile.rules), len(standard.rules) + 1)
        self.assertEqual(nothing.about, "Finds nothing.")

        @rule(severity=ERROR)
        def explained(system):
            """Checks one thing,
            in two lines.

            Because it matters.
            """
            return []

        self.assertEqual(explained.about, "Checks one thing, in two lines.")
        self.assertEqual(explained.doc, "Checks one thing,\nin two lines.\n\nBecause it matters.")
        self.assertEqual(Violation(read(GAME), "x").elements[0].name, "Game")


class Assist(unittest.TestCase):
    def script(self, text: str) -> str:
        folder = Path(tempfile.mkdtemp())
        path = folder / "rules.py"
        path.write_text(text, encoding="utf-8")
        return str(path)

    def test_reports_a_syntax_error_where_it_is(self):
        result = assist.check(self.script("from systemathic.std import *\n\ndef broken(:\n    pass\n"))
        self.assertEqual([(p["line"], p["severity"]) for p in result["problems"]], [(3, "error")])
        self.assertTrue(result["problems"][0]["message"].startswith("SyntaxError"))

    def test_reports_an_error_raised_while_loading_at_its_line(self):
        result = assist.check(self.script("from systemathic.std import *\nprofile = Profile(missing)\n"))
        self.assertEqual(result["problems"][0]["line"], 2)
        self.assertIn("NameError", result["problems"][0]["message"])

    def test_lints_rules_in_no_profile_and_without_a_docstring(self):
        result = assist.check(self.script(
            "from systemathic.std import *\n\n@rule(severity=ERROR)\ndef lonely(system):\n    return []\n\nstrict = Profile(*standard_rules)\n"
        ))
        found = sorted((p["line"], p["severity"]) for p in result["problems"])
        self.assertEqual(found, [(4, "info"), (4, "warning")])
        # `from systemathic.std import *` brings `standard` in; a script without it has none.
        bare = assist.check(self.script("from systemathic.std import rule\n"))
        self.assertEqual([p["message"][:28] for p in bare["problems"]], ["There is no profile to verif"])
        self.assertEqual(next(r for r in result["rules"] if r["name"] == "lonely")["line"], 4)

    def test_finds_nothing_wrong_with_the_tool_designs_profile(self):
        self.assertEqual(assist.check(str(DOCS / "system-designer.rules.py"))["problems"], [])

    def test_offers_symbols_with_their_documentation(self):
        symbols = {(s["name"], s["kind"]): s for s in assist.symbols()}
        self.assertIn("L.*extends", symbols[("vocab", "function")]["doc"])
        self.assertEqual(symbols[("component", "method")]["detail"], "System.component(self, name: 'str') -> 'Element'")
        self.assertIn(("imports", "property"), symbols)
        self.assertIn("by name", symbols[("mediation_primitives", "function")]["doc"])
        self.assertEqual(symbols[("opacity", "rule")]["detail"], "standard rule, error")


class RuleHost(unittest.TestCase):
    def run_host(self, *args: str) -> dict:
        done = subprocess.run([sys.executable, "-m", "systemathic.host", *args], cwd=PYTHON, capture_output=True, text=True)
        return json.loads(done.stdout)

    def test_runs_the_tool_designs_own_profile(self):
        result = self.run_host("run", str(DOCS / "system-designer.rules.py"), str(DOCS / "system-designer.systemathic.json"))
        self.assertEqual(result["profile"], "profile")
        self.assertEqual(len(result["rules"]), 19)
        self.assertEqual(result["violations"], [])
        self.assertEqual(result["failures"], [])

    def test_reports_a_broken_rule_and_runs_the_others(self):
        broken = PYTHON / "tests" / "broken_rules.py"
        result = self.run_host("run", str(broken), str(EXAMPLES / "game.systemathic.json"))
        self.assertEqual([(f["rule"], f["line"]) for f in result["failures"]], [("explodes", 10)])
        self.assertEqual([v["rule"] for v in result["violations"]], ["finds_core"])
        self.assertEqual(result["violations"][0]["subjects"], ["core"])

    def test_describes_a_script(self):
        result = host.describe("std")
        self.assertEqual([p["name"] for p in result["profiles"]], ["standard"])
        self.assertEqual(len(result["rules"]), 10)
        opacity = result["rules"][0]
        self.assertEqual(opacity["about"], "Every mediated Connection is opaque: what uses and what offers do not know how they are connected.")
        self.assertIn("This is what makes a how swappable", opacity["doc"])

    def test_reports_an_unusable_script(self):
        result = self.run_host("run", "std", str(EXAMPLES / "game.systemathic.json"), "nope")
        self.assertIn("has no profile 'nope'", result["error"])


if __name__ == "__main__":
    unittest.main()
