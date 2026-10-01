/** MediationEditor (Contexts): a Mediation's what, how and mediator. */
import { remove as removeFromModel } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { element, operation, str, type Operation } from "../operation.js";

const EDITOR = "MediationEditor";

type Role = "what" | "how" | "mediator";

function setRole(session: EditSession, role: Role, mediation: string, domain: string): Edit {
  return session.edit("change", `set ${role}`, [mediation, domain], (graph) => {
    graph.disconnect(mediation, role);
    graph.connect(mediation, role, domain);
  });
}

export const setWhat = (session: EditSession, mediation: string, domain: string): Edit => setRole(session, "what", mediation, domain);
export const setHow = (session: EditSession, mediation: string, domain: string): Edit => setRole(session, "how", mediation, domain);
export const setMediator = (session: EditSession, mediation: string, domain: string): Edit => setRole(session, "mediator", mediation, domain);

export function remove(session: EditSession, mediation: string): Edit {
  return session.edit("removal", "remove Mediation", [mediation], (graph) => void removeFromModel(graph, mediation));
}

const MEDIATION = element("mediation", "Mediation", "the Mediation");
const DOMAIN = element("domain", "Domain", "the Domain");

export const mediationEditor: readonly Operation[] = [
  operation(EDITOR, "setWhat", "change", "Sets the Domain a Mediation carries out.", [MEDIATION, DOMAIN], (s, a) => setWhat(s, str(a, "mediation"), str(a, "domain"))),
  operation(EDITOR, "setHow", "change", "Sets the Domain a Mediation carries it out over.", [MEDIATION, DOMAIN], (s, a) => setHow(s, str(a, "mediation"), str(a, "domain"))),
  operation(EDITOR, "setMediator", "change", "Sets the Domain whose Transformation witnesses a Mediation.", [MEDIATION, DOMAIN], (s, a) =>
    setMediator(s, str(a, "mediation"), str(a, "domain")),
  ),
  operation(EDITOR, "remove", "removal", "Removes a Mediation.", [MEDIATION], (s, a) => remove(s, str(a, "mediation"))),
];
