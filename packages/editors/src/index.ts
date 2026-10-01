/**
 * The concept editors (docs/tool-design.md): one per concept of the core, each in the folder
 * of the core layer it edits. An editor over a layer may build on editors of the layers below
 * it, never above. Each is exported as a namespace of typed operations, and all of them as
 * descriptors, which is what clients are built from.
 */
import * as DomainEditor from "./contexts/domain.js";
import * as MediationEditor from "./contexts/mediation.js";
import * as SystemEditor from "./contexts/system.js";
import * as TransformationEditor from "./contexts/transformation.js";
import * as EntityEditor from "./kernel/entity.js";
import * as FormulaEditor from "./kernel/formula.js";
import * as LanguageEditor from "./kernel/language.js";
import * as RelationshipEditor from "./kernel/relationship.js";
import type { Operation } from "./operation.js";
import * as InteractionMappingEditor from "./operations/interaction-mapping.js";
import * as InteractionEditor from "./operations/interaction.js";
import * as StdEditor from "./std/std.js";

export {
  DomainEditor,
  EntityEditor,
  FormulaEditor,
  InteractionEditor,
  InteractionMappingEditor,
  LanguageEditor,
  MediationEditor,
  RelationshipEditor,
  StdEditor,
  SystemEditor,
  TransformationEditor,
};
export { ArgumentError, parseRange, type Operation, type ParameterKind, type ParameterSpec } from "./operation.js";
export type { EndInput } from "./kernel/language.js";

/** Every operation of every editor, by editor, in the order of docs/tool-design.md. */
export const editors: Readonly<Record<string, readonly Operation[]>> = {
  SystemEditor: SystemEditor.systemEditor,
  LanguageEditor: LanguageEditor.languageEditor,
  EntityEditor: EntityEditor.entityEditor,
  RelationshipEditor: RelationshipEditor.relationshipEditor,
  FormulaEditor: FormulaEditor.formulaEditor,
  DomainEditor: DomainEditor.domainEditor,
  TransformationEditor: TransformationEditor.transformationEditor,
  MediationEditor: MediationEditor.mediationEditor,
  InteractionEditor: InteractionEditor.interactionEditor,
  InteractionMappingEditor: InteractionMappingEditor.interactionMappingEditor,
  StdEditor: StdEditor.stdEditor,
};

/** An operation by editor and name. */
export function findOperation(editor: string, name: string): Operation | undefined {
  return editors[editor]?.find((operation) => operation.name === name);
}
