import type { EntityId, LanguageId, TauMapping } from "@save/engine";
import React, { useMemo, useState } from "react";
import { useWorkspace } from "../state/workspaceStore.js";

export function InteractionsPanel() {
  const { state, dispatch, selectedLayer } = useWorkspace();

  const [interactionName, setInteractionName] = useState("");
  const [inputLangId, setInputLangId] = useState<LanguageId>("");
  const [outputLangId, setOutputLangId] = useState<LanguageId>("");
  const [inputEntityIds, setInputEntityIds] = useState<EntityId[]>([]);
  const [outputEntityId, setOutputEntityId] = useState<EntityId>("");

  const [sourceLangId, setSourceLangId] = useState<LanguageId>("");
  const [targetLangId, setTargetLangId] = useState<LanguageId>("");
  const [entityMap, setEntityMap] = useState<Record<EntityId, EntityId>>({});

  const languages = useMemo(
    () => (selectedLayer ? Array.from(selectedLayer.languages.values()) : []),
    [selectedLayer]
  );

  const interactions = useMemo(
    () => languages.flatMap((lang) => Array.from(lang.interactions.values())),
    [languages]
  );

  const inputLangEntities = useMemo(
    () => (inputLangId ? Array.from(selectedLayer!.languages.get(inputLangId)!.entities.values()) : []),
    [selectedLayer, inputLangId]
  );
  const outputLangEntities = useMemo(
    () => (outputLangId ? Array.from(selectedLayer!.languages.get(outputLangId)!.entities.values()) : []),
    [selectedLayer, outputLangId]
  );
  const sourceLangEntities = useMemo(
    () => (sourceLangId ? Array.from(selectedLayer!.languages.get(sourceLangId)!.entities.values()) : []),
    [selectedLayer, sourceLangId]
  );
  const targetLangEntities = useMemo(
    () => (targetLangId ? Array.from(selectedLayer!.languages.get(targetLangId)!.entities.values()) : []),
    [selectedLayer, targetLangId]
  );

  if (!selectedLayer) return null;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3 text-sm">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Interactions ({interactions.length})
        </h2>
        <ul className="text-xs text-neutral-300">
          {interactions.map((interaction) => (
            <li key={interaction.id}>
              {interaction.name}: {interaction.inputLanguageId === interaction.outputLanguageId ? "pure" : "impure"}
            </li>
          ))}
        </ul>
        <form
          className="mt-1 flex flex-col gap-1"
          onSubmit={(evt) => {
            evt.preventDefault();
            if (!interactionName.trim() || !inputLangId || !outputLangId || !outputEntityId) return;
            dispatch({
              type: "ADD_INTERACTION",
              layerId: selectedLayer.id,
              name: interactionName.trim(),
              inputLanguageId: inputLangId,
              outputLanguageId: outputLangId,
              inputEntityIds,
              outputEntityId,
            });
            setInteractionName("");
            setInputEntityIds([]);
            setOutputEntityId("");
          }}
        >
          <input
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
            placeholder="Interaction name"
            value={interactionName}
            onChange={(evt) => setInteractionName(evt.target.value)}
          />
          <div className="flex gap-1">
            <select
              className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-1 py-1"
              value={inputLangId}
              onChange={(evt) => {
                setInputLangId(evt.target.value);
                setInputEntityIds([]);
              }}
            >
              <option value="">input language…</option>
              {languages.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.name}
                </option>
              ))}
            </select>
            <select
              className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-1 py-1"
              value={outputLangId}
              onChange={(evt) => {
                setOutputLangId(evt.target.value);
                setOutputEntityId("");
              }}
            >
              <option value="">output language…</option>
              {languages.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
          <select
            className="rounded border border-neutral-700 bg-neutral-900 px-1 py-1"
            multiple
            value={inputEntityIds}
            onChange={(evt) => setInputEntityIds(Array.from(evt.target.selectedOptions).map((o) => o.value))}
          >
            {inputLangEntities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </select>
          <select
            className="rounded border border-neutral-700 bg-neutral-900 px-1 py-1"
            value={outputEntityId}
            onChange={(evt) => setOutputEntityId(evt.target.value)}
          >
            <option value="">output entity…</option>
            {outputLangEntities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </select>
          <button className="rounded bg-neutral-700 px-2 py-1 hover:bg-neutral-600" type="submit">
            Add interaction
          </button>
        </form>
      </div>

      <div className="border-t border-neutral-700 pt-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Transformations ({selectedLayer.transformations.size})
        </h2>
        <ul className="text-xs text-neutral-300">
          {Array.from(selectedLayer.transformations.values()).map((t) => (
            <li key={t.id}>
              τ: {selectedLayer.languages.get(t.sourceLanguageId)?.name} →{" "}
              {selectedLayer.languages.get(t.targetLanguageId)?.name} ({t.entityMappings.length} mapped)
            </li>
          ))}
        </ul>
        <form
          className="mt-1 flex flex-col gap-1"
          onSubmit={(evt) => {
            evt.preventDefault();
            if (!sourceLangId || !targetLangId) return;
            const entityMappings: TauMapping<EntityId, EntityId>[] = Object.entries(entityMap)
              .filter(([, targetId]) => targetId)
              .map(([sourceId, targetId]) => ({
                sourceId,
                targetSubgraph: { entityIds: [targetId], interactionIds: [] },
              }));
            dispatch({
              type: "ADD_TRANSFORMATION",
              layerId: selectedLayer.id,
              sourceLanguageId: sourceLangId,
              targetLanguageId: targetLangId,
              entityMappings,
            });
            setEntityMap({});
          }}
        >
          <div className="flex gap-1">
            <select
              className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-1 py-1"
              value={sourceLangId}
              onChange={(evt) => {
                setSourceLangId(evt.target.value);
                setEntityMap({});
              }}
            >
              <option value="">source language (A)…</option>
              {languages.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.name}
                </option>
              ))}
            </select>
            <select
              className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-1 py-1"
              value={targetLangId}
              onChange={(evt) => setTargetLangId(evt.target.value)}
            >
              <option value="">target language (M)…</option>
              {languages.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {sourceLangEntities.length > 0 && (
            <div className="flex flex-col gap-1 rounded border border-neutral-800 p-1">
              {sourceLangEntities.map((entity) => (
                <div key={entity.id} className="flex items-center gap-1 text-xs">
                  <span className="w-24 truncate">{entity.name} ↦</span>
                  <select
                    className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5"
                    value={entityMap[entity.id] ?? ""}
                    onChange={(evt) =>
                      setEntityMap((prev) => ({ ...prev, [entity.id]: evt.target.value }))
                    }
                  >
                    <option value="">(unmapped)</option>
                    {targetLangEntities.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          <button className="rounded bg-neutral-700 px-2 py-1 hover:bg-neutral-600" type="submit">
            Add transformation
          </button>
        </form>
      </div>
    </div>
  );
}
