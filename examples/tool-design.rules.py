"""The verification profile of the tool's own design (docs/tool-design.md, "Verification profile").

    python -m systemathic.host run examples/tool-design.rules.py examples/tool-design.systemathic.json

Every standard rule, at its default severity, plus the design's own rules.
"""

from systemathic.core import *
from systemathic.std import *

CORE_LAYERS = ["Kernel", "Contexts", "Operations", "Std"]
CLIENTS = ["UI", "MCP", "CLI"]
EDITORS = [
    "SystemEditor", "LanguageEditor", "EntityEditor", "RelationshipEditor", "FormulaEditor", "DomainEditor",
    "TransformationEditor", "MediationEditor", "InteractionEditor", "InteractionMappingEditor", "StdEditor",
]


def reachable(domain):
    """The Domains a Domain references, transitively."""
    found, pending = set(), list(domain.references)
    while pending:
        current = pending.pop()
        if current not in found:
            found.add(current)
            pending.extend(current.references)
    return found


@rule(severity=ERROR)
def kernel_is_pure(system: System):
    """Kernel references only the Kernel Language, and no Domain."""
    kernel = system.domain("Kernel")
    if kernel.languages != [system.language("Kernel")] or kernel.references:
        yield Violation(kernel, "Kernel must reference only the Kernel Language, and no Domain")


@rule(severity=ERROR)
def layers_extend_down(system: System):
    """Kernel, Contexts, Operations and Std each reference only the layer below them."""
    for below, layer in zip([None, *CORE_LAYERS], CORE_LAYERS):
        domain = system.domain(layer)
        expected = [] if below is None else [system.domain(below)]
        if domain.references != expected:
            yield Violation(domain, f"{layer} must reference {below or 'no Domain'}, and only it")


@rule(severity=ERROR)
def no_god_domain(system: System):
    """Every Domain that is not a mediator references exactly one Language of its own."""
    for domain in system.domains:
        if domain not in mediators(system) and len(domain.languages) != 1:
            yield Violation(domain, f"{domain.name} references {len(domain.languages)} Languages of its own")


@rule(severity=ERROR)
def core_knows_nothing(system: System):
    """No Transformation that is not an inclusion has a core layer as its target."""
    core = {system.language(name) for name in CORE_LAYERS}
    core_domains = {system.domain(name) for name in CORE_LAYERS}
    for domain in system.domains:
        for transformation in domain.transformations:
            inclusion = transformation.source in core and domain in core_domains
            if transformation.target in core and not inclusion:
                yield Violation(transformation, f"{transformation.name} makes {transformation.target.name} know {transformation.source.name}")


@rule(severity=ERROR)
def clients_are_hows(system: System):
    """UI, MCP and CLI are never the "what" of a Mediation, and no Domain references them."""
    clients = {system.domain(name) for name in CLIENTS}
    for mediation in system.mediations:
        if mediation.what in clients:
            yield Violation([mediation, mediation.what], f"{mediation.what.name} is the what of a Mediation")
    for domain in system.domains:
        for client in clients & set(domain.references):
            yield Violation([domain, client], f"{domain.name} references the client {client.name}")


@rule(severity=ERROR)
def checking_is_not_editing(system: System):
    """Diagnoser and Verifier reference neither Editing nor any concept editor."""
    editing = {system.domain(name) for name in ["Editing", *EDITORS]}
    for name in ["Diagnoser", "Verifier"]:
        checker = system.domain(name)
        for found in reachable(checker) & editing:
            yield Violation([checker, found], f"{name} reaches {found.name}")


@rule(severity=ERROR)
def editors_follow_layers(system: System):
    """A concept editor references only Editing and one core layer."""
    editing = system.domain("Editing")
    layers = {system.domain(name) for name in CORE_LAYERS}
    for name in EDITORS:
        editor = system.domain(name)
        others = [d for d in editor.references if d is not editing]
        if editing not in editor.references or len(others) != 1 or others[0] not in layers:
            yield Violation(editor, f"{name} must reference Editing and exactly one core layer")


profile = Profile(
    *standard_rules,
    kernel_is_pure,
    layers_extend_down,
    no_god_domain,
    core_knows_nothing,
    clients_are_hows,
    checking_is_not_editing,
    editors_follow_layers,
)
