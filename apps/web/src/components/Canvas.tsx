import { Background, Controls, ReactFlow, useReactFlow, type Edge, type Node } from "@xyflow/react";
import React, { useMemo } from "react";
import { useWorkspace } from "../state/workspaceStore.js";

const COLUMNS = 4;
const CELL_WIDTH = 200;
const CELL_HEIGHT = 120;

export function Canvas() {
  const { state, dispatch, selectedLayer } = useWorkspace();
  const language = selectedLayer?.languages.get(state.selectedLanguageId ?? "") ?? null;
  const { screenToFlowPosition } = useReactFlow();

  const { nodes, edges } = useMemo(() => {
    if (!language) return { nodes: [] as Node[], edges: [] as Edge[] };

    const entities = Array.from(language.entities.values());
    const nodes: Node[] = entities.map((entity, i) => ({
      id: entity.id,
      position: state.positions[entity.id] ?? {
        x: (i % COLUMNS) * CELL_WIDTH,
        y: Math.floor(i / COLUMNS) * CELL_HEIGHT,
      },
      data: { label: `${entity.name}\n(${entity.actions.length} actions)` },
      selected: entity.id === state.selectedEntityId,
      style: {
        background: "#171717",
        color: "#e5e5e5",
        border: "1px solid #525252",
        borderRadius: 8,
        padding: 8,
        whiteSpace: "pre-line" as const,
        fontSize: 12,
      },
    }));

    const edges: Edge[] = entities.flatMap((entity) =>
      entity.relationships.map((rel) => ({
        id: rel.id,
        source: entity.id,
        target: rel.targetEntityId,
        label: `[${rel.cardinality[0]}, ${rel.cardinality[1]}]`,
        style: { stroke: "#737373" },
        labelStyle: { fill: "#a3a3a3", fontSize: 10 },
      }))
    );

    return { nodes, edges };
  }, [language, state.selectedEntityId, state.positions]);

  if (!selectedLayer) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-500">
        Select or create a layer to begin.
      </div>
    );
  }

  if (!language) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-500">
        Select or add a language in this layer to see its entity graph.
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodeClick={(_evt, node) => dispatch({ type: "SELECT_ENTITY", entityId: node.id })}
      onNodeDragStop={(_evt, node) =>
        dispatch({ type: "SET_POSITION", entityId: node.id, position: node.position })
      }
      onPaneClick={() => dispatch({ type: "SELECT_ENTITY", entityId: null })}
      onDragOver={(evt) => {
        evt.preventDefault();
        evt.dataTransfer.dropEffect = "move";
      }}
      onDrop={(evt) => {
        evt.preventDefault();
        if (!evt.dataTransfer.getData("application/save-entity")) return;
        if (!state.selectedLayerId || !state.selectedLanguageId) return;
        const position = screenToFlowPosition({ x: evt.clientX, y: evt.clientY });
        const name = window.prompt("Entity name", "NewEntity");
        if (!name) return;
        dispatch({
          type: "ADD_ENTITY",
          layerId: state.selectedLayerId,
          languageId: state.selectedLanguageId,
          name,
          position,
        });
      }}
      fitView
      colorMode="dark"
    >
      <Background />
      <Controls />
    </ReactFlow>
  );
}
