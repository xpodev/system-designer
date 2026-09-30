# Schema

[`systemathic.json`](systemathic.json) is the Systemathic Language — the vocabulary every
System is made of — written as data in the kernel: its Entities, its Relationships (each a
pair of named ends with ranges), and its axioms as formulas. See
[foundation.md](../docs/foundation.md), *The Systemathic Language*.

It is the single source of truth for every realization of the core. The TypeScript editor
and the `systemathic.core` Python library are both derived from it; each is a mediation
into its own language, free to use natural forms there (a Parameter chain becomes a list).

[`check.py`](check.py) checks a Language given in this form against the kernel: that every
end's Entity is declared, every range is well-formed, end names are unique per Entity, and
every axiom is a well-formed, well-typed formula.

```bash
python schema/check.py
```
