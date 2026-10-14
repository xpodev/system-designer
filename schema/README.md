# Schema

The Systemathic Languages — the vocabulary every System is made of — written as data in
the kernel. See [foundation.md](../docs/foundation.md), *The Systemathic Languages*.

| File | Language | Adds | Extends |
|---|---|---|---|
| [`kernel.json`](kernel.json) | Kernel | Language, Entity, Relationship, End, Name, Bound, Formula; what a Language or an Entity extends | — |
| [`functions.json`](functions.json) | Functions | Function, Parameter; a Function's ordered Parameters and its output | Kernel |
| [`contexts.json`](contexts.json) | Contexts | Component, Interaction : Function, Transformation : Function, Export, Import; uses, implements | Functions |
| [`deployment.json`](deployment.json) | Deployment | Deployment, Instance (with a range), Connection | Contexts |
| [`mediation.json`](mediation.json) | Mediation | Medium, Mediation; an Export of a Medium | Deployment |
| [`systems.json`](systems.json) | Systems | System: a root Component and the packages beside it | Mediation |

Each layer extends the one below it without changing it: `"extends": ["Kernel"]` makes
the Kernel's whole vocabulary the extending layer's too, and a layer may add Relationships
to Entities it does not define. An Entity may extend Entities of the layers below,
written `{"name": "Interaction", "extends": ["Function"]}`; it then has their ends. An end
may be unnamed, `"name": null`: it cannot be navigated to.

These files are the single source of truth for every realization of the core. The
TypeScript core and the `systemathic.core` Python library are both derived from them;
each is a mediation into its own language, free to use natural forms there (a Parameter
chain becomes a list).

They are read off the tool's own design: the Component named Systemathic in
[`docs/system-designer.systemathic.json`](../docs/system-designer.systemathic.json) decides
the vocabulary, and the schema adds the axioms. [`design.py`](design.py) checks that the
two have the same vocabulary.

[`check.py`](check.py) checks each Language against the kernel, over its merged
vocabulary: every extended Language and Entity exists, every end's Entity is known, every
range is well-formed, end names are unique per Entity, and every axiom is a well-formed,
well-typed formula — and then all of them together, the union a System is a model of.

```bash
python schema/check.py
```

```bash
python schema/design.py
```
