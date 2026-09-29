import type { LayerId, MediationNode } from "./types.js";

function id(): string {
  return crypto.randomUUID();
}

/** A/M: intent layer L_A mediated over executor layer L_M via an
 *  implementation layer holding the tau mappings between them. All three may
 *  be the same layer only in the degenerate case; ordinarily the
 *  implementation layer is the one whose Transformations actually connect
 *  L_A's language to L_M's language. */
export function addMediation(
  mediations: MediationNode[],
  intentLayerId: LayerId,
  mediatorLayerId: LayerId,
  implementationLayerId: LayerId
): MediationNode[] {
  const mediation: MediationNode = { id: id(), intentLayerId, mediatorLayerId, implementationLayerId };
  return [...mediations, mediation];
}

export function removeMediation(mediations: MediationNode[], mediationId: string): MediationNode[] {
  return mediations.filter((m) => m.id !== mediationId);
}
