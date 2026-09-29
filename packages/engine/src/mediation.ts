import type { DomainId, MediationNode } from "./types.js";

function id(): string {
  return crypto.randomUUID();
}

/** A/M: intent domain L_A mediated over executor domain L_M via an
 *  implementation domain holding the tau mappings between them. All three may
 *  be the same domain only in the degenerate case; ordinarily the
 *  implementation domain is the one whose Transformations actually connect
 *  L_A's language to L_M's language. */
export function addMediation(
  mediations: MediationNode[],
  intentDomainId: DomainId,
  mediatorDomainId: DomainId,
  implementationDomainId: DomainId
): MediationNode[] {
  const mediation: MediationNode = { id: id(), intentDomainId, mediatorDomainId, implementationDomainId };
  return [...mediations, mediation];
}

export function removeMediation(mediations: MediationNode[], mediationId: string): MediationNode[] {
  return mediations.filter((m) => m.id !== mediationId);
}
