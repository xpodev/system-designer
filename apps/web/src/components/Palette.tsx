import React from "react";

/** Spec's Vocabulary Palette: a drag source. Dropping this chip onto the
 *  canvas (Canvas.tsx's onDrop) creates a new Entity at the drop position —
 *  the entity's coordinates live in the app's own UI-position map, never in
 *  packages/engine's AST, since where a box sits on screen is a rendering
 *  concern, not a domain one. */
export function Palette() {
  return (
    <div className="flex flex-col gap-2 border-b border-neutral-800 p-3 text-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Vocabulary</h2>
      <div
        className="cursor-grab rounded border border-dashed border-neutral-600 bg-neutral-900 px-3 py-2 text-center text-xs active:cursor-grabbing"
        draggable
        onDragStart={(evt) => {
          evt.dataTransfer.setData("application/save-entity", "1");
          evt.dataTransfer.effectAllowed = "move";
        }}
      >
        + Entity
        <div className="mt-0.5 text-[10px] text-neutral-500">drag onto canvas</div>
      </div>
    </div>
  );
}
