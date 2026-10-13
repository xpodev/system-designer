"""The rule profile of the tool's own design (docs/system-designer.systemathic.json).

    python -m systemathic.host run docs/system-designer.rules.py docs/system-designer.systemathic.json

Every standard rule, plus the design's own: what the descriptions of the System say about its
shape, stated so that a change that breaks it is found. Names of Components are this design's;
the rules are its, not the tool's. What implements each seam is read from the design.
"""

from systemathic.core import *
from systemathic.std import *

#: The language package, its Languages layered bottom up.
CORE = "Systemathic"
LAYERS = ["Kernel", "Functions", "Contexts", "Deployment", "Mediation", "Systems"]

#: Components that are only a vocabulary: Languages that others share without depending on each other.
VOCABULARIES = [
    "Systemathic", "Systemathic Subjects", "Systemathic Metadata", "Systemathic Verification",
    "Systemathic StdLib", "Documentation", "By Value", "Configurations", "Editing", "Views",
]

#: Every seam that could be done more than one way: the interfaces the design implements.
INTERFACES = [
    "Repository", "Metadata Provider", "Edit Kind", "Edit Listener", "Source", "Perspective Kind",
    "Specification Format", "Systemathic Verifier",
]

#: The concept editors, bottom up, each with the Systemathic Language it edits.
EDITORS = [
    ("Kernel Editor", "Kernel"), ("Functions Editor", "Functions"), ("Contexts Editor", "Contexts"),
    ("Deployment Editor", "Deployment"), ("Mediation Editor", "Mediation"), ("Systems Editor", "Systems"),
]

#: The parts that read a System, and what reading must never reach — each with its implementations.
READERS = [
    "Views", "Perspective Kind", "Perspectives", "Diagnoser", "Exporter", "Specification Format",
    "Documentation Writer", "Systemathic Verifier",
]
WRITERS = ["Workspace", "Editor", "Edit Kind", "Edit Listener"]

#: Where Systems are stored, and the metadata it must know nothing of — each with its implementations.
STORAGE = ["Repository"]
METADATA = ["Systemathic Metadata", "Metadata Provider", "Documentation", "By Value", "Configurations"]

CLIENTS = ["UI", "MCP Server", "CLI", "API"]


def with_implementations(system: System, names: list[str]) -> list[Element]:
    """The named Components, and every Component implementing any of them."""
    found: list[Element] = []
    for name in names:
        component = system.component(name)
        for each in [component, *implementations(component)]:
            if each not in found:
                found.append(each)
    return found


def reach(component: Element) -> list[Element]:
    """The Components a Component depends on, transitively: what it imports, and what that imports."""
    found: list[Element] = []
    pending = dependencies(component)
    while pending:
        current = pending.pop(0)
        if current not in found and current is not component:
            found.append(current)
            pending.extend(dependencies(current))
    return found


def _unreachable(system: System, sources: list[str], forbidden: list[str], why: str):
    banned = set(with_implementations(system, forbidden))
    for component in with_implementations(system, sources):
        for found in reach(component):
            if found in banned:
                yield Violation([component, found], f"{component.name} reaches {found.name}: {why}")


@rule(severity=ERROR)
def core_is_pure(system: System):
    """The language package imports and uses nothing, and its Languages are one chain, Kernel to Systems.

    The core is the math only. Every tool feature is a Component of its own that imports it; the
    core never knows one. Each layer extends exactly the one below it, so a consumer can stop at the
    layer it needs.
    """
    core = system.component(CORE)
    if dependencies(core) or core.uses:
        yield Violation(core, f"{CORE} must import and use nothing")
    names = [language.name for language in core.languages]
    if sorted(names) != sorted(LAYERS):
        yield Violation(core, f"{CORE} must hold exactly {', '.join(LAYERS)}, not {', '.join(names)}")
    for below, name in zip([None, *LAYERS], LAYERS):
        language = next((l for l in core.languages if l.name == name), None)
        if language is None:
            continue
        expected = [] if below is None else [below]
        if sorted(l.name for l in language.extends) != expected:
            yield Violation(language, f"{name} must extend {below or 'nothing'}, and only it")


@rule(severity=ERROR)
def vocabulary_only(system: System):
    """A vocabulary Component holds Languages and nothing that acts: no Interactions, Transformations, Mediums or Deployments.

    Editing, Views, Subjects, Metadata and the like are on their own so that the parts sharing
    them need not depend on each other. Anything that acts belongs to a part that imports them.
    """
    for name in VOCABULARIES:
        component = system.component(name)
        if not component.languages:
            yield Violation(component, f"{name} is a vocabulary with no Language")
        acting = [*component.interactions, *component.transformations, *component.mediums, *component.deployments]
        if acting:
            yield Violation([component, *acting], f"{name} is a vocabulary, but has {', '.join(e.name for e in acting)}")


