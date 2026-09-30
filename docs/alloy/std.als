module std

/*
 * Systemathic standard concepts — docs/foundation.md, Part II, and the standard rules
 * of Part IV. Everything here is defined only in terms of core.
 */

open core

-- Kinds

fun projections: set Transformation { Transformation - Reversible }
fun mediations: set Transformation { Reversible }

-- Domains

pred standalone[d: Domain, A: set Element] { no d.domRefs & A }
pred pure[d: Domain, A: set Element] { one langs[d, A] }

fun topDomains[A: set Element]: set Domain {
  (Domain & A) - (Mediation & A).how - (Mediation & A).mediator
}

-- Abstractness

pred abstractLanguage[l: Language, A: set Element] {
  no m: Mediation & A, t: Transformation | witnesses[t, m, A] and t.tgt = l
}

pred abstractDomain[d: Domain, A: set Element] {
  all l: langs[d, A] | abstractLanguage[l, A]
}

-- Standard rules

pred opacity[A: set Element] {
  all m: Mediation & A, t: Transformation | witnesses[t, m, A] implies {
    t.tgt not in langs[m.what, A]
    t.src not in langs[m.how, A]
  }
}

pred mediationAcyclic[A: set Element] {
  let e = { d1, d2: Domain | some m: Mediation & A | m.what = d1 and m.how = d2 } |
    no d: Domain & A | d in d.^e
}

pred projectionAcyclic[A: set Element] {
  let e = { l1, l2: Language | some t: projections & A | t.src = l1 and t.tgt = l2 } |
    no l: Language & A | l in l.^e
}

pred domainRefsAcyclic[A: set Element] {
  no d: Domain & A | d in d.^(domRefs & (A -> A))
}

pred topDomainsAbstract[A: set Element] {
  all d: topDomains[A] | abstractDomain[d, A]
}

pred pureDomainHoldsNoTransformation[A: set Element] {
  all d: Domain & A | pure[d, A] implies no holder.d & A
}

pred narrowMediators[A: set Element] {
  all m: Mediation & A | #langs[m.mediator, A] <= 2
}

pred allStandardRules[A: set Element] {
  opacity[A]
  mediationAcyclic[A]
  projectionAcyclic[A]
  domainRefsAcyclic[A]
  topDomainsAbstract[A]
  pureDomainHoldsNoTransformation[A]
  narrowMediators[A]
}

-- Checks

-- Claim (Part II): a Transformation in a pure Domain is necessarily L → L.
assert pureDomainTransformationsAreEndo {
  wellFormed[Element] implies
    all t: Transformation | pure[t.holder, Element] implies t.src = t.tgt
}
check pureDomainTransformationsAreEndo for 4 but 12 Element, 6 End

-- Claim: an abstract Domain is never the "how" of a Mediation.
assert abstractDomainIsNeverAHow {
  wellFormed[Element] implies all m: Mediation | not abstractDomain[m.how, Element]
}
check abstractDomainIsNeverAHow for 4 but 12 Element, 6 End

-- The standard rules do not contradict the core or each other: a three-level stack
-- (Game / Unity / Windows) satisfying all of them exists.
run stackUnderAllRules {
  wellFormed[Element]
  allStandardRules[Element]
  some m1, m2: Mediation | m1.how = m2.what and m1.what != m2.how
} for 6 but 24 Element, 6 End
