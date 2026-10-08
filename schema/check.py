"""Check Languages, given as data, against the kernel (docs/foundation.md, Part I).

    python schema/check.py [directory or file]      (default: this directory)

A Language may extend other Languages: its vocabulary is then its own together with
theirs, transitively. Each Language is checked against its vocabulary: every extended
Language exists, nothing it defines is already defined, every end's Entity is known, every range is well-formed, end names are unique per Entity (W3), and every
axiom is a well-formed, well-typed formula — every variable bound, every navigation
step a reachable end, and both sides of every comparison of the same Entity. Then all the
Languages together, as a System is a model of their union: every Entity is defined once,
and end names are unique per Entity across all of them.
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path


# -- kernel structure --------------------------------------------------------------------

@dataclass(frozen=True)
class End:
    name: str
    entity: str
    range: str


def parse_range(text: str) -> tuple[int, int | None]:
    match = re.fullmatch(r"(\d+)\.\.(\d+|N)", text)
    if not match:
        raise ValueError(f"malformed range {text!r}")
    low, high = match.groups()
    return int(low), None if high == "N" else int(high)


def navigation(relationships: list[tuple[End, End]]) -> dict[str, dict[str, list[End]]]:
    """For each Entity, the ends reachable from it by name: the far end of every
    Relationship one of whose ends is at that Entity."""
    table: dict[str, dict[str, list[End]]] = {}
    for a, b in relationships:
        for near, far in ((a, b), (b, a)):
            table.setdefault(near.entity, {}).setdefault(far.name, []).append(far)
    return table


# -- formulas ----------------------------------------------------------------------------

TOKEN = re.compile(r"\s*(?:(=>|==|!=)|(\.(?=[A-Za-z^*]))|(\.)|([(),^*])|([A-Za-z_]\w*))")
KEYWORDS = {"all", "some", "no", "in", "and", "or", "not"}


def tokenize(text: str) -> list[str]:
    tokens, pos = [], 0
    text = text.rstrip()
    while pos < len(text):
        match = TOKEN.match(text, pos)
        if not match or match.end() == pos:
            raise SyntaxError(f"unexpected character at {pos}: {text[pos:pos + 10]!r}")
        op, step, sep, punct, word = match.groups()
        tokens.append(op or ("STEP" if step else None) or ("SEP" if sep else None) or punct or word)
        pos = match.end()
    return tokens


class FormulaChecker:
    """Recursive-descent parser that type-checks as it parses."""

    def __init__(self, text: str, entities: set[str], nav: dict[str, dict[str, list[End]]]):
        self.tokens = tokenize(text)
        self.i = 0
        self.entities = entities
        self.nav = nav

    def peek(self) -> str | None:
        return self.lookahead(0)

    def lookahead(self, n: int) -> str | None:
        return self.tokens[self.i + n] if self.i + n < len(self.tokens) else None

    def take(self, expected: str | None = None) -> str:
        token = self.peek()
        if token is None or (expected is not None and token != expected):
            raise SyntaxError(f"expected {expected or 'more input'}, got {token!r}")
        self.i += 1
        return token

    def check(self) -> None:
        self.formula({})
        if self.peek() is not None:
            raise SyntaxError(f"unexpected {self.peek()!r}")

    def formula(self, env: dict[str, str]) -> None:
        self.disjunction(env)
        if self.peek() == "=>":
            self.take()
            self.formula(env)

    def disjunction(self, env: dict[str, str]) -> None:
        self.conjunction(env)
        while self.peek() == "or":
            self.take()
            self.conjunction(env)

    def conjunction(self, env: dict[str, str]) -> None:
        self.unary(env)
        while self.peek() == "and":
            self.take()
            self.unary(env)

    def unary(self, env: dict[str, str]) -> None:
        token = self.peek()
        if token == "not":
            self.take()
            self.unary(env)
        elif token == "no" or (token == "some" and self.lookahead(2) != "in"):
            self.take()
            self.path(env)
        elif token in ("all", "some"):
            self.take()
            inner = dict(env)
            while True:
                name = self.take()
                if name in KEYWORDS or not name.isidentifier():
                    raise SyntaxError(f"bad variable {name!r}")
                self.take("in")
                inner[name] = self.path(inner)
                if self.peek() != ",":
                    break
                self.take(",")
            self.take("SEP")
            self.formula(inner)
        elif token == "(":
            self.take()
            self.formula(env)
            self.take(")")
        else:
            self.atom(env)

    def atom(self, env: dict[str, str]) -> None:
        left = self.path(env)
        op = self.take()
        if op not in ("==", "!=", "in"):
            raise SyntaxError(f"expected ==, != or in, got {op!r}")
        right = self.path(env)
        if left != right:
            raise TypeError(f"compares {left} with {right}")

    def path(self, env: dict[str, str]) -> str:
        head = self.take()
        if head in env:
            kind = env[head]
        elif head in self.entities:
            kind = head
        else:
            raise NameError(f"unbound name {head!r}")
        while self.peek() == "STEP":
            self.take()
            closure = self.take() if self.peek() in ("^", "*") else None
            name = self.take()
            ends = self.nav.get(kind, {}).get(name)
            if not ends:
                raise NameError(f"{kind} has no end {name!r}")
            target = ends[0].entity
            if closure and target != kind:
                raise TypeError(f"closure over {kind}.{name} leaves {kind}")
            kind = target
        return kind


# -- the check ---------------------------------------------------------------------------

Relationships = dict[str, tuple[End, End]]


def vocabulary(name: str, library: dict[str, dict], problems: list[str],
               seen: tuple[str, ...] = ()) -> tuple[set[str], Relationships]:
    """A Language's vocabulary: its own Entities and Relationships, and, transitively, those
    of every Language it extends. Relationships keep the identity of the Language that
    declared them, so one reached by two paths is still one Relationship."""
    if name in seen:
        problems.append(f"extension cycle: {' -> '.join(seen + (name,))}")
        return set(), {}
    language = library[name]
    entities = set(language["entities"])
    relationships: Relationships = {}
    for index, relationship in enumerate(language["relationships"]):
        ends = [End(**end) for end in relationship["ends"]]
        if len(ends) != 2:
            problems.append(f"{name} relationship {index}: has {len(ends)} ends, not 2")
            continue
        relationships[f"{name}#{index}"] = (ends[0], ends[1])
    for base in language.get("extends", []):
        if base not in library:
            problems.append(f"{name} extends unknown Language {base!r}")
            continue
        base_entities, base_relationships = vocabulary(base, library, problems if not seen else [], seen + (name,))
        for entity in language["entities"]:
            if entity in base_entities:
                problems.append(f"{name} redefines {entity!r}, which {base} already has")
        entities |= base_entities
        relationships.update(base_relationships)
    return entities, relationships


def check_union(library: dict[str, dict]) -> list[str]:
    """The Languages together are what a System is a model of: across all of them, every
    Entity is defined once, and end names stay unique per Entity (W3)."""
    problems: list[str] = []
    owners: dict[str, str] = {}
    relationships: list[tuple[End, End]] = []
    for name, language in library.items():
        for entity in language["entities"]:
            if entity in owners:
                problems.append(f"{entity!r} is defined by both {owners[entity]} and {name}")
            owners[entity] = name
        relationships += [(End(**r["ends"][0]), End(**r["ends"][1])) for r in language["relationships"] if len(r["ends"]) == 2]
    for entity, reachable in sorted(navigation(relationships).items()):
        for end_name, ends in sorted(reachable.items()):
            if len(ends) > 1:
                problems.append(f"W3 across the Languages: {entity} reaches {len(ends)} ends named {end_name!r}")
    return problems


def check(language: dict, library: dict[str, dict] | None = None) -> list[str]:
    library = dict(library or {})
    library[language["language"]] = language
    problems: list[str] = []
    entities, relationships = vocabulary(language["language"], library, problems)

    for key, (a, b) in relationships.items():
        if not key.startswith(language["language"] + "#"):
            continue
        for end in (a, b):
            if end.entity not in entities:
                problems.append(f"{key}: end {end.name!r} is of undeclared Entity {end.entity!r}")
            try:
                low, high = parse_range(end.range)
                if high is not None and low > high:
                    problems.append(f"{key}: end {end.name!r} has min > max")
            except ValueError as error:
                problems.append(f"{key}: {error}")

    nav = navigation(list(relationships.values()))
    for entity, reachable in sorted(nav.items()):
        for name, ends in sorted(reachable.items()):
            if len(ends) > 1:
                problems.append(f"W3: {entity} reaches {len(ends)} ends named {name!r}")

    for axiom in language.get("axioms", []):
        try:
            FormulaChecker(axiom["formula"], entities, nav).check()
        except (SyntaxError, NameError, TypeError) as error:
            problems.append(f"axiom {axiom['id']} ({axiom['about']}): {error}")

    return problems


def main() -> int:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent
    files = sorted(target.glob("*.json")) if target.is_dir() else [target]
    library = {}
    for path in files:
        language = json.loads(path.read_text(encoding="utf-8"))
        library[language["language"]] = language
    failed = False
    for name, language in library.items():
        problems = check(language, library)
        for problem in problems:
            print(f"  {problem}")
        counts = f"{len(language['entities'])} entities, {len(language['relationships'])} relationships, {len(language.get('axioms', []))} axioms"
        extends = ", ".join(language.get("extends", [])) or "nothing"
        print(f"{name}: {counts}, extends {extends} - {'well-formed' if not problems else f'{len(problems)} problem(s)'}")
        failed = failed or bool(problems)
    if len(library) > 1:
        problems = check_union(library)
        for problem in problems:
            print(f"  {problem}")
        print(f"all together: {'well-formed' if not problems else f'{len(problems)} problem(s)'}")
        failed = failed or bool(problems)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
