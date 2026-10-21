# The System file format

A System file is a System written as JSON: the stored form of a model of the Systemathic
Languages ([foundation.md](foundation.md)), so that any program in any language can read
and write it. It is identified by `"format": "systemathic/4"`. Files of earlier models are
not read: `scripts/migrate.py` brings a `systemathic/2` or `systemathic/3` file forward.

## Shape

```json
{
  "format": "systemathic/4",
  "design": {
    "id": "game.system", "name": "Game",
    "root": {
      "id": "game", "name": "Game",
      "uses": [],
      "exports": [],
      "imports": [{ "id": "game<pkg.netstack", "from": "pkg.netstack", "exports": ["pkg.netstack:lib.network"] }],
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
        { "id": "game.online", "name": "Online", "of": "game",
          "instances": [
            { "id": "game.online.server", "name": "server", "of": "game.server", "runs": "game.server.single", "min": 1, "max": 1 },
            { "id": "game.online.clients", "name": "clients", "of": "game.client", "runs": null, "min": 1, "max": "N" } ],
          "connections": [
            { "id": "game.online.clients-attack", "from": "game.online.clients",
              "to": "game.online.server", "toComponent": null, "toIdentity": null,
              "what": ["game.server.attack"],
              "mediations": [{ "id": "game.online.clients-attack#m0", "how": "pkg.netstack.medium", "down": "game.combat-over-network.down", "up": "game.combat-over-network.up" }] } ],
          "imports": [
            { "id": "game.online<pkg.netstack", "from": "pkg.netstack", "exports": ["pkg.netstack:pkg.netstack.medium"] },
            { "id": "game.online<game.combat-over-network", "from": "game.combat-over-network", "exports": ["game.combat-over-network:game.combat-over-network.down", "game.combat-over-network:game.combat-over-network.up"] } ],
          "exposes": [{ "id": "game.online:server", "instance": "game.online.server" }] }
      ],
      "components": [
        { "id": "game.server", "name": "Server", "uses": ["combat"],
          "exports": [{ "id": "game.server:game.server.attack", "interaction": "game.server.attack" }],
          "imports": [],
          "languages": [],
          "interactions": [
            { "id": "game.server.attack", "name": "attack", "language": "combat",
              "parameters": [{ "id": "game.server.attack.attacker", "name": "attacker", "type": "fighting.attacker" }],
              "output": "fighting.damage" }
          ],
          "transformations": [],
          "mediums": [],
          "deployments": [
            { "id": "game.server.single", "name": "Single", "of": "game.server",
              "instances": [{ "id": "game.server.single.physics", "name": "physics", "of": "game.physics", "runs": null, "min": 1, "max": 1 }],
              "connections": [],
              "imports": [{ "id": "game.server.single>server", "path": ["game.online.server"] }],
              "exposes": [] } ],
          "components": [] }
      ]
    },
    "packages": []
  },
  "attachments": [{ "owner": "ui", "data": { "any": "JSON" } }]
}
```

## Rules

- **Ownership nests; everything else refers.** A thing appears once, inside what owns it —
  an Entity inside its Language, a Language, a Function or a child inside its Component, a
  Deployment inside the Component that keeps it, an Instance inside its Deployment — and
  everything else refers to it by `id`.
- **The System** has its `root` Component, and the `packages` it brought in beside it.
- **A Component's `exports`** are its Exports, each with its `id` and what it exports under
  one key: `component`, `interaction`, `transformation`, `language`, `medium` or
  `deployment` (one it keeps). **Its `imports`** are its Imports — for a box, only of
  Languages — each with its `id`, the Component it is `from`, and the `exports` it takes,
  by id. `uses` lists the Languages it works in.
- **A Component's `deployments`** are the Deployments it keeps. Each names the box it is
  `of` — the Component itself, or another, which it then imports — and holds its
  `instances`, its `connections`, its `imports` (its needs) and what it `exposes`: Exports
  of its own placements, each naming its `instance`.
- **An identity** is an Import of a Deployment written as a `path`: the ids of its
  placements, from a placement in a Deployment of the root down, with no `from` and no
  `exports`.
- **An Instance** names the box it is `of`, the Deployment it `runs` if the design fixes
  it (`null` otherwise), and its range.
- **Ids** are strings, unique in the file.
- **Names** are strings. Two things with the same name share one Name, as the Kernel says.
  An end's `name` may be `null`: an unnamed end, which cannot be navigated to.
- **Ranges** — of an end, or of an Instance: `min` is a natural number; `max` is a natural
  number or `"N"` for unbounded.
- **Functions**: an Interaction has its `language`; Interactions and Transformations both
  have their `parameters`, in order, and an `output`, or `null` for none.
- **A Formula** is its `text`, in the ASCII syntax of [foundation.md](foundation.md). Which
  Entities and ends it mentions is derived from the text; it is not stored.
- **A Connection** goes to exactly one of an Instance (`to`), an identity its Deployment
  imports (`toIdentity`), or the Deployment's box (`toComponent`); the others are `null`.
  Its `mediations` are in order from the top: the first mediates its What, each next the
  call of the Medium before it. A Mediation's `down` and `up` are `null` when it is not
  realized.
- **Attachments** are what the tool keeps about a System outside the core — descriptions,
  Configurations, layout — each with its `owner`. The core never reads `data`. The
  Configurations' attachment holds `configurations`, each with its root Choice — every
  Choice naming the `instance` it is for (`null` for the root) and the `deployment` it runs,
  or `null` — and may name the `current` one.
- **Canonical form**: every key shown above is present, in that order. Reading then
  writing a file in canonical form gives the same file.

## What reading reports

The file can hold an ill-formed System; saying what is wrong with it is the diagnoser's
job. Reading reports only what it cannot follow — a reference to an id that does not exist,
or to the wrong kind of thing, a duplicate id, or a key of an earlier format (`implements`,
a re-export's `export`), with how to bring the file forward — and drops that link. A file
that is not this shape at all is rejected.
