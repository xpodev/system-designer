import type { EntityId } from "@save/engine";
import React, { useState } from "react";
import { useWorkspace } from "../state/workspaceStore.js";

export function EntityPanel() {
  const { state, dispatch, selectedLanguage, selectedEntity } = useWorkspace();
  const [newEntityName, setNewEntityName] = useState("");
  const [newActionName, setNewActionName] = useState("");
  const [actionInputs, setActionInputs] = useState<EntityId[]>([]);
  const [actionOutput, setActionOutput] = useState<EntityId>("");
  const [actionLanguageId, setActionLanguageId] = useState<string>("");
  const [relTargetId, setRelTargetId] = useState<EntityId>("");
  const [relMin, setRelMin] = useState(0);
  const [relMax, setRelMax] = useState(1);

  if (!selectedLanguage) {
    return <div className="p-3 text-sm text-neutral-500">Select or create a language to manage its entities.</div>;
  }

  // Relationships/actions can reference an entity in ANY language in the
  // project — Languages are shared, top-level resources now, not scoped to
  // one domain — so the cross-reference dropdowns list every entity.
  const allEntities = Array.from(state.languages.values()).flatMap((language) =>
    Array.from(language.entities.values()).map((entity) => ({ entity, language }))
  );

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Entities — {selectedLanguage.name}
      </h2>

      <form
        className="flex gap-1"
        onSubmit={(evt) => {
          evt.preventDefault();
          if (!newEntityName.trim() || !state.selectedLanguageId) return;
          dispatch({
            type: "ADD_ENTITY",
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
        {Array.from(selectedLanguage.entities.values()).map((entity) => (
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
                state.selectedLanguageId &&
                dispatch({
                  type: "REMOVE_ENTITY",
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
                const target = allEntities.find((e) => e.entity.id === rel.targetEntityId);
                return (
                  <li key={rel.id} className="flex items-center justify-between gap-1">
                    <span>
                      → {target?.entity.name ?? rel.targetEntityId} [{rel.cardinality[0]}, {rel.cardinality[1]}]
                    </span>
                    <button
                      className="rounded px-1 text-neutral-500 hover:text-red-400"
                      title="Delete relationship"
                      onClick={() =>
                        state.selectedLanguageId &&
                        dispatch({
                          type: "REMOVE_RELATIONSHIP",
                          languageId: state.selectedLanguageId,
                          entityId: selectedEntity.id,
                          relationshipId: rel.id,
                        })
                      }
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
            <form
              className="mt-1 flex flex-wrap items-center gap-1"
              onSubmit={(evt) => {
                evt.preventDefault();
                if (!relTargetId || !state.selectedLanguageId) return;
                dispatch({
                  type: "ADD_RELATIONSHIP",
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
                {allEntities.map(({ entity, language: lang }) => (
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
                <li key={action.id} className="flex items-center justify-between gap-1">
                  <span>
                    {action.name}({action.inputTypes.length} in) →{" "}
                    {allEntities.find((e) => e.entity.id === action.outputType)?.entity.name ??
                      action.outputType}
                  </span>
                  <button
                    className="rounded px-1 text-neutral-500 hover:text-red-400"
                    title="Delete action"
                    onClick={() =>
                      state.selectedLanguageId &&
                      dispatch({
                        type: "REMOVE_ACTION",
                        languageId: state.selectedLanguageId,
                        entityId: selectedEntity.id,
                        actionId: action.id,
                      })
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="mt-1 flex flex-col gap-1"
              onSubmit={(evt) => {
                evt.preventDefault();
                if (!newActionName.trim() || !actionOutput || !state.selectedLanguageId) return;
                dispatch({
                  type: "ADD_ACTION",
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
                  {allEntities.map(({ entity, language: lang }) => (
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
                {allEntities.map(({ entity, language: lang }) => (
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
                <option value="">action language (default: {selectedLanguage.name})</option>
                {Array.from(state.languages.values()).map((lang) => (
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
