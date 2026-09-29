import React from "react";
import { useWorkspace } from "../state/workspaceStore.js";

function entityName(layers: ReturnType<typeof useWorkspace>["state"]["layers"], entityId: string): string {
  for (const layer of layers) {
    for (const language of layer.languages.values()) {
      const entity = language.entities.get(entityId);
      if (entity) return entity.name;
    }
  }
  return entityId;
}

/** Spec §8's "Scale 5.0 (τ Binding View)": opened by selecting an A/M edge in
 *  World View. Shows how the mediation's implementation layer translates
 *  entities/interactions from the intent language to the mediator language. */
export function TauView() {
  const { state, dispatch, selectedMediation } = useWorkspace();

  if (!selectedMediation) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-500">
        Select an A / M edge in the World view to inspect its τ bindings.
      </div>
    );
  }

  const implLayer = state.layers.find((l) => l.id === selectedMediation.implementationLayerId);
  const intentLayer = state.layers.find((l) => l.id === selectedMediation.intentLayerId);
  const mediatorLayer = state.layers.find((l) => l.id === selectedMediation.mediatorLayerId);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4 text-sm">
      <button
        className="w-fit rounded bg-neutral-700 px-2 py-1 text-xs hover:bg-neutral-600"
        onClick={() => dispatch({ type: "SET_VIEW", view: "world" })}
      >
        ← Back to World
      </button>

      <h2 className="text-base font-semibold">
        {intentLayer?.name ?? "?"} / {mediatorLayer?.name ?? "?"}
      </h2>
      <p className="text-xs text-neutral-500">
        Implementation layer: <strong>{implLayer?.name ?? "?"}</strong>
      </p>

      {!implLayer || implLayer.transformations.size === 0 ? (
        <p className="text-xs text-neutral-500">
          No transformations recorded in the implementation layer yet — add one from the
          Interactions panel while that layer is selected.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {Array.from(implLayer.transformations.values()).map((t) => {
            const sourceLang = implLayer.languages.get(t.sourceLanguageId);
            const targetLang = implLayer.languages.get(t.targetLanguageId);
            return (
              <div key={t.id} className="rounded border border-neutral-800 p-2">
                <div className="mb-1 font-mono text-xs text-blue-400">
                  τ: {sourceLang?.name ?? "?"} → {targetLang?.name ?? "?"}
                </div>
                <ul className="ml-2 flex flex-col gap-0.5 text-xs">
                  {t.entityMappings.length === 0 && (
                    <li className="text-neutral-500">(no entity mappings)</li>
                  )}
                  {t.entityMappings.map((mapping, i) => (
                    <li key={i} className="font-mono">
                      {entityName(state.layers, mapping.sourceId)} ↦{" "}
                      {mapping.targetSubgraph.entityIds.map((id) => entityName(state.layers, id)).join(", ") ||
                        "(unmapped)"}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
