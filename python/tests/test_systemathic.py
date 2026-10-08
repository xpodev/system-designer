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
        self.assertIs(attack.primary, attack.parameters[0])
        self.assertEqual(attack.output.name, "Damage")
        self.assertEqual(attack.language.name, "Combat")
        end = system.language("Core").relationships[1].ends[0]
        self.assertEqual((end.name, end.min, end.max), ("leader", 0, 1))
        self.assertEqual(system.language("Core").formulas[0].text, "all m in Monster. not m in m.^leader")
        self.assertEqual([m.how.name for m in system.element("game.online.client-1-attacks").mediations], ["Network", "Wire"])
        self.assertEqual(system.root.name, "Game")
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
        with self.assertRaisesRegex(ValueError, "systemathic/2"):
            read({"format": "systemathic/1"})


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
        find(file, "game.physics")["imports"]["components"].append("game.server")
        result = found(file)
        self.assertEqual(result["imports_acyclic"], ["depend on each other: Physics, Server"])
        projection = {"id": "back", "name": "back", "source": "combat", "target": "core", "context": [],
                      "entityMappings": [], "relationshipMappings": [], "deferred": []}
        forward = dict(projection, id="forth", name="forth", source="core", target="fighting")
        onward = dict(projection, id="onward", name="onward", source="fighting", target="combat")
        find(file, "game")["transformations"] += [projection, forward, onward]
        find(file, "game")["uses"] += ["core", "fighting", "combat"]
        self.assertEqual(found(file)["projection_acyclic"], ["projected into themselves: Combat, Core, Fighting"])

    def test_deployments_complete(self):
        file = copy.deepcopy(GAME)
        connections = find(file, "game.local")["connections"]
        connections.clear()
        self.assertEqual(found(file)["deployments_complete"], ["in Local, nothing serves client's attack"])

    def test_interactions_abstract(self):
        file = copy.deepcopy(GAME)
        find(file, "game.client")["imports"]["interactions"].append("pkg.netstack.send")
        find(file, "game.client")["imports"]["components"].append("pkg.netstack")
        self.assertIn("Client imports send, over Network, which Mediations are over", found(file)["interactions_abstract"])

    def test_deferred_items_are_complete(self):
        file = copy.deepcopy(GAME)
        find(file, "game.combat-over-network.down")["deferred"] = []
        self.assertEqual(found(file)["completeness"], ["Combat down to Network leaves 1 item(s) of Combat neither mapped nor deferred"])

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

    @unittest.skip("the tool's own design is rewritten in the new model last")
    def test_finds_nothing_wrong_with_the_tool_designs_profile(self):
        self.assertEqual(assist.check(str(EXAMPLES / "tool-design.rules.py"))["problems"], [])

    def test_offers_symbols_with_their_documentation(self):
        symbols = {(s["name"], s["kind"]): s for s in assist.symbols()}
        self.assertIn("L.*extends", symbols[("vocab", "function")]["doc"])
        self.assertEqual(symbols[("component", "method")]["detail"], "System.component(self, name: 'str') -> 'Element'")
        self.assertIn(("importedInteractions", "property"), symbols)
        self.assertIn("by name", symbols[("mediation_primitives", "function")]["doc"])
        self.assertEqual(symbols[("opacity", "rule")]["detail"], "standard rule, error")


class RuleHost(unittest.TestCase):
    def run_host(self, *args: str) -> dict:
        done = subprocess.run([sys.executable, "-m", "systemathic.host", *args], cwd=PYTHON, capture_output=True, text=True)
        return json.loads(done.stdout)

    @unittest.skip("the tool's own design is rewritten in the new model last")
    def test_runs_the_tool_designs_own_profile(self):
        result = self.run_host("run", str(EXAMPLES / "tool-design.rules.py"), str(EXAMPLES / "tool-design.systemathic.json"))
        self.assertEqual(result["profile"], "profile")
        self.assertEqual(len(result["rules"]), 16)
        self.assertEqual([v for v in result["violations"] if v["severity"] == ERROR], [])
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
        self.assertEqual(len(result["rules"]), 8)
        opacity = result["rules"][0]
        self.assertEqual(opacity["about"], "Every mediated Connection is opaque: what uses and what offers do not know how they are connected.")
        self.assertIn("This is what makes a how swappable", opacity["doc"])

    def test_reports_an_unusable_script(self):
        result = self.run_host("run", "std", str(EXAMPLES / "game.systemathic.json"), "nope")
        self.assertIn("has no profile 'nope'", result["error"])


if __name__ == "__main__":
    unittest.main()
