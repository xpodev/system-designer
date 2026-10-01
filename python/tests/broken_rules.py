"""A script with one rule that raises, for the RuleHost's tests."""

from systemathic.core import *
from systemathic.std import *


@rule(severity=ERROR)
def explodes(system: System):
    """Raises instead of yielding."""
    raise RuntimeError("boom")


@rule(severity=WARNING)
def finds_core(system: System):
    """Finds the Core Domain."""
    yield Violation(system.domain("Core"), "found Core")


profile = Profile(explodes, finds_core)
