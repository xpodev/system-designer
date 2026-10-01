/**
 * Rendering a View as a graph: Items as boxes, Links as arrows. A View has no positions, so
 * they are made here — layered, from each Item's level or the longest chain of links into it —
 * and whatever the person drags is kept, by the caller, as a UI attachment.
 */
import { useMemo, useRef, useState, type PointerEvent } from "react";
import type { Item, View } from "./api";

export type Positions = Record<string, [number, number]>;

const WIDTH = 168;
const HEIGHT = 40;
const GAP_X = 48;
const GAP_Y = 84;

function layout(view: View): Positions {
  const tops = view.items.filter((item) => item.parent === undefined);
  const ids = new Set(tops.map((item) => item.id));
  const incoming = new Map<string, string[]>();
  for (const link of view.links) if (ids.has(link.source) && ids.has(link.target)) incoming.set(link.target, [...(incoming.get(link.target) ?? []), link.source]);
  const level = new Map<string, number>();
  const depth = (id: string, path: Set<string>): number => {
    const known = level.get(id);
    if (known !== undefined) return known;
    const item = tops.find((i) => i.id === id)!;
    if (item.level !== undefined) {
      level.set(id, item.level);
      return item.level;
    }
    path.add(id);
    let deepest = 0;
    for (const source of incoming.get(id) ?? []) if (!path.has(source)) deepest = Math.max(deepest, depth(source, path) + 1);
    path.delete(id);
    level.set(id, deepest);
    return deepest;
  };
  for (const item of tops) depth(item.id, new Set());
  const rows = new Map<number, Item[]>();
  for (const item of tops) rows.set(level.get(item.id)!, [...(rows.get(level.get(item.id)!) ?? []), item]);
  const positions: Positions = {};
  const ordered = [...rows.keys()].sort((a, b) => a - b);
  for (const row of ordered) {
    const items = rows.get(row)!;
    // Order a row by where what links into it sits, so arrows cross less.
    const weight = (item: Item) => {
      const xs = (incoming.get(item.id) ?? []).map((source) => positions[source]?.[0]).filter((x): x is number => x !== undefined);
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Number.POSITIVE_INFINITY;
    };
    items.sort((a, b) => weight(a) - weight(b));
    items.forEach((item, index) => (positions[item.id] = [24 + index * (WIDTH + GAP_X), 24 + row * (HEIGHT + GAP_Y)]));
  }
  return positions;
}

export function Graph(props: {
  view: View;
  saved: Positions;
  selected?: string;
  onSelect(subject: string): void;
  onMove(positions: Positions): void;
}) {
  const { view, saved, selected, onSelect, onMove } = props;
  const base = useMemo(() => layout(view), [view]);
  const [moved, setMoved] = useState<Positions>({});
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | undefined>(undefined);
  const at = (id: string): [number, number] => moved[id] ?? saved[id] ?? base[id] ?? [0, 0];
  const tops = view.items.filter((item) => item.parent === undefined);
  const width = Math.max(600, ...tops.map((item) => at(item.id)[0] + WIDTH + 24));
  const height = Math.max(300, ...tops.map((item) => at(item.id)[1] + HEIGHT + 48));

  const down = (event: PointerEvent, id: string) => {
    const [x, y] = at(id);
    (event.target as Element).setPointerCapture(event.pointerId);
    drag.current = { id, dx: event.clientX - x, dy: event.clientY - y, moved: false };
  };
  const move = (event: PointerEvent) => {
    if (!drag.current) return;
    drag.current.moved = true;
    const { id, dx, dy } = drag.current;
    setMoved((m) => ({ ...m, [id]: [Math.max(0, event.clientX - dx), Math.max(0, event.clientY - dy)] }));
  };
  const up = (subject: string) => {
    const current = drag.current;
    drag.current = undefined;
    if (current?.moved) onMove({ ...saved, ...moved, [current.id]: at(current.id) });
    else onSelect(subject);
  };

  if (tops.length === 0) return <p className="empty">Nothing to show yet.</p>;
  return (
    <svg className="graph" width={width} height={height} onPointerMove={move}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className="arrowhead" />
        </marker>
      </defs>
      {view.links.map((link) => {
        if (!base[link.source] || !base[link.target]) return null;
        const [x1, y1] = at(link.source);
        const [x2, y2] = at(link.target);
        const self = link.source === link.target;
        const from = [x1 + WIDTH / 2, y1 + HEIGHT / 2];
        const to = [x2 + WIDTH / 2, y2 + HEIGHT / 2];
        const path = self
          ? `M ${x1 + WIDTH - 20} ${y1} C ${x1 + WIDTH + 30} ${y1 - 40}, ${x1 + WIDTH + 30} ${y1 + HEIGHT + 40}, ${x1 + WIDTH - 20} ${y1 + HEIGHT}`
          : clip(from, to);
        const mid = self ? [x1 + WIDTH + 34, y1 + HEIGHT / 2] : [(from[0]! + to[0]!) / 2, (from[1]! + to[1]!) / 2];
        return (
          <g key={link.id} className={`link ${link.kind.replace(/\s+/g, "-")}`}>
            <path d={path} markerEnd="url(#arrow)" fill="none" />
            {link.label && (
              <text x={mid[0]} y={mid[1]! - 4} textAnchor="middle">
                {link.label}
              </text>
            )}
          </g>
        );
      })}
      {tops.map((item) => {
        const [x, y] = at(item.id);
        const marked = item.marks.some((m) => m.severity === "error") ? "error" : item.marks.length ? "warning" : "";
        return (
          <g
            key={item.id}
            className={`node ${item.kind} ${marked} ${selected === item.subject ? "selected" : ""}`}
            transform={`translate(${x} ${y})`}
            onPointerDown={(event) => down(event, item.id)}
            onPointerUp={() => up(item.subject)}
          >
            <title>{[item.kind, item.detail, ...item.marks.map((m) => `${m.check}: ${m.message}`)].filter(Boolean).join("\n")}</title>
            <rect width={WIDTH} height={HEIGHT} rx={6} />
            <text x={10} y={16} className="kind">
              {item.kind}
            </text>
            <text x={10} y={32} className="label">
              {item.label.length > 24 ? `${item.label.slice(0, 23)}…` : item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** A straight line between two box centres, cut at the edges of the boxes. */
function clip([x1, y1]: number[], [x2, y2]: number[]): string {
  const cut = (dx: number, dy: number) => {
    const t = Math.min(Math.abs(WIDTH / 2 / (dx || 1e-9)), Math.abs(HEIGHT / 2 / (dy || 1e-9)));
    return [dx * t, dy * t];
  };
  const dx = x2! - x1!;
  const dy = y2! - y1!;
  const [ax, ay] = cut(dx, dy);
  return `M ${x1! + ax!} ${y1! + ay!} L ${x2! - ax!} ${y2! - ay!}`;
}