@rule(severity=ERROR)
def editing_knows_no_core(system: System):
    """Editing reaches nothing: it knows no concept of the core.

    The kinds of Edit are Entities extending Edit in the editors' Languages; Editing itself is
    only Targets, Sessions, History and Edits, so any Language can be edited the same way.
    """
    yield from _unreachable(system, ["Editing"], [CORE, *VOCABULARIES], "Editing must know no other Language")


@rule(severity=ERROR)
def readers_dont_edit(system: System):
    """Nothing that reads a System — Views, Perspectives, Diagnoser, Exporter, Formats, Writer, Verifier — reaches anything that changes one.

    Readers take a System, not a Target. They may speak of Edits (a Suggestion carries the Edit that
    fixes it), so the Editing vocabulary is theirs to use; the Editor, the Edit Kinds and the
    Workspace are not.
    """
    yield from _unreachable(system, READERS, WRITERS, "a reader must not reach what edits")


@rule(severity=ERROR)
def repository_knows_no_metadata(system: System):
    """The Repository and its implementations reach no metadata, nor any Metadata Provider.

    A Repository stores the design only. Each provider stores and loads its own metadata, its own
    way; the Workspace asks both.
    """
    yield from _unreachable(system, STORAGE, METADATA, "the Repository stores the design only")


@rule(severity=ERROR)
def workspace_joins_storage(system: System):
    """Only the Workspace imports both the Repository and the Metadata Provider.

    Opening and saving a System is reading the design and asking every provider; that is the
    Workspace's whole job, and no other part may do it on the side.
    """
    repository, provider = system.component("Repository"), system.component("Metadata Provider")
    for component in system.all("Component"):
        if component.name != "Workspace" and {repository, provider} <= set(component.importedComponents):
            yield Violation(component, f"{component.name} imports both the Repository and the Metadata Provider")


@rule(severity=ERROR)
def clients_are_hows(system: System):
    """No Component imports a client, clients offer no Interactions, and no Connection goes to one.

    The UI, the MCP server, the CLI and the API are ways in. They are told of Edits only as Edit
    Listeners, an interface they implement; nothing calls a client by name.
    """
    clients = [system.component(name) for name in CLIENTS]
    for component in system.all("Component"):
        for client in set(component.importedComponents) & set(clients):
            yield Violation([component, client], f"{component.name} imports the client {client.name}")
    for client in clients:
        if client.interactions:
            yield Violation([client, *client.interactions], f"{client.name} is a client, but offers Interactions")
    for connection in system.all("Connection"):
        target = connection.to.of if connection.to is not None else connection.toComponent
        if target in clients:
            yield Violation(connection, f"a Connection goes to the client {target.name}")


@rule(severity=ERROR)
def every_interface_implemented(system: System):
    """Every seam offers Interactions and has an implementation; each implementation uses the Languages of its Interactions; and only the seams are implemented.

    The tool is defined at its seams, and its own implementations plug in the way anyone else's
    would. A seam nobody implements is a hole; an implementation that cannot speak its
    interface's Languages is not one; a Component implemented but not named a seam here is a
    seam this profile does not know of.
    """
    seams = [system.component(name) for name in INTERFACES]
    for interface in seams:
        if not interface.interactions:
            yield Violation(interface, f"{interface.name} is an interface, but offers no Interaction")
        found = interface.implementations
        if not found:
            yield Violation(interface, f"{interface.name} is an interface nobody implements")
        languages = {i.language for i in interface.interactions if i.language is not None}
        for implementation in found:
            spoken = {l for used in implementation.uses for l in vocab(used)}
            for language in languages - spoken:
                yield Violation([implementation, language], f"{implementation.name} implements {interface.name}, but does not use {language.name}")
            if implementation in reach(interface):
                yield Violation([interface, implementation], f"{interface.name} depends on its implementation {implementation.name}")
    for component in system.all("Component"):
        if component.implementations and component not in seams:
            yield Violation(component, f"{component.name} is implemented, but is not one of the design's seams")


@rule(severity=ERROR)
def editors_follow_layers(system: System):
    """Each concept editor implements Edit Kind, and its Language extends the editor's below it and speaks its own Systemathic layer.

    So an editor covers a whole Language with its extensions, and the editors stack exactly as the
    Languages they edit do.
    """
    below = system.language("Editing")
    for editor_name, layer_name in EDITORS:
        editor = system.component(editor_name)
        own = editor.languages
        if len(own) != 1:
            yield Violation(editor, f"{editor_name} must hold exactly one Language, its kinds of Edit")
            continue
        language = own[0]
        if system.component("Edit Kind") not in editor.implements:
            yield Violation(editor, f"{editor_name} must implement Edit Kind")
        if below not in language.extends:
            yield Violation([language, below], f"{language.name} must extend {below.name}")
        if system.language(layer_name) not in vocab(language):
            yield Violation(language, f"{language.name} must speak {layer_name}")
        below = language


profile = Profile(
    *standard_rules,
    core_is_pure,
    vocabulary_only,
    editing_knows_no_core,
    readers_dont_edit,
    repository_knows_no_metadata,
    workspace_joins_storage,
    clients_are_hows,
    every_interface_implemented,
    editors_follow_layers,
)
