# Schema

The Systemathic Languages — the vocabulary every System is made of — written as data in
the kernel. See [foundation.md](../docs/foundation.md), *The Systemathic Languages*.

| File | Language | Adds | Extends |
|---|---|---|---|
| [`kernel.json`](kernel.json) | Kernel | Language, Entity, Relationship, End, Name, Bound, Formula; what a Language or an Entity extends | — |
| [`contexts.json`](contexts.json) | Contexts | System, Component, Transformation, mappings; uses and Component imports | Kernel |
| [`operations.json`](operations.json) | Operations | Interaction, Parameter; Interaction imports | Kernel, Contexts |
| [`deployment.json`](deployment.json) | Deployment | Deployment, Instance, Connection | Kernel, Contexts, Operations |
| [`mediation.json`](mediation.json) | Mediation | Medium, Mediation; Medium imports | Kernel, Contexts, Operations, Deployment |
| [`configuration.json`](configuration.json) | Configuration | Configuration, Choice | Kernel, Contexts, Deployment |
| [`std.json`](std.json) | Std | Action (a `primary` Parameter), Comparison, Deferred | Kernel, Contexts, Operations |

Each layer extends the ones below it without changing them: `"extends": ["Kernel"]` makes
the Kernel's whole vocabulary the extending layer's too, and a layer may add Relationships
to Entities it does not define.

These files are the single source of truth for every realization of the core. The
TypeScript editor and the `systemathic.core` Python library are both derived from them;
each is a mediation into its own language, free to use natural forms there (a Parameter
chain becomes a list).

[`check.py`](check.py) checks each Language against the kernel, over its merged
vocabulary: every extended Language exists, every end's Entity is known, every range is
well-formed, end names are unique per Entity, and every axiom is a well-formed,
well-typed formula — and then all of them together, the union a System is a model of.

```bash
python schema/check.py
```
