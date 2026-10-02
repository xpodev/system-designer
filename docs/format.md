# The System file format

A System file is `Tool::System / JSON` (see [tool-design.md](tool-design.md)): the tool's
stored form of a System, in JSON, so that any program in any language can read and write
it. It is identified by `"format": "systemathic/1"`.

## Shape

```json
{
  "format": "systemathic/1",
  "design": {
    "id": "game", "name": "Game",
    "languages": [
      {
        "id": "core", "name": "Core",
        "entities": [{ "id": "core.monster", "name": "Monster" }],
        "relationships": [
          { "id": "core.pack", "ends": [
            { "id": "core.pack.leader",    "name": "leader",    "entity": "core.monster", "min": 0, "max": 1 },
            { "id": "core.pack.followers", "name": "followers", "entity": "core.monster", "min": 0, "max": "N" } ] }
        ],
        "formulas": [{ "id": "core.acyclic", "text": "all m in Monster. not m in m.^leader", "constrains": "core.pack" }],
        "interactions": [
          { "id": "combat.attack", "name": "attack",
            "parameters": [{ "id": "combat.attack.attacker", "name": "attacker", "type": "combat.attacker" }],
            "output": "combat.damage", "primary": "combat.attack.attacker", "compares": [] }
        ]
      }
    ],
    "domains": [
      { "id": "d.combat", "name": "Combat", "languages": ["combat"], "references": ["d.core"],
        "transformations": [
          { "id": "combat.view", "name": "Monsters in combat", "source": "core", "target": "combat",
            "reverse": null,
            "entityMappings": [{ "source": "core.monster", "targets": ["combat.targetable", "combat.attacker"] }],
            "relationshipMappings": [],
            "interactionMappings": [],
            "deferred": [{ "entity": "core.player" }] }
        ] }
    ],
    "mediations": [{ "id": "combat-over-unity", "what": "d.combat", "how": "d.unity", "mediator": "d.combat-in-unity" }]
  },
  "attachments": [{ "owner": "ui", "data": { "any": "JSON" } }]
}
```

[`examples/game.systemathic.json`](../examples/game.systemathic.json) is a complete file.

## Rules

- **Ownership nests; everything else refers.** A thing appears once, inside what owns it —
  an Entity inside its Language, a Transformation inside its Domain — and everything else
  refers to it by `id`.
- **Ids** are strings, unique in the file. Mappings and reverses have none; they are owned
  by their Transformation and identified by position.
- **Names** are strings. Two things with the same name share one Name, as the Kernel says.
  An end's `name` may be `null`: an unnamed end, which cannot be navigated to.
- **Ranges**: `min` is a natural number; `max` is a natural number or `"N"` for unbounded.
- **Parameters** are in order; the array order is the Interaction's parameter order.
- **A Formula** is its `text`, in the ASCII syntax of [foundation.md](foundation.md). Which
  Entities and ends it mentions is derived from the text; it is not stored.
- **Std**: an Interaction's `primary` is one of its Parameters, or `null`; `compares` lists the
  Entities it is the comparison of. A Transformation's `deferred` lists what it deliberately
  leaves unmapped, each naming exactly one `entity`, `relationship` or `interaction`.
- **A reverse** is `null` for a Transformation without one (a projection), or
  `{ "context": [...] }` listing the Entities its holder keeps.
- **Attachments** are opaque: the tool keeps them, with their `owner`, and never reads `data`.
- **Canonical form**: every key shown above is present, in that order, with `"constrains"`
  the one optional key. Reading then writing a file in canonical form gives the same file.

## What reading reports

The file can hold an ill-formed System; saying what is wrong with it is the diagnoser's
job. Reading reports only what it cannot follow — a reference to an id that does not exist,
or to the wrong kind of thing, or a duplicate id — and drops that link. A file that is not
this shape at all is rejected.

The layers are read and written by their own modules in `packages/tool-json`: Kernel
(Languages), Contexts (the System, Domains, Mediations), Operations (Interactions and their
mappings), Std (primary Parameters, comparisons, deferrals), and the Tool wrapper that puts
them together.
