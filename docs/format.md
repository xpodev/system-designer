# The System file format

A System file is a System written as JSON: the stored form of a model of the Systemathic
Languages ([foundation.md](foundation.md)), so that any program in any language can read
and write it. It is identified by `"format": "systemathic/3"`. Files of earlier models are
not read; a `systemathic/2` file is brought forward by a migration script (to be written).

## Shape

```json
{
  "format": "systemathic/3",
  "design": {
    "id": "game.system", "name": "Game",
    "root": {
      "id": "game", "name": "Game",
      "uses": [],
      "exports": [],
      "imports": [{ "id": "game<pkg.netstack", "from": "pkg.netstack", "exports": ["pkg.netstack:lib.network", "pkg.netstack:pkg.netstack.medium"] }],
      "implements": [],
      "languages": [
        { "id": "combat", "name": "Combat", "extends": ["core", "fighting"],
          "entities": [{ "id": "combat.combat-monster", "name": "CombatMonster", "extends": ["core.monster"] }],
          "relationships": [
            { "id": "combat.chasing", "ends": [
              { "id": "combat.chasing.chasers", "name": "chasers", "entity": "core.monster", "min": 0, "max": "N" },
              { "id": "combat.chasing.chasing", "name": "chasing", "entity": "core.player", "min": 0, "max": 1 } ] }
          ],
          "formulas": [{ "id": "combat.f", "text": "all m in CombatMonster. not m in m.^leader" }] }
      ],
      "interactions": [],
      "transformations": [],
      "mediums": [],
      "deployments": [
        { "id": "game.online", "name": "Online",
          "instances": [
            { "id": "game.online.server", "name": "server", "of": "game.server", "min": 1, "max": 1 },
            { "id": "game.online.clients", "name": "clients", "of": "game.client", "min": 1, "max": "N" } ],
          "connections": [
            { "id": "game.online.clients-attack", "from": "game.online.clients",
              "to": "game.online.server", "toComponent": null,
              "what": ["game.server.attack"],
              "mediations": [{ "id": "game.online.clients-attack#m0", "how": "pkg.netstack.medium", "down": "game.combat-over-network.down", "up": "game.combat-over-network.up" }] } ] }
      ],
      "components": [
        { "id": "game.server", "name": "Server", "uses": ["combat"],
          "exports": [{ "id": "game.server:game.server.attack", "interaction": "game.server.attack" }],
          "imports": [{ "id": "game.server<game.physics", "from": "game.physics", "exports": [] }],
          "implements": [],
          "languages": [],
          "interactions": [
            { "id": "game.server.attack", "name": "attack", "language": "combat",
              "parameters": [{ "id": "game.server.attack.attacker", "name": "attacker", "type": "fighting.attacker" }],
              "output": "fighting.damage" }
          ],
          "transformations": [
            { "id": "game.server.view", "name": "Monsters in combat",
              "parameters": [{ "id": "game.server.view.monster", "name": "monster", "type": "core.monster" }],
              "output": "combat.combat-monster" }
          ],
          "mediums": [], "deployments": [], "components": [] }
      ]
    },
    "packages": []
  },
  "attachments": [{ "owner": "ui", "data": { "any": "JSON" } }]
}
```

## Rules

- **Ownership nests; everything else refers.** A thing appears once, inside what owns it —
  an Entity inside its Language, a Language, a Function or a child inside its Component,
  an Instance inside its Deployment — and everything else refers to it by `id`.
- **The System** has its `root` Component, and the `packages` it brought in beside it.
- **A Component's `exports`** are its Exports, each with its `id` and what it exports under
  one key: `component`, `interaction`, `transformation`, `language` or `medium`. A file
  with re-exports (an `export` key) is from before Exports were global: `scripts/migrate.py`
  brings it forward. **Its `imports`** are its Imports, each with its `id`,
  the Component it is `from`, and the `exports` it takes, by id — none for an Import of the
  Component as a whole. `uses` lists the Languages it works in; `implements` the Components
  it implements.
- **Ids** are strings, unique in the file.
- **Names** are strings. Two things with the same name share one Name, as the Kernel says.
  An end's `name` may be `null`: an unnamed end, which cannot be navigated to.
- **Ranges** — of an end, or of an Instance: `min` is a natural number; `max` is a natural
  number or `"N"` for unbounded.
- **Functions**: an Interaction has its `language`; Interactions and Transformations both
  have their `parameters`, in order, and an `output`, or `null` for none.
- **A Formula** is its `text`, in the ASCII syntax of [foundation.md](foundation.md). Which
  Entities and ends it mentions is derived from the text; it is not stored.
- **A Connection** goes to an Instance (`to`) or to the deployed Component
  (`toComponent`); the other is `null`. Its `mediations` are in order from the top: the
  first mediates its What, each next the call of the Medium before it. A Mediation's `down`
  and `up` are `null` when it is not realized.
- **Attachments** are what the tool keeps about a System outside the core — descriptions,
  Configurations, layout — each with its `owner`. The core never reads `data`.
- **Canonical form**: every key shown above is present, in that order. Reading then
  writing a file in canonical form gives the same file.

## What reading reports

The file can hold an ill-formed System; saying what is wrong with it is the diagnoser's
job. Reading reports only what it cannot follow — a reference to an id that does not exist,
or to the wrong kind of thing, or a duplicate id — and drops that link. A file that is not
this shape at all is rejected.
