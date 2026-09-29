import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import React, { useMemo, useState } from "react";
import { useWorkspace } from "../state/workspaceStore.js";

const COLUMNS = 3;
const CELL_WIDTH = 220;
const CELL_HEIGHT = 140;

/** Spec §8's "Scale 1.0 (World View)": domains as bounded containers,
 *  A/M mediation stacks as the edges between them. Navigating here is an
 *  explicit click (select a domain to drill into its Language View, click a
 *  mediation edge to open its Tau Binding View) rather than a continuous
 *  scroll-to-zoom gesture — the three scales the spec describes are real
 *  views you can navigate between; wiring them to one continuous zoom
 *  gesture on a single shared canvas is a larger effort, left for later. */
export function WorldView() {
  const { state, dispatch } = useWorkspace();
  const [intentId, setIntentId] = useState("");
  const [mediatorId, setMediatorId] = useState("");
  const [implId, setImplId] = useState("");

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = state.domains.map((domain, i) => ({
      id: domain.id,
      position: { x: (i % COLUMNS) * CELL_WIDTH, y: Math.floor(i / COLUMNS) * CELL_HEIGHT },
      data: { label: `${domain.name}\n${domain.isPure ? "(pure)" : `(${domain.languageIds.size} languages)`}` },
      style: {
        background: "#171717",
        color: "#e5e5e5",
        border: "1px solid #525252",
        borderRadius: 8,
        padding: 8,
        width: 180,
        whiteSpace: "pre-line" as const,
        fontSize: 12,
        textAlign: "center" as const,
      },
    }));

    const edges: Edge[] = state.mediations.map((mediation) => ({
      id: mediation.id,
      source: mediation.intentDomainId,
      target: mediation.mediatorDomainId,
      label: "A / M",
      animated: mediation.id === state.selectedMediationId,
      style: {
        stroke: mediation.id === state.selectedMediationId ? "#3b82f6" : "#737373",
        strokeWidth: mediation.id === state.selectedMediationId ? 2 : 1,
      },
      labelStyle: { fill: "#a3a3a3", fontSize: 10 },
    }));

    return { nodes, edges };
  }, [state.domains, state.mediations, state.selectedMediationId]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={(_evt, node) => dispatch({ type: "SELECT_DOMAIN", domainId: node.id })}
          onEdgeClick={(_evt, edge) => dispatch({ type: "SELECT_MEDIATION", mediationId: edge.id })}
          onPaneClick={() => dispatch({ type: "SELECT_MEDIATION", mediationId: null })}
          fitView
          colorMode="dark"
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      <form
        className="flex flex-wrap items-center gap-1 border-t border-neutral-800 p-2 text-xs"
        onSubmit={(evt) => {
          evt.preventDefault();
          if (!intentId || !mediatorId || !implId) return;
          dispatch({
            type: "ADD_MEDIATION",
            intentDomainId: intentId,
            mediatorDomainId: mediatorId,
            implementationDomainId: implId,
          });
          setIntentId("");
          setMediatorId("");
          setImplId("");
        }}
      >
        <span className="text-neutral-400">Add mediation A / M:</span>
        <select
          className="rounded border border-neutral-700 bg-neutral-900 px-1 py-1"
          value={intentId}
          onChange={(evt) => setIntentId(evt.target.value)}
        >
          <option value="">intent domain (A)…</option>
          {state.domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-neutral-700 bg-neutral-900 px-1 py-1"
          value={mediatorId}
          onChange={(evt) => setMediatorId(evt.target.value)}
        >
          <option value="">mediator domain (M)…</option>
          {state.domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-neutral-700 bg-neutral-900 px-1 py-1"
          value={implId}
          onChange={(evt) => setImplId(evt.target.value)}
        >
          <option value="">implementation domain (holds τ)…</option>
          {state.domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button className="rounded bg-neutral-700 px-2 py-1 hover:bg-neutral-600" type="submit">
          Add
        </button>
      </form>
    </div>
  );
}
