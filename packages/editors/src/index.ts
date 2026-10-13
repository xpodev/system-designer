/**
 * The concept editors: one per concept of the core, each in the folder of the core layer it
 * edits. An editor over a layer may build on editors of the layers below it, never above. Each
 * is exported as a namespace of typed operations, and all of them as descriptors, which is
 * what clients are built from.
 */
import * as ComponentEditor from "./contexts/component.js";
import * as InteractionEditor from "./contexts/interaction.js";
import * as SystemEditor from "./contexts/system.js";
import * as DeploymentEditor from "./deployment/deployment.js";
import * as FunctionEditor from "./functions/function.js";
import * as EntityEditor from "./kernel/entity.js";
import * as FormulaEditor from "./kernel/formula.js";
import * as LanguageEditor from "./kernel/language.js";
import * as RelationshipEditor from "./kernel/relationship.js";
import * as MediationEditor from "./mediation/mediation.js";
import * as MediumEditor from "./mediation/medium.js";
import type { Operation } from "./operation.js";

export {
  ComponentEditor,
  DeploymentEditor,
  EntityEditor,
  FormulaEditor,
  FunctionEditor,
  InteractionEditor,
  LanguageEditor,
  MediationEditor,
  MediumEditor,
  RelationshipEditor,
  SystemEditor,
};
export { ArgumentError, operation, element, elements, text, range, index, flag, maybe, str, ids, parseRange, type Arguments, type Operation, type ParameterKind, type ParameterSpec } from "./operation.js";
export type { EndInput } from "./kernel/language.js";
export type { ConnectOptions } from "./deployment/deployment.js";

/** Every operation of every editor, by editor, layer by layer. */
export const editors: Readonly<Record<string, readonly Operation[]>> = {
  SystemEditor: SystemEditor.systemEditor,
  ComponentEditor: ComponentEditor.componentEditor,
  LanguageEditor: LanguageEditor.languageEditor,
  EntityEditor: EntityEditor.entityEditor,
  RelationshipEditor: RelationshipEditor.relationshipEditor,
  FormulaEditor: FormulaEditor.formulaEditor,
  FunctionEditor: FunctionEditor.functionEditor,
  InteractionEditor: InteractionEditor.interactionEditor,
  DeploymentEditor: DeploymentEditor.deploymentEditor,
  MediumEditor: MediumEditor.mediumEditor,
  MediationEditor: MediationEditor.mediationEditor,
};

/** An operation by editor and name. */
export function findOperation(editor: string, name: string): Operation | undefined {
  return editors[editor]?.find((operation) => operation.name === name);
}
