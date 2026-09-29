import React from "react";
import { useWorkspace } from "../state/workspaceStore.js";

/** Spec §8's "Scale 5.0 (τ Binding View)": opened by selecting an A/M edge in
 *  World View. Shows how the mediation's implementation domain translates
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

  const implDomain = state.domains.find((d) => d.id === selectedMediation.implementationDomainId);
  const intentDomain = state.domains.find((d) => d.id === selectedMediation.intentDomainId);
  const mediatorDomain = state.domains.find((d) => d.id === selectedMediation.mediatorDomainId);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4 text-sm">
      <div className="flex items-center gap-2">
        <button
          className="w-fit rounded bg-neutral-700 px-2 py-1 text-xs hover:bg-neutral-600"
          onClick={() => dispatch({ type: "SET_VIEW", view: "world" })}
        >
          ← Back to World
        </button>
        <button
          className="w-fit rounded bg-red-900 px-2 py-1 text-xs hover:bg-red-800"
          onClick={() => {
            dispatch({ type: "REMOVE_MEDIATION", mediationId: selectedMediation.id });
            dispatch({ type: "SET_VIEW", view: "world" });
          }}
        >
          Delete mediation
        </button>
      </div>

      <h2 className="text-base font-semibold">
        {intentDomain?.name ?? "?"} / {mediatorDomain?.name ?? "?"}
      </h2>
      <p className="text-xs text-neutral-500">
        Implementation domain: <strong>{implDomain?.name ?? "?"}</strong>
      </p>

      {!implDomain || implDomain.transformations.size === 0 ? (
        <p className="text-xs text-neutral-500">
          No transformations recorded in the implementation domain yet — add one from the
          Interactions panel while that domain is selected.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {Array.from(implDomain.transformations.values()).map((t) => {
            const sourceLang = state.languages.get(t.sourceLanguageId);
            const targetLang = state.languages.get(t.targetLanguageId);
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
                      {entityName(state.languages, mapping.sourceId)} ↦{" "}
                      {mapping.targetSubgraph.entityIds.map((id) => entityName(state.languages, id)).join(", ") ||
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

function entityName(languages: ReturnType<typeof useWorkspace>["state"]["languages"], entityId: string): string {
  for (const language of languages.values()) {
    const entity = language.entities.get(entityId);
    if (entity) return entity.name;
  }
  return entityId;
}
