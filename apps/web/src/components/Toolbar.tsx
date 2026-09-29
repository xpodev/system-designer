import { deserializeProject, type WireProject } from "@save/transport";
import React, { useRef, useState } from "react";
import { useWorkspace } from "../state/workspaceStore.js";

/**
 * Creating a system, and importing/exporting one, are both storage-level
 * concerns — the same JSON shape @save/transport already uses to talk to
 * IndexedDB or the FastAPI server, just handed to/from a local file instead.
 * Nothing here reaches into @save/engine's domain types beyond Project
 * itself; a system's "name" is UI bookkeeping (projectRegistry.ts), not a
 * domain concept.
 */
export function Toolbar() {
  const { state, projects, switchProject, createProject, importProject, exportProject } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function handleNewSystem() {
    const name = window.prompt("Name this system:", "Untitled system");
    if (!name?.trim()) return;
    createProject(name.trim());
  }

  function handleImportClick() {
    fileInput.current?.click();
  }

  async function handleFileSelected(evt: React.ChangeEvent<HTMLInputElement>) {
    const file = evt.target.files?.[0];
    evt.target.value = "";
    if (!file) return;
    try {
      const wire = JSON.parse(await file.text()) as WireProject;
      const project = deserializeProject(wire);
      const suggested = file.name.replace(/\.json$/i, "");
      const name = window.prompt("Name this imported system:", suggested) ?? suggested;
      importProject(name, project);
      setError(null);
    } catch (err) {
      setError(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <select
        className="rounded border border-neutral-700 bg-neutral-900 px-1 py-1"
        value={state.activeProjectId}
        onChange={(evt) => switchProject(evt.target.value)}
      >
        {projects.length === 0 && <option value={state.activeProjectId}>{state.projectName}</option>}
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button className="rounded bg-neutral-700 px-2 py-1 hover:bg-neutral-600" onClick={handleNewSystem}>
        New system
      </button>
      <button className="rounded bg-neutral-700 px-2 py-1 hover:bg-neutral-600" onClick={exportProject}>
        Export
      </button>
      <button className="rounded bg-neutral-700 px-2 py-1 hover:bg-neutral-600" onClick={handleImportClick}>
        Import
      </button>
      <input ref={fileInput} type="file" accept="application/json" className="hidden" onChange={handleFileSelected} />
      {error && <span className="text-red-400">{error}</span>}
    </div>
  );
}
