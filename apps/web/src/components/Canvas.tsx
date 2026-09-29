import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import React, { useMemo } from "react";
import { useWorkspace } from "../state/workspaceStore.js";

const COLUMNS = 4;
const CELL_WIDTH = 200;
const CELL_HEIGHT = 120;

export function Canvas() {
  const { state, dispatch, selectedLayer } = useWorkspace();
  const language = selectedLayer?.languages.get(state.selectedLanguageId ?? "") ?? null;

  const { nodes, edges } = useMemo(() => {
    if (!language) return { nodes: [] as Node[], edges: [] as Edge[] };

    const entities = Array.from(language.entities.values());
    const nodes: Node[] = entities.map((entity, i) => ({
      id: entity.id,
      position: { x: (i % COLUMNS) * CELL_WIDTH, y: Math.floor(i / COLUMNS) * CELL_HEIGHT },
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
  }, [language, state.selectedEntityId]);

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
      onPaneClick={() => dispatch({ type: "SELECT_ENTITY", entityId: null })}
      fitView
      colorMode="dark"
    >
      <Background />
      <Controls />
    </ReactFlow>
  );
}
