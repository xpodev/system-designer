# The System file format

A System file is `Tool::System / JSON` (see [tool-design.md](tool-design.md)): the tool's
stored form of a System, in JSON, so that any program in any language can read and write
it. It is identified by `"format": "systemathic/2"`. Files of the previous model,
`systemathic/1`, are not read: its concepts do not carry over faithfully.

## Shape

```json
{
  "format": "systemathic/2",
  "design": {
    "id": "game.system", "name": "Game", "root": "game",
    "components": [
      {
        "id": "game", "name": "Game",
        "uses": [],
        "imports": { "components": ["lib.netstack"], "transformations": [], "interactions": [], "mediums": [] },
        "languages": [
          { "id": "combat", "name": "Combat", "extends": ["core", "fighting"],
            "entities": [{ "id": "combat.combat-monster", "name": "CombatMonster", "extends": ["core.monster"] }],
            "relationships": [
              { "id": "combat.chasing", "ends": [
                { "id": "combat.chasing.chasers", "name": "chasers", "entity": "core.monster", "min": 0, "max": "N" },
                { "id": "combat.chasing.chasing", "name": "chasing", "entity": "core.player", "min": 0, "max": 1 } ] }
            ],
            "formulas": [{ "id": "combat.f", "text": "all m in CombatMonster. not m in m.^leader", "constrains": "core.pack" }] }
        ],
        "transformations": [],
        "interactions": [],
        "mediums": [],
        "deployments": [
          { "id": "game.online", "name": "Online",
            "instances": [{ "id": "game.online.server", "name": "server", "of": "game.server" }],
            "connections": [
              { "id": "game.online.client-1-attacks", "from": "game.online.client-1",
                "toInstance": "game.online.server", "toComponent": null,
                "what": ["game.server.attack"],
                "mediations": [{ "how": "lib.netstack.network", "down": "game.combat-over-network.down", "up": "game.combat-over-network.up" }] } ] }
        ],
        "components": [
          { "id": "game.server", "name": "Server", "uses": ["combat"],
            "imports": { "components": [], "transformations": [], "interactions": [], "mediums": [] },
            "languages": [],
            "transformations": [
              { "id": "game.server.view", "name": "Monsters in combat", "source": "core", "target": "combat", "context": [],
                "entityMappings": [{ "source": "core.monster", "targets": ["combat.combat-monster"] }],
                "relationshipMappings": [],
                "deferred": [{ "entity": "core.player" }] }
            ],
            "interactions": [
              { "id": "game.server.attack", "name": "attack", "language": "combat",
                "parameters": [{ "id": "game.server.attack.attacker", "name": "attacker", "type": "fighting.attacker" }],
                "output": "fighting.damage", "primary": "game.server.attack.attacker", "compares": [] }
            ],
            "mediums": [], "deployments": [], "components": [] }
        ]
      }
    ],
    "configurations": [
      { "id": "game.release", "name": "Release",
        "root": { "instance": null, "deployment": "game.online", "choices": [
          { "instance": "game.online.server", "deployment": "game.server.single", "choices": [] } ] } }
    ]
  },
  "attachments": [{ "owner": "ui", "data": { "any": "JSON" } }]
}
```

[`examples/game.systemathic.json`](../examples/game.systemathic.json) is a complete file.

## Rules

- **Ownership nests; everything else refers.** A thing appears once, inside what owns it —
  an Entity inside its Language, a Language, an Interaction or a child inside its
  Component, an Instance inside its Deployment — and everything else refers to it by `id`.
- **The System's `components`** are its top-level Components: its `root`, and the packages
  it brought in beside the root.
- **A Component's `imports`** list the Components, Transformations, Interactions and Mediums
  it imports; `uses` lists the Languages it works in.
- **Ids** are strings, unique in the file. Mappings, deferrals, Mediations and choices have
  none; they are owned by their Transformation, Connection or Configuration and identified
  by position.
- **Names** are strings. Two things with the same name share one Name, as the Kernel says.
  An end's `name` may be `null`: an unnamed end, which cannot be navigated to.
- **Ranges**: `min` is a natural number; `max` is a natural number or `"N"` for unbounded.
- **Ordered things are arrays**: an Interaction's `parameters`, and a Connection's
  `mediations`, the first over its What and each next over the call of the Medium above it.
- **A Formula** is its `text`, in the ASCII syntax of [foundation.md](foundation.md). Which
  Entities and ends it mentions is derived from the text; it is not stored.
- **A Connection** goes to an Instance (`toInstance`) or to the deployed Component
  (`toComponent`); the other is `null`. A Mediation's `down` and `up` are `null` when it is
  not realized.
- **A choice** names the `instance` it is for — `null` for a Configuration's first choice,
  which is of the root — and the `deployment` chosen.
- **Std**: an Interaction's `primary` is one of its Parameters, or `null`; `compares` lists the
  Entities it is the comparison of. A Transformation's `deferred` lists what it deliberately
  leaves unmapped, each naming exactly one `entity` or `relationship`.
- **Attachments** are opaque: the tool keeps them, with their `owner`, and never reads `data`.
- **Canonical form**: every key shown above is present, in that order, with `"constrains"`
  the one optional key. Reading then writing a file in canonical form gives the same file.

## What reading reports

The file can hold an ill-formed System; saying what is wrong with it is the diagnoser's
job. Reading reports only what it cannot follow — a reference to an id that does not exist,
or to the wrong kind of thing, or a duplicate id — and drops that link. A file that is not
this shape at all is rejected.

The layers are read and written by their own modules in `packages/tool-json`: Kernel
(Languages), Contexts (the System, Components, Transformations), Operations (Interactions),
Deployment (Deployments), Mediation (Mediums and Mediations), Configuration
(Configurations), Std (primary Parameters, comparisons, deferrals), and the Tool wrapper
that puts them together.
