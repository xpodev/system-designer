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
    langs,
    pure,
    rule,
    standard,
    top_domains,
)
from systemathic import assist, host  # noqa: E402

EXAMPLES = PYTHON.parent / "examples"
GAME = json.loads((EXAMPLES / "game.systemathic.json").read_text(encoding="utf-8"))


def domain(file: dict, id: str) -> dict:
    return next(d for d in file["design"]["domains"] if d["id"] == id)


def found(file: dict) -> dict[str, list[str]]:
    system = read(file)
    return {r.name: [v.message for v in r(system)] for r in standard.rules if r(system)}


class Binding(unittest.TestCase):
    def test_schema_module_is_up_to_date(self):
        current = (PYTHON / "systemathic" / "_schema.py").read_text(encoding="utf-8").replace("\r\n", "\n")
        self.assertEqual(current, generate())

    def test_navigates_in_natural_forms(self):
        system = load(EXAMPLES / "game.systemathic.json")
        combat = system.language("Combat")
        attack = combat.interactions[0]
        self.assertEqual([p.name for p in attack.parameters], ["attacker", "target"])
        self.assertIs(attack.primary, attack.parameters[0])
        self.assertEqual(attack.output.name, "Damage")
        end = system.language("Core").relationships[1].ends[0]
        self.assertEqual((end.name, end.min, end.max), ("leader", 0, 1))
        self.assertEqual(system.language("Core").formulas[0].text, "all m in Monster. not m in m.^leader")
        self.assertEqual({l.name for l in langs(system.domain("Combat"))}, {"Combat", "Core"})
        self.assertEqual(system.model.problems, [])

    def test_lookups_raise_on_missing_or_ambiguous_names(self):
        file = copy.deepcopy(GAME)
        domain(file, "d.unity")["name"] = "Core"
        system = read(file)
        with self.assertRaisesRegex(LookupError, "no Domain named 'Nothing'"):
            system.domain("Nothing")
        with self.assertRaisesRegex(LookupError, "2 Domains are named 'Core'"):
            system.domain("Core")

    def test_drops_references_to_nothing(self):
        file = copy.deepcopy(GAME)
        domain(file, "d.combat")["references"] = ["d.nowhere"]
        system = read(file)
        self.assertEqual(system.domain("Combat").references, [])
        self.assertEqual(len(system.model.problems), 1)


class Standard(unittest.TestCase):
    def test_concepts(self):
        system = load(EXAMPLES / "game.systemathic.json")
        self.assertTrue(pure(system.domain("Core")))
        self.assertFalse(pure(system.domain("Combat")))
        self.assertEqual([d.name for d in top_domains(system)], ["Core", "Combat", "Network"])
        self.assertTrue(abstract(system.domain("Combat")))
        self.assertFalse(abstract(system.language("Unity")))

    def test_the_game_is_only_incomplete(self):
        self.assertEqual(list(found(GAME)), ["completeness"])

    def test_opacity_and_top_domains(self):
        file = copy.deepcopy(GAME)
        domain(file, "d.combat")["languages"].append("unity")
        result = found(file)
        self.assertIn("Combat knows Unity, the Language it is carried out in", result["opacity"])
        self.assertIn("top_domains_abstract", result)

    def test_cycles(self):
        file = copy.deepcopy(GAME)
        domain(file, "d.core")["references"] = ["d.combat"]
        file["design"]["mediations"].append({"id": "back", "what": "d.unity", "how": "d.combat", "mediator": "d.combat-in-unity"})
        projection = copy.deepcopy(domain(file, "d.combat")["transformations"][0])
        projection.update(id="back.view", source="combat", target="core", entityMappings=[])
        domain(file, "d.combat")["transformations"].append(projection)
        result = found(file)
        self.assertEqual(result["domain_refs_acyclic"], ["reference themselves: Combat, Core"])
        self.assertEqual(result["mediation_acyclic"], ["carried out over themselves: Combat, Unity"])
        self.assertEqual(result["projection_acyclic"], ["projected into themselves: Combat, Core"])

    def test_warnings(self):
        file = copy.deepcopy(GAME)
        domain(file, "d.combat-in-unity")["languages"].append("core")
        unity = domain(file, "d.unity")
        unity["transformations"] = [dict(copy.deepcopy(domain(file, "d.combat")["transformations"][0]), id="u", source="unity", target="unity", entityMappings=[])]
        result = found(file)
        self.assertIn("CombatInUnity is a mediator with 3 Languages: Combat, Core, Unity", result["wide_mediator"])
        self.assertEqual(result["pure_domain_transformation"], ["Unity is pure, but holds 1 Transformation(s)"])

    def test_deferred_items_are_complete(self):
        file = copy.deepcopy(GAME)
        witness = domain(file, "d.combat-in-unity")["transformations"][0]
        witness["deferred"] = [{"interaction": "combat.attack"}]
        missing = found(file)["completeness"]
        self.assertEqual(missing, ["Combat as GameObjects leaves 1 item(s) of Combat neither mapped nor deferred"])

    def test_profiles(self):
        @rule(severity=ERROR)
        def nothing(system):
            """Finds nothing."""
            return []

        profile = Profile(*standard.rules, nothing, nothing)
        self.assertEqual(len(profile.rules), len(standard.rules) + 1)
        self.assertEqual(nothing.about, "Finds nothing.")
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
        self.assertEqual(found, [(1, "warning"), (4, "info"), (4, "warning")])
        self.assertEqual(next(r for r in result["rules"] if r["name"] == "lonely")["line"], 4)

    def test_finds_nothing_wrong_with_the_tool_designs_profile(self):
        self.assertEqual(assist.check(str(EXAMPLES / "tool-design.rules.py"))["problems"], [])

    def test_offers_symbols_with_their_documentation(self):
        symbols = {(s["name"], s["kind"]): s for s in assist.symbols()}
        self.assertIn("langs*(D)", symbols[("langs", "function")]["doc"])
        self.assertEqual(symbols[("domain", "method")]["detail"], "System.domain(self, name: 'str') -> 'Element'")
        self.assertIn(("references", "property"), symbols)
        self.assertEqual(symbols[("opacity", "rule")]["detail"], "standard rule, error")


class RuleHost(unittest.TestCase):
    def run_host(self, *args: str) -> dict:
        done = subprocess.run([sys.executable, "-m", "systemathic.host", *args], cwd=PYTHON, capture_output=True, text=True)
        return json.loads(done.stdout)

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
        self.assertEqual(result["violations"][0]["subjects"], ["d.core"])

    def test_describes_a_script(self):
        result = host.describe("std")
        self.assertEqual([p["name"] for p in result["profiles"]], ["standard"])
        self.assertEqual(len(result["rules"]), 9)

    def test_reports_an_unusable_script(self):
        result = self.run_host("run", "std", str(EXAMPLES / "game.systemathic.json"), "nope")
        self.assertIn("has no profile 'nope'", result["error"])


if __name__ == "__main__":
    unittest.main()
