import { ReactFlowProvider } from "@xyflow/react";
import React from "react";
import { useWorkspace, type ViewMode } from "../state/workspaceStore.js";
import { Canvas } from "./Canvas.js";
import { Palette } from "./Palette.js";
import { TauView } from "./TauView.js";
import { WorldView } from "./WorldView.js";

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: "world", label: "World" },
  { id: "language", label: "Language" },
  { id: "tau", label: "τ Binding" },
];

export function CanvasArea() {
  const { state, dispatch, selectedDomain } = useWorkspace();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-neutral-800 px-2 py-1 text-xs">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            className={`rounded px-2 py-1 ${
              state.view === v.id ? "bg-blue-600 text-white" : "text-neutral-400 hover:bg-neutral-800"
            }`}
            onClick={() => dispatch({ type: "SET_VIEW", view: v.id })}
          >
            {v.label}
          </button>
        ))}
        {state.view === "language" && selectedDomain && (
          <span className="ml-2 text-neutral-500">— {selectedDomain.name}</span>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {state.view === "world" && <WorldView />}
        {state.view === "tau" && <TauView />}
        {state.view === "language" && (
          <ReactFlowProvider>
            <div className="flex h-full">
              <div className="w-48 border-r border-neutral-800">
                <Palette />
              </div>
              <div className="min-w-0 flex-1">
                <Canvas />
              </div>
            </div>
          </ReactFlowProvider>
        )}
      </div>
    </div>
  );
}
