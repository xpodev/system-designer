"""The rule profile of the tool's own design (docs/system-designer.systemathic.json).

    python -m systemathic.host run docs/system-designer.rules.py docs/system-designer.systemathic.json

Every standard rule, plus the design's own: what the descriptions of the System say about its
shape, stated so that a change that breaks it is found. Names of Components are this design's;
the rules are its, not the tool's. What implements each seam is read from the design: a
Deployment of the seam, kept in the Component whose code it is.
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
    "Kernel Edits", "Functions Edits", "Contexts Edits", "Deployment Edits", "Mediation Edits", "Systems Edits",
    "Documentation Edits", "By Value Edits", "Configuration Edits",
]

#: Every seam that could be done more than one way: the interfaces the design implements.
INTERFACES = [
    "Repository", "Metadata Provider", "Edit Kind", "Edit Listener", "Source", "Perspective Kind",
    "Specification Format", "Systemathic Verifier",
]

#: The concept editors, bottom up, each with the vocabulary of its kinds of Edit and the Systemathic Language it edits.
EDITORS = [
    ("Kernel Editor", "Kernel Edits", "Kernel"), ("Functions Editor", "Functions Edits", "Functions"),
    ("Contexts Editor", "Contexts Edits", "Contexts"), ("Deployment Editor", "Deployment Edits", "Deployment"),
    ("Mediation Editor", "Mediation Edits", "Mediation"), ("Systems Editor", "Systems Edits", "Systems"),
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


def implementers(component: Element) -> list[Element]:
    """The Components that keep a Deployment of it: where each of its implementations is kept, other than itself."""
    return list(dict.fromkeys(d.keeper for d in implementations(component) if d.keeper is not None and d.keeper is not component))


def with_implementations(system: System, names: list[str]) -> list[Element]:
    """The named Components, and every Component keeping an implementation of any of them."""
    found: list[Element] = []
    for name in names:
        component = system.component(name)
        for each in [component, *implementers(component)]:
            if each not in found:
                found.append(each)
    return found


def implemented(component: Element) -> list[Element]:
    """The boxes a Component keeps Deployments of, other than itself: what it implements."""
    return [d.component for d in component.kept if d.component is not None and d.component is not component]


def importers(system: System) -> list[Element]:
    """Everything that imports: every Component, for its vocabulary, and every Deployment, for its needs."""
    return [*system.all("Component"), *system.all("Deployment")]


def owner(importer: Element) -> Element:
    """The Component an importer's code is in: itself, or the keeper of a Deployment."""
    return importer.keeper if importer.kind == "Deployment" else importer


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
    for importer in importers(system):
        if owner(importer).name != "Workspace" and {repository, provider} <= set(imported_components(importer)):
            yield Violation(importer, f"{importer.name} imports both the Repository and the Metadata Provider")


@rule(severity=ERROR)
def clients_are_hows(system: System):
    """No Component imports a client, clients offer no Interactions, and no Connection goes to one.

    The UI, the MCP server, the CLI and the API are ways in. They are told of Edits only as Edit
    Listeners, an interface they implement; nothing calls a client by name.
    """
    clients = [system.component(name) for name in CLIENTS]
    for importer in importers(system):
        for client in set(imported_components(importer)) & set(clients):
            if owner(importer) is not client:
                yield Violation([importer, client], f"{importer.name} imports the client {client.name}")
    for client in clients:
        if client.interactions:
            yield Violation([client, *client.interactions], f"{client.name} is a client, but offers Interactions")
    for connection in system.all("Connection"):
        if connection.to is not None:
            target = connection.to.of
        elif connection.toIdentity is not None and connection.toIdentity.steps:
            target = connection.toIdentity.steps[-1].instance.of
        else:
            target = connection.toComponent
        if target in clients:
            yield Violation(connection, f"a Connection goes to the client {target.name}")


@rule(severity=ERROR)
def clients_import_interfaces(system: System):
    """Clients import no implementation: nothing a client, or a Deployment of one, imports from keeps an implementation of something else.

    Importing an interface is to implement it or to consume it; importing an implementation is to
    take part in it. A client takes part in no implementation: it speaks the tool's Languages and
    calls its seams, and whatever a Language of Edits is, it is a vocabulary it imports, not a
    Store or an Editor.
    """
    clients = [system.component(name) for name in CLIENTS]
    for importer in importers(system):
        if owner(importer) not in clients:
            continue
        for source in imported_components(importer):
            implemented = [d.component for d in source.kept if d.component is not None and d.component is not source]
            if implemented:
                yield Violation([importer, source], f"{importer.name} imports from {source.name}, an implementation of {', '.join(sorted(str(c.name) for c in implemented))}")


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
        found = implementers(interface)
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
        if implementers(component) and component not in seams:
            yield Violation(component, f"{component.name} is implemented, but is not one of the design's seams")


@rule(severity=ERROR)
def editors_follow_layers(system: System):
    """Each concept editor implements Edit Kind and uses its kinds of Edit, a vocabulary of their own, whose Language extends the editor's below it and speaks its own Systemathic layer.

    So an editor covers a whole Language with its extensions, and the editors stack exactly as the
    Languages they edit do. The kinds of Edit are a vocabulary, not the editor's, so that clients
    speak them without taking part in the editor.
    """
    below = system.language("Editing")
    for editor_name, edits_name, layer_name in EDITORS:
        editor = system.component(editor_name)
        own = system.component(edits_name).languages
        if len(own) != 1:
            yield Violation(editor, f"{edits_name} must hold exactly one Language, {editor_name}'s kinds of Edit")
            continue
        language = own[0]
        if language not in editor.uses:
            yield Violation([editor, language], f"{editor_name} must use {language.name}, its kinds of Edit")
        if system.component("Edit Kind") not in implemented(editor):
            yield Violation(editor, f"{editor_name} must implement Edit Kind")
        if below not in language.extends:
            yield Violation([language, below], f"{language.name} must extend {below.name}")
        if system.language(layer_name) not in vocab(language):
            yield Violation(language, f"{language.name} must speak {layer_name}")
        below = language


profile = Profile(
    *standard_rules,
    # The tool routes each call to the one occupant of a fan-out for its kind — the Edit Kind for an
    # Edit, the Format for a rendering, the Source for a path — and the model has no way yet to say
    # so: a dispatch, not a broadcast. Until it does, a reply from a fan-out is a warning here
    # (docs/roadmap.md, *Open in the design*).
    fan_out_silent.at(WARNING),
    core_is_pure,
    vocabulary_only,
    editing_knows_no_core,
    readers_dont_edit,
    repository_knows_no_metadata,
    workspace_joins_storage,
    clients_are_hows,
    clients_import_interfaces,
    every_interface_implemented,
    editors_follow_layers,
)
