import "@xyflow/react/dist/style.css";
import "dockview/dist/styles/dockview.css";
import { DockviewReact, type DockviewReadyEvent, type IDockviewPanelProps } from "dockview";
import React from "react";
import { CanvasArea } from "./components/CanvasArea.js";
import { DomainsPanel } from "./components/DomainsPanel.js";
import { EntityPanel } from "./components/EntityPanel.js";
import { InteractionsPanel } from "./components/InteractionsPanel.js";
import { LanguagesPanel } from "./components/LanguagesPanel.js";
import { Toolbar } from "./components/Toolbar.js";
import { ValidationPanel } from "./components/ValidationPanel.js";
import { WorkspaceProvider } from "./state/workspaceStore.js";

function panel(Component: React.ComponentType): React.FC<IDockviewPanelProps> {
  return function Panel() {
    return (
      <div className="h-full overflow-hidden bg-neutral-950 text-neutral-100">
        <Component />
      </div>
    );
  };
}

const components = {
  domains: panel(DomainsPanel),
  languages: panel(LanguagesPanel),
  canvas: panel(CanvasArea),
  entities: panel(EntityPanel),
  interactions: panel(InteractionsPanel),
  validation: panel(ValidationPanel),
};

function onReady(event: DockviewReadyEvent) {
  const api = event.api;
  api.addPanel({ id: "domains", component: "domains", title: "Domains" });
  api.addPanel({
    id: "languages",
    component: "languages",
    title: "Languages",
    position: { referencePanel: "domains", direction: "within" },
  });
  api.addPanel({
    id: "canvas",
    component: "canvas",
    title: "Canvas",
    position: { referencePanel: "domains", direction: "right" },
  });
  api.addPanel({
    id: "entities",
    component: "entities",
    title: "Entities",
    position: { referencePanel: "canvas", direction: "right" },
  });
  api.addPanel({
    id: "interactions",
    component: "interactions",
    title: "Interactions",
    position: { referencePanel: "entities", direction: "below" },
  });
  api.addPanel({
    id: "validation",
    component: "validation",
    title: "Validation",
    position: { referencePanel: "domains", direction: "below" },
  });
}

export function App() {
  return (
    <WorkspaceProvider>
      <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
        <header className="flex items-center gap-4 border-b border-neutral-800 px-4 py-2">
          <div className="flex items-center gap-2">
            <strong>SAVE</strong>
            <span className="text-xs text-neutral-500">System Architecture Visual Editor</span>
          </div>
          <Toolbar />
        </header>
        <div className="min-h-0 flex-1">
          <DockviewReact className="dockview-theme-abyss" components={components} onReady={onReady} />
        </div>
      </div>
    </WorkspaceProvider>
  );
}
