import React, { useState } from "react";
import { useWorkspace } from "../state/workspaceStore.js";

/** Languages are top-level, shared resources — this panel is deliberately
 *  separate from the Domains panel (rather than nested inside it) so that
 *  stands on its own: a language doesn't need a domain to exist. */
export function LanguagesPanel() {
  const { state, dispatch } = useWorkspace();
  const [newLanguageName, setNewLanguageName] = useState("");

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Languages</h2>
      <p className="text-xs text-neutral-500">
        A language doesn't need a domain — create one here, then reference it into a domain
        (from the Domains panel) whenever it's ready, or never.
      </p>

      <form
        className="flex gap-1"
        onSubmit={(evt) => {
          evt.preventDefault();
          if (!newLanguageName.trim()) return;
          dispatch({ type: "CREATE_LANGUAGE", name: newLanguageName.trim() });
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

      <ul className="flex flex-col gap-1">
        {Array.from(state.languages.values()).map((language) => {
          const referencingDomains = state.domains.filter((d) => d.languageIds.has(language.id));
          return (
            <li key={language.id} className="flex items-center gap-1">
              <button
                className={`flex-1 rounded px-2 py-1 text-left ${
                  language.id === state.selectedLanguageId ? "bg-blue-600" : "hover:bg-neutral-800"
                }`}
                onClick={() => dispatch({ type: "SELECT_LANGUAGE", languageId: language.id })}
              >
                {language.name}
                <span className="ml-1 text-xs text-neutral-400">
                  ({language.entities.size} entities
                  {referencingDomains.length > 0
                    ? ` — in ${referencingDomains.map((d) => d.name).join(", ")}`
                    : " — unreferenced"}
                  )
                </span>
              </button>
              <button
                className="rounded px-1 text-xs text-neutral-500 hover:text-red-400"
                title="Delete language (and its entities, relationships, actions, interactions)"
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete "${language.name}" and everything in it? This also clears any domain reference and transformation that named it.`
                    )
                  ) {
                    dispatch({ type: "REMOVE_LANGUAGE", languageId: language.id });
                  }
                }}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
