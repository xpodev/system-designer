"""Help for writing rule scripts: a minimal language server, run by the RuleHost.

    python -m systemathic.host check <script.py>     problems, rules and profiles, with lines
    python -m systemathic.host symbols               what a script can use, with documentation

`check` reports what keeps a script from running — a syntax error, an error raised while it
loads — and what is likely a mistake: a rule in no profile, no `profile` to verify with, a rule
that does not say what it checks. Lines and columns count from 1.
"""

from __future__ import annotations

import ast
import inspect
import traceback
from pathlib import Path
from typing import Any

from . import core, std
from ._schema import RELATIONSHIPS
from .std import Profile, Rule


def _problem(line: int, column: int, message: str, severity: str = "error", end_line: int | None = None, end_column: int | None = None) -> dict[str, Any]:
    return {
        "line": max(1, line),
        "column": max(1, column),
        "endLine": end_line or max(1, line),
        "endColumn": end_column or max(1, column) + 1,
        "message": message,
        "severity": severity,
    }


def line_in(error: BaseException, path: str) -> int | None:
    """The deepest line of `path` an exception passed through."""
    target = str(Path(path).resolve())
    lines = [frame.lineno for frame in traceback.extract_tb(error.__traceback__) if str(Path(frame.filename).resolve()) == target]
    return lines[-1] if lines else None


def check(path: str) -> dict[str, Any]:
    from .host import describe_module, module

    source = Path(path).read_text(encoding="utf-8")
    try:
        tree = ast.parse(source, filename=path)
    except SyntaxError as error:
        line = error.lineno or 1
        column = error.offset or 1
        return {"problems": [_problem(line, column, f"SyntaxError: {error.msg}", end_line=error.end_lineno, end_column=error.end_offset)], "rules": [], "profiles": []}

    try:
        script = module(path)
    except Exception as error:  # the script raised while loading
        line = line_in(error, path) or 1
        text = source.splitlines()[line - 1] if source.splitlines() else ""
        return {
            "problems": [_problem(line, len(text) - len(text.lstrip()) + 1, f"{type(error).__name__}: {error}", end_column=len(text) + 1)],
            "rules": [],
            "profiles": [],
        }

    described = describe_module(script)
    problems: list[dict[str, Any]] = []
    defined = {node.name: node for node in ast.walk(tree) if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))}
    in_profiles = {name for profile in described["profiles"] for name in profile["rules"]}
    for name, value in vars(script).items():
        if not isinstance(value, Rule) or value.function.__module__ != script.__name__:
            continue
        node = defined.get(name)
        line, column = (node.lineno, node.col_offset + 1) if node else (1, 1)
        if name not in in_profiles:
            problems.append(_problem(line, column, f"The rule {name} is in no profile, so it never runs.", "warning", end_column=column + 4 + len(name)))
        if not value.function.__doc__:
            problems.append(_problem(line, column, f"Say what {name} checks in a docstring: its first paragraph is how the rule reads in a specification, and the rest can say why it matters.", "info", end_column=column + 4 + len(name)))
    if not described["profiles"]:
        problems.append(_problem(1, 1, "There is no profile to verify with: add one, as in `profile = Profile(*standard_rules, my_rule)`.", "warning"))
    for rule in described["rules"]:
        node = defined.get(rule["name"])
        if node:
            rule["line"] = node.lineno
    return {"problems": problems, **described}


def _signature(value: Any) -> str:
    try:
        return str(inspect.signature(value))
    except (TypeError, ValueError):
        return ""


def _doc(value: Any) -> str:
    return inspect.cleandoc(value.__doc__ or "") if not isinstance(value, (str, int, float, tuple)) else ""


def symbols() -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()

    def add(name: str, kind: str, detail: str, doc: str, module: str) -> None:
        if (name, kind) in seen:
            return
        seen.add((name, kind))
        found.append({"name": name, "kind": kind, "detail": detail, "doc": doc, "module": module})

    for name in std.__all__:
        value = getattr(std, name)
        if isinstance(value, Rule):
            add(name, "rule", f"standard rule, {value.severity}", value.doc, "systemathic.std")
        elif isinstance(value, Profile):
            add(name, "constant", f"Profile of {len(value.rules)} rules", "Every standard rule, at its default severity.", "systemathic.std")
        elif inspect.isclass(value):
            add(name, "class", f"class {name}{_signature(value)}", _doc(value), "systemathic.std")
        elif callable(value):
            add(name, "function", f"{name}{_signature(value)}", _doc(value), "systemathic.std")
        elif isinstance(value, tuple):
            add(name, "constant", "the standard rules", "Every standard rule, for a Profile: `Profile(*standard_rules, …)`.", "systemathic.std")
        else:
            add(name, "constant", repr(value), "A severity." if name in ("ERROR", "WARNING") else "", "systemathic.std")
    for name in ("load", "read"):
        value = getattr(core, name)
        add(name, "function", f"{name}{_signature(value)}", _doc(value), "systemathic.core")
    for name in ("System", "Element"):
        add(name, "class", f"class {name}", _doc(getattr(core, name)), "systemathic.core")
    for name in ("language", "domain", "element", "all"):
        value = getattr(core.System, name)
        add(name, "method", f"System.{name}{_signature(value)}", _doc(value), "systemathic.core")
    # Every end a script can navigate, from the schema: `domain.languages`, `end.min`, …
    for _, a, b in RELATIONSHIPS:
        for near, far in ((a, b), (b, a)):
            many = far[3] is None or far[3] > 1
            add(far[0], "property", f"{near[1]}.{far[0]} → {'list of ' if many else ''}{far[1]}", f"From a {near[1]}: {'its' if not many else 'the'} {far[1]}{'s' if many else ''} through `{far[0]}`.", "systemathic.core")
    add("text", "property", "Formula.text → str", "A Formula's text, in the ASCII syntax.", "systemathic.core")
    add("id", "property", "Element.id → str", "The Element's id in the System file.", "systemathic.core")
    add("kind", "property", "Element.kind → str", "Which Entity of the Systemathic Languages the Element is: 'Domain', 'Language', …", "systemathic.core")
    return found
