import "@xyflow/react/dist/style.css";
import React from "react";
import { Canvas } from "./components/Canvas.js";
import { EntityPanel } from "./components/EntityPanel.js";
import { InteractionsPanel } from "./components/InteractionsPanel.js";
import { LayerLanguageTree } from "./components/LayerLanguageTree.js";
import { ValidationPanel } from "./components/ValidationPanel.js";
import { WorkspaceProvider } from "./state/workspaceStore.js";

export function App() {
  return (
    <WorkspaceProvider>
      <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
        <header className="flex items-center gap-2 border-b border-neutral-800 px-4 py-2">
          <strong>SAVE</strong>
          <span className="text-xs text-neutral-500">System Architecture Visual Editor</span>
        </header>
        <div className="flex min-h-0 flex-1">
          <aside className="w-64 border-r border-neutral-800">
            <LayerLanguageTree />
          </aside>
          <main className="min-w-0 flex-1 border-r border-neutral-800">
            <Canvas />
          </main>
          <aside className="flex w-80 flex-col border-r border-neutral-800">
            <div className="h-1/2 min-h-0 overflow-y-auto border-b border-neutral-800">
              <EntityPanel />
            </div>
            <div className="h-1/2 min-h-0 overflow-y-auto">
              <InteractionsPanel />
            </div>
          </aside>
          <aside className="w-72">
            <ValidationPanel />
          </aside>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
