module core

/*
 * Systemathic core — docs/foundation.md, Part I.
 *
 * Every predicate takes A, the set of elements that exist. Deletion is then checked as
 * "remove a set of elements; is what is left still well-formed?".
 *
 * Formulas are modelled only by the symbols they mention: well-formedness is about
 * which vocabulary a formula uses, never about whether it holds.
 *
 * This is itself a realization of the Systemathic Language (a mediation into Alloy), so
 * it uses Alloy's own forms where natural: an Interaction's Parameters are a `seq`, not
 * the linked list the foundation uses.
 */

abstract sig Element {}

sig Name {}

sig Language extends Element {}

sig Entity extends Element {
  elang: one Language
}

sig End {
  entity: one Entity,
  ename: lone Name,                             -- absent = unnamed: not navigable to
  min: one Int,
  max: lone Int                                 -- absent = unbounded (N)
}

sig Relationship extends Element {
  rlang: one Language,
  e1, e2: one End
}

-- Every End belongs to exactly one Relationship, in exactly one position.
fact endsBelongToOneRelationship {
  all e: End | one e1.e + e2.e and (no e1.e or no e2.e)
}

fun ends[r: Relationship]: set End { r.e1 + r.e2 }

fun relOf[e: End]: Relationship { (e1 + e2).e }

-- The other end of the same Relationship.
fun far[e: End]: End { ends[relOf[e]] - e }

-- The ends reachable from x by navigation, among Relationships that exist.
fun reachable[x: Entity, A: set Element]: set End {
  { e: End | relOf[e] in A and far[e].entity = x }
}

sig Interaction extends Element {
  ilang: one Language,
  inputs: seq Entity,
  output: one Entity
}

sig Formula extends Element {                   -- an axiom, or a constraint of a Relationship
  flang: one Language,
  constrains: lone Relationship,
  mentions: set (Entity + Relationship + Interaction)
}

sig Domain extends Element {
  langRefs: set Language,
  domRefs: set Domain
}

sig Transformation extends Element {
  holder: one Domain,
  src, tgt: one Language,
  emap: Entity -> Entity,
  rmap: Relationship -> Relationship,
  imap: Interaction -> Interaction              -- i ↦ the target Interactions its term uses
}

sig Reversible in Transformation {}             -- the Transformations that have a reverse

sig Mediation extends Element {
  what, how, mediator: one Domain
}

-- Effective Languages: a Domain's own, plus those of every Domain it references, transitively.
fun langs[d: Domain, A: set Element]: set Language {
  d.*(domRefs & (A -> A)).langRefs & A
}

fun langOf[x: set Element]: set Language {
  x.elang + x.rlang + x.ilang + x.flang
}

-- Not a law of the foundation but a precondition for talking about one:
-- nothing that exists points at something that does not.
pred integrity[A: set Element] {
  all e: Entity & A         | e.elang in A
  all r: Relationship & A   | r.rlang + ends[r].entity in A
  all i: Interaction & A    | i.ilang + i.output + univ.(i.inputs) in A
  all f: Formula & A        | f.flang + f.constrains + f.mentions in A
  all t: Transformation & A | t.holder + t.src + t.tgt in A
  all m: Mediation & A      | m.what + m.how + m.mediator in A
}

-- W1
pred closure[A: set Element] {
  all r: Relationship & A | ends[r].entity.elang = r.rlang
  all i: Interaction & A  | (univ.(i.inputs) + i.output).elang = i.ilang
  all f: Formula & A {
    langOf[f.mentions] in f.flang
    some f.constrains implies f.constrains.rlang = f.flang
  }
}

-- W2
pred ranges[A: set Element] {
  all e: ends[Relationship & A] {
    e.min >= 0
    no e.max or e.min <= e.max
  }
}

-- W3
pred endNames[A: set Element] {
  all x: Entity & A, disj a, b: reachable[x, A] | some a.ename implies a.ename != b.ename
}

-- W4
pred scope[A: set Element] {
  all t: Transformation & A | t.src + t.tgt in langs[t.holder, A]
}

-- Part of the definition of a mapping: sources in L_src, images in L_tgt.
pred typing[A: set Element] {
  all t: Transformation & A {
    let em = t.emap & (A -> A), rm = t.rmap & (A -> A), im = t.imap & (A -> A) {
      em.univ.elang in t.src and univ.em.elang in t.tgt
      rm.univ.rlang in t.src and univ.rm.rlang in t.tgt
      im.univ.ilang in t.src and univ.im.ilang in t.tgt
      all r: rm.univ, r2: r.rm | ends[r2].entity in ends[r].entity.em
    }
  }
}

-- W5
pred definitionBeforeUse[A: set Element] {
  all t: Transformation & A {
    let em = t.emap & (A -> A), rm = t.rmap & (A -> A), im = t.imap & (A -> A) {
      all r: rm.univ | ends[r].entity in em.univ
      all i: im.univ | univ.(i.inputs) + i.output in em.univ
    }
  }
}

-- W6
pred witnesses[t: Transformation, m: Mediation, A: set Element] {
  t in Reversible & A
  t.holder = m.mediator
  t.src in langs[m.what, A]
  t.tgt in langs[m.how, A]
}

pred witnessed[A: set Element] {
  all m: Mediation & A | some t: Transformation | witnesses[t, m, A]
}

pred wellFormed[A: set Element] {
  integrity[A]
  closure[A]
  ranges[A]
  endNames[A]
  scope[A]
  typing[A]
  definitionBeforeUse[A]
  witnessed[A]
}

-- Deletion, as the foundation describes it.

fun deleteLanguage[l: Language]: set Element {
  let owned = l + elang.l + rlang.l + ilang.l + flang.l,
      ts    = src.l + tgt.l |
    owned + ts + { m: Mediation | some t: ts | witnesses[t, m, Element] }
}

-- Remove the Domain, then whatever lost its footing: Transformations that fell out of
-- scope (their Languages were reachable only through d), then Mediations left with no
-- witness. A plain "d and what names it" is not enough: see the check below.
fun deleteDomain[d: Domain]: set Element {
  let A1      = Element - d - holder.d - what.d - how.d - mediator.d,
      lost    = { t: Transformation & A1 | t.src + t.tgt not in langs[t.holder, A1] },
      A2      = A1 - lost,
      orphans = { m: Mediation & A2 | no t: Transformation | witnesses[t, m, A2] } |
    Element - (A2 - orphans)
}

-- Checks

-- The definitions are satisfiable, with every kind of element present.
run someSystem {
  wellFormed[Element]
  some Relationship and some Interaction and some Formula and some Mediation
} for 4 but 16 Element, 6 End

assert deletingALanguageKeepsWellFormedness {
  wellFormed[Element] implies all l: Language | wellFormed[Element - deleteLanguage[l]]
}
check deletingALanguageKeepsWellFormedness for 4 but 12 Element, 6 End

assert deletingADomainKeepsWellFormedness {
  wellFormed[Element] implies all d: Domain | wellFormed[Element - deleteDomain[d]]
}
check deletingADomainKeepsWellFormedness for 4 but 12 Element, 6 End

-- Named ends: two Relationships between the same pair, and a self-Relationship
-- (prev/next), are both expressible and distinguishable.
run namedEnds {
  wellFormed[Element]
  some disj r1, r2: Relationship | ends[r1].entity = ends[r2].entity
  some r: Relationship | one ends[r].entity
} for 4 but 12 Element, 6 End
