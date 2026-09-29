import React, { useState } from "react";
import { useWorkspace } from "../state/workspaceStore.js";

export function LayerLanguageTree() {
  const { state, dispatch } = useWorkspace();
  const [newLayerName, setNewLayerName] = useState("");
  const [newLanguageName, setNewLanguageName] = useState("");

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Layers</h2>

      <form
        className="flex gap-1"
        onSubmit={(evt) => {
          evt.preventDefault();
          if (!newLayerName.trim()) return;
          dispatch({ type: "ADD_LAYER", name: newLayerName.trim() });
          setNewLayerName("");
        }}
      >
        <input
          className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
          placeholder="New layer"
          value={newLayerName}
          onChange={(evt) => setNewLayerName(evt.target.value)}
        />
        <button className="rounded bg-neutral-700 px-2 py-1 hover:bg-neutral-600" type="submit">
          Add
        </button>
      </form>

      <ul className="flex flex-col gap-1">
        {state.layers.map((layer) => (
          <li key={layer.id}>
            <button
              className={`w-full rounded px-2 py-1 text-left ${
                layer.id === state.selectedLayerId ? "bg-blue-600" : "hover:bg-neutral-800"
              }`}
              onClick={() => dispatch({ type: "SELECT_LAYER", layerId: layer.id })}
            >
              {layer.name}
              <span className="ml-1 text-xs text-neutral-400">
                {layer.isPure ? "(pure)" : `(${layer.languages.size} languages)`}
              </span>
            </button>

            {layer.id === state.selectedLayerId && (
              <ul className="ml-3 mt-1 flex flex-col gap-1 border-l border-neutral-700 pl-2">
                {Array.from(layer.languages.values()).map((language) => (
                  <li key={language.id}>
                    <button
                      className={`w-full rounded px-2 py-1 text-left ${
                        language.id === state.selectedLanguageId
                          ? "bg-blue-700"
                          : "hover:bg-neutral-800"
                      }`}
                      onClick={() => dispatch({ type: "SELECT_LANGUAGE", languageId: language.id })}
                    >
                      {language.name}
                      <span className="ml-1 text-xs text-neutral-400">
                        ({language.entities.size} entities)
                      </span>
                    </button>
                  </li>
                ))}
                <li>
                  <form
                    className="flex gap-1 py-1"
                    onSubmit={(evt) => {
                      evt.preventDefault();
                      if (!newLanguageName.trim()) return;
                      dispatch({ type: "ADD_LANGUAGE", layerId: layer.id, name: newLanguageName.trim() });
                      setNewLanguageName("");
                    }}
                  >
                    <input
                      className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
                      placeholder="New language"
                      value={newLanguageName}
                      onChange={(evt) => setNewLanguageName(evt.target.value)}
                    />
                    <button className="rounded bg-neutral-700 px-2 py-1 hover:bg-neutral-600" type="submit">
                      Add
                    </button>
                  </form>
                </li>
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
