import React from "react";
import { useWorkspace } from "../state/workspaceStore.js";

export function ValidationPanel() {
  const { findings } = useWorkspace();
  const errors = findings.filter((f) => f.severity === "error");
  const warnings = findings.filter((f) => f.severity === "warning");

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-3 text-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Validation ({errors.length} errors, {warnings.length} warnings)
      </h2>
      {findings.length === 0 && <p className="text-xs text-neutral-500">No structural violations.</p>}
      <ul className="flex flex-col gap-1">
        {findings.map((finding, i) => (
          <li
            key={i}
            className={`rounded px-2 py-1 text-xs ${
              finding.severity === "error"
                ? "bg-red-950 text-red-300"
                : "bg-yellow-950 text-yellow-300"
            }`}
          >
            {finding.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
