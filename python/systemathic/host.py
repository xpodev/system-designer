"""The RuleHost (docs/tool-design.md, `Verifier / Python`): runs a script's profile on a System.

    python -m systemathic.host describe <script.py>
    python -m systemathic.host run <script.py> <system file> [profile]
    python -m systemathic.host check <script.py>
    python -m systemathic.host symbols

A script is a module: `Script ↦` module, `Rule ↦` function, `Violation ↦` a yielded object.
Its profiles are its module-level `Profile`s, by variable name; `profile` is the default. The
script may be `std`, which is systemathic.std itself, with the profile `standard`.

Every command prints one JSON object. `describe` gives the script's rules and profiles; `run`
gives every Violation, with the ids of its subjects, and every rule that raised instead of
yielding, with the script's line it raised at, so one broken rule does not hide the others.
`check` and `symbols` help write scripts (see systemathic.assist).
"""

from __future__ import annotations

import importlib.util
import json
import sys
import traceback
from pathlib import Path
from types import ModuleType

from . import assist, std
from .core import load
from .std import Profile, Rule


def module(path: str) -> ModuleType:
    if path == "std":
        return std
    file = Path(path).resolve()
    spec = importlib.util.spec_from_file_location(f"systemathic_script_{abs(hash(str(file)))}", file)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {path}")
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


def profiles(script: ModuleType) -> dict[str, Profile]:
    return {name: value for name, value in vars(script).items() if isinstance(value, Profile)}


def rules(script: ModuleType) -> list[Rule]:
    """Every rule the script defines or uses, in order of appearance in its profiles, then its own."""
    found: dict[str, Rule] = {}
    for profile in profiles(script).values():
        for each in profile.rules:
            found.setdefault(each.name, each)
    for value in vars(script).values():
        if isinstance(value, Rule):
            found.setdefault(value.name, value)
    return list(found.values())


def describe(path: str) -> dict:
    return describe_module(module(path))


def describe_module(script: ModuleType) -> dict:
    return {
        "rules": [{"name": r.name, "severity": r.severity, "about": r.about, "doc": r.doc, "script": _origin(r)} for r in rules(script)],
        # A profile may run a rule at another severity than the rule's own (`completeness.at(ERROR)`).
        "profiles": [
            {"name": name, "rules": [r.name for r in p.rules], "severities": {r.name: r.severity for r in p.rules}}
            for name, p in profiles(script).items()
        ],
    }


def run(path: str, system_file: str, profile_name: str | None = None) -> dict:
    script = module(path)
    available = profiles(script)
    name = profile_name or ("standard" if path == "std" else "profile")
    if name not in available:
        raise LookupError(f"{path} has no profile {name!r}; it has {', '.join(available) or 'none'}")
    system = load(system_file)
    violations, failures = [], []
    for each in available[name].rules:
        try:
            for violation in each(system):
                violations.append({
                    "rule": each.name,
                    "severity": each.severity,
                    "message": violation.message,
                    "subjects": [element.id for element in violation.elements],
                })
        except Exception as error:  # a broken rule is reported, and the others still run
            failure = {"rule": each.name, "error": traceback.format_exc(limit=4)}
            line = assist.line_in(error, path) if path != "std" else None
            if line is not None:
                failure["line"] = line
            failures.append(failure)
    return {
        "profile": name,
        "rules": [{"name": r.name, "severity": r.severity, "about": r.about, "doc": r.doc, "script": _origin(r)} for r in available[name].rules],
        "violations": violations,
        "failures": failures,
    }


def _origin(each: Rule) -> str:
    return "std" if each.function.__module__ == std.__name__ else "script"


def main(argv: list[str]) -> int:
    try:
        if len(argv) == 2 and argv[0] == "describe":
            result = describe(argv[1])
        elif len(argv) in (3, 4) and argv[0] == "run":
            result = run(argv[1], argv[2], argv[3] if len(argv) == 4 else None)
        elif len(argv) == 2 and argv[0] == "check":
            result = assist.check(argv[1])
        elif len(argv) == 1 and argv[0] == "symbols":
            result = {"symbols": assist.symbols()}
        else:
            print(__doc__, file=sys.stderr)
            return 2
    except Exception as error:  # the script or the file could not be used at all
        print(json.dumps({"error": f"{type(error).__name__}: {error}"}))
        return 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
