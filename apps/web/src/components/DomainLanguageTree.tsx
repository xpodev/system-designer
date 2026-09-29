import React, { useState } from "react";
import { useWorkspace } from "../state/workspaceStore.js";

/** Domains reference Languages rather than own them, so this tree shows, per
 *  Domain, the Languages it currently references — each of which may also be
 *  referenced by other Domains. Referencing an existing Language (rather than
 *  creating a new one) is how two Domains end up sharing it. */
export function DomainLanguageTree() {
  const { state, dispatch } = useWorkspace();
  const [newDomainName, setNewDomainName] = useState("");
  const [newLanguageName, setNewLanguageName] = useState("");
  const [referenceLanguageId, setReferenceLanguageId] = useState("");

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Domains</h2>

      <form
        className="flex gap-1"
        onSubmit={(evt) => {
          evt.preventDefault();
          if (!newDomainName.trim()) return;
          dispatch({ type: "ADD_DOMAIN", name: newDomainName.trim() });
          setNewDomainName("");
        }}
      >
        <input
          className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
          placeholder="New domain"
          value={newDomainName}
          onChange={(evt) => setNewDomainName(evt.target.value)}
        />
        <button className="rounded bg-neutral-700 px-2 py-1 hover:bg-neutral-600" type="submit">
          Add
        </button>
      </form>

      <ul className="flex flex-col gap-1">
        {state.domains.map((domain) => {
          const referencedLanguages = Array.from(domain.languageIds)
            .map((id) => state.languages.get(id))
            .filter((l): l is NonNullable<typeof l> => Boolean(l));
          const unreferencedLanguages = Array.from(state.languages.values()).filter(
            (l) => !domain.languageIds.has(l.id)
          );

          return (
            <li key={domain.id}>
              <button
                className={`w-full rounded px-2 py-1 text-left ${
                  domain.id === state.selectedDomainId ? "bg-blue-600" : "hover:bg-neutral-800"
                }`}
                onClick={() => dispatch({ type: "SELECT_DOMAIN", domainId: domain.id })}
              >
                {domain.name}
                <span className="ml-1 text-xs text-neutral-400">
                  {domain.isPure ? "(pure)" : `(${domain.languageIds.size} languages)`}
                </span>
              </button>

              {domain.id === state.selectedDomainId && (
                <ul className="ml-3 mt-1 flex flex-col gap-1 border-l border-neutral-700 pl-2">
                  {referencedLanguages.map((language) => (
                    <li key={language.id} className="flex items-center gap-1">
                      <button
                        className={`flex-1 rounded px-2 py-1 text-left ${
                          language.id === state.selectedLanguageId ? "bg-blue-700" : "hover:bg-neutral-800"
                        }`}
                        onClick={() => dispatch({ type: "SELECT_LANGUAGE", languageId: language.id })}
                      >
                        {language.name}
                        <span className="ml-1 text-xs text-neutral-400">
                          ({language.entities.size} entities)
                        </span>
                      </button>
                      <button
                        className="rounded px-1 text-xs text-neutral-500 hover:text-red-400"
                        title="Unreference (does not delete the language)"
                        onClick={() =>
                          dispatch({ type: "UNREFERENCE_LANGUAGE", domainId: domain.id, languageId: language.id })
                        }
                      >
                        ×
                      </button>
                    </li>
                  ))}

                  <li>
                    <form
                      className="flex gap-1 py-1"
                      onSubmit={(evt) => {
                        evt.preventDefault();
                        if (!newLanguageName.trim()) return;
                        dispatch({ type: "ADD_LANGUAGE", domainId: domain.id, name: newLanguageName.trim() });
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

                  {unreferencedLanguages.length > 0 && (
                    <li>
                      <form
                        className="flex gap-1 py-1"
                        onSubmit={(evt) => {
                          evt.preventDefault();
                          if (!referenceLanguageId) return;
                          dispatch({
                            type: "REFERENCE_LANGUAGE",
                            domainId: domain.id,
                            languageId: referenceLanguageId,
                          });
                          setReferenceLanguageId("");
                        }}
                      >
                        <select
                          className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-1 py-1"
                          value={referenceLanguageId}
                          onChange={(evt) => setReferenceLanguageId(evt.target.value)}
                        >
                          <option value="">reference existing…</option>
                          {unreferencedLanguages.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                        <button className="rounded bg-neutral-700 px-2 py-1 hover:bg-neutral-600" type="submit">
                          Reference
                        </button>
                      </form>
                    </li>
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
