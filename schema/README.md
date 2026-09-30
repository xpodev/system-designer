# Schema

The Systemathic Languages — the vocabulary every System is made of — written as data in
the kernel. See [foundation.md](../docs/foundation.md), *The Systemathic Languages*.

| File | Language | Adds | Includes |
|---|---|---|---|
| [`kernel.json`](kernel.json) | Kernel | Language, Entity, Relationship, End, Name, Bound, Formula | — |
| [`contexts.json`](contexts.json) | Contexts | System, Domain, Transformation, Reverse, mappings, Mediation | Kernel |
| [`operations.json`](operations.json) | Operations | Interaction, Parameter, Interaction mappings | Kernel, Contexts |
| [`std.json`](std.json) | Std | Action (a `primary` Parameter), Comparison, Deferred | Kernel, Contexts, Operations |

Each layer extends the ones below it without changing them. An **inclusion** —
`"includes": {"Kernel": ["Language", "Entity"]}` — is the identity projection of the
listed Entities into the including Language, with every Relationship among them.

These files are the single source of truth for every realization of the core. The
TypeScript editor and the `systemathic.core` Python library are both derived from them;
each is a mediation into its own language, free to use natural forms there (a Parameter
chain becomes a list).

[`check.py`](check.py) checks each Language against the kernel, over its merged
vocabulary: every included Entity exists, every end's Entity is known, every range is
well-formed, end names are unique per Entity, and every axiom is a well-formed,
well-typed formula.

```bash
python schema/check.py
```
