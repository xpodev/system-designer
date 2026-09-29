import type { EntityId } from "@save/engine";
import React, { useState } from "react";
import { useWorkspace } from "../state/workspaceStore.js";

function allEntitiesInLayer(layer: NonNullable<ReturnType<typeof useWorkspace>["selectedLayer"]>) {
  return Array.from(layer.languages.values()).flatMap((language) =>
    Array.from(language.entities.values()).map((entity) => ({ entity, language }))
  );
}

export function EntityPanel() {
  const { state, dispatch, selectedLayer, selectedEntity } = useWorkspace();
  const [newEntityName, setNewEntityName] = useState("");
  const [newActionName, setNewActionName] = useState("");
  const [actionInputs, setActionInputs] = useState<EntityId[]>([]);
  const [actionOutput, setActionOutput] = useState<EntityId>("");
  const [actionLanguageId, setActionLanguageId] = useState<string>("");
  const [relTargetId, setRelTargetId] = useState<EntityId>("");
  const [relMin, setRelMin] = useState(0);
  const [relMax, setRelMax] = useState(1);

  if (!selectedLayer) return null;
  const language = state.selectedLanguageId ? selectedLayer.languages.get(state.selectedLanguageId) : null;
  if (!language) {
    return <div className="p-3 text-sm text-neutral-500">Select a language to manage its entities.</div>;
  }

  const layerEntities = allEntitiesInLayer(selectedLayer);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Entities — {language.name}
      </h2>

      <form
        className="flex gap-1"
        onSubmit={(evt) => {
          evt.preventDefault();
          if (!newEntityName.trim() || !state.selectedLayerId || !state.selectedLanguageId) return;
          dispatch({
            type: "ADD_ENTITY",
            layerId: state.selectedLayerId,
            languageId: state.selectedLanguageId,
            name: newEntityName.trim(),
          });
          setNewEntityName("");
        }}
      >
        <input
          className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
          placeholder="New entity"
          value={newEntityName}
          onChange={(evt) => setNewEntityName(evt.target.value)}
        />
        <button className="rounded bg-neutral-700 px-2 py-1 hover:bg-neutral-600" type="submit">
          Add
        </button>
      </form>

      <ul className="flex flex-col gap-1">
        {Array.from(language.entities.values()).map((entity) => (
          <li key={entity.id}>
            <button
              className={`w-full rounded px-2 py-1 text-left ${
                entity.id === state.selectedEntityId ? "bg-blue-600" : "hover:bg-neutral-800"
              }`}
              onClick={() => dispatch({ type: "SELECT_ENTITY", entityId: entity.id })}
            >
              {entity.name}
            </button>
          </li>
        ))}
      </ul>

      {selectedEntity && (
        <div className="flex flex-col gap-3 border-t border-neutral-700 pt-3">
          <div className="flex items-center justify-between">
            <strong>{selectedEntity.name}</strong>
            <button
              className="rounded bg-red-900 px-2 py-1 text-xs hover:bg-red-800"
              onClick={() =>
                state.selectedLayerId &&
                state.selectedLanguageId &&
                dispatch({
                  type: "REMOVE_ENTITY",
                  layerId: state.selectedLayerId,
                  languageId: state.selectedLanguageId,
                  entityId: selectedEntity.id,
                })
              }
            >
              Delete
            </button>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Relationships ({selectedEntity.relationships.length})
            </h3>
            <ul className="text-xs text-neutral-300">
              {selectedEntity.relationships.map((rel) => {
                const target = layerEntities.find((e) => e.entity.id === rel.targetEntityId);
                return (
                  <li key={rel.id}>
                    → {target?.entity.name ?? rel.targetEntityId} [{rel.cardinality[0]}, {rel.cardinality[1]}]
                  </li>
                );
              })}
            </ul>
            <form
              className="mt-1 flex flex-wrap items-center gap-1"
              onSubmit={(evt) => {
                evt.preventDefault();
                if (!relTargetId || !state.selectedLayerId || !state.selectedLanguageId) return;
                dispatch({
                  type: "ADD_RELATIONSHIP",
                  layerId: state.selectedLayerId,
                  languageId: state.selectedLanguageId,
                  entityId: selectedEntity.id,
                  targetEntityId: relTargetId,
                  cardinality: [relMin, relMax],
                });
              }}
            >
              <select
                className="rounded border border-neutral-700 bg-neutral-900 px-1 py-1"
                value={relTargetId}
                onChange={(evt) => setRelTargetId(evt.target.value)}
              >
                <option value="">target entity…</option>
                {layerEntities.map(({ entity, language: lang }) => (
                  <option key={entity.id} value={entity.id}>
                    {lang.name} / {entity.name}
                  </option>
                ))}
              </select>
              <input
                className="w-12 rounded border border-neutral-700 bg-neutral-900 px-1 py-1"
                type="number"
                value={relMin}
                onChange={(evt) => setRelMin(Number(evt.target.value))}
              />
              <input
                className="w-12 rounded border border-neutral-700 bg-neutral-900 px-1 py-1"
                type="number"
                value={relMax}
                onChange={(evt) => setRelMax(Number(evt.target.value))}
              />
              <button className="rounded bg-neutral-700 px-2 py-1 hover:bg-neutral-600" type="submit">
                Add
              </button>
            </form>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Actions ({selectedEntity.actions.length})
            </h3>
            <ul className="text-xs text-neutral-300">
              {selectedEntity.actions.map((action) => (
                <li key={action.id}>
                  {action.name}({action.inputTypes.length} in) →{" "}
                  {layerEntities.find((e) => e.entity.id === action.outputType)?.entity.name ??
                    action.outputType}
                </li>
              ))}
            </ul>
            <form
              className="mt-1 flex flex-col gap-1"
              onSubmit={(evt) => {
                evt.preventDefault();
                if (!newActionName.trim() || !actionOutput || !state.selectedLayerId || !state.selectedLanguageId)
                  return;
                dispatch({
                  type: "ADD_ACTION",
                  layerId: state.selectedLayerId,
                  languageId: state.selectedLanguageId,
                  entityId: selectedEntity.id,
                  name: newActionName.trim(),
                  inputTypes: actionInputs,
                  outputType: actionOutput,
                  actionLanguageId: actionLanguageId || undefined,
                });
                setNewActionName("");
                setActionInputs([]);
                setActionOutput("");
              }}
            >
              <input
                className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
                placeholder="Action name"
                value={newActionName}
                onChange={(evt) => setNewActionName(evt.target.value)}
              />
              <label className="text-xs text-neutral-400">
                Input types (ctrl/cmd-click for multiple)
                <select
                  className="mt-0.5 w-full rounded border border-neutral-700 bg-neutral-900 px-1 py-1"
                  multiple
                  value={actionInputs}
                  onChange={(evt) =>
                    setActionInputs(Array.from(evt.target.selectedOptions).map((o) => o.value))
                  }
                >
                  {layerEntities.map(({ entity, language: lang }) => (
                    <option key={entity.id} value={entity.id}>
                      {lang.name} / {entity.name}
                    </option>
                  ))}
                </select>
              </label>
              <select
                className="rounded border border-neutral-700 bg-neutral-900 px-1 py-1"
                value={actionOutput}
                onChange={(evt) => setActionOutput(evt.target.value)}
              >
                <option value="">output type…</option>
                {layerEntities.map(({ entity, language: lang }) => (
                  <option key={entity.id} value={entity.id}>
                    {lang.name} / {entity.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded border border-neutral-700 bg-neutral-900 px-1 py-1"
                value={actionLanguageId}
                onChange={(evt) => setActionLanguageId(evt.target.value)}
              >
                <option value="">action language (default: {language.name})</option>
                {Array.from(selectedLayer.languages.values()).map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.name}
                  </option>
                ))}
              </select>
              <button className="rounded bg-neutral-700 px-2 py-1 hover:bg-neutral-600" type="submit">
                Add action
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
