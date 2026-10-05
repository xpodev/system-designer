/**
 * Rendering a View as a graph: Items as boxes, Links as arrows. A View has no positions, so
 * they are made here — layered, from each Item's level or the longest chain of links into it —
 * and whatever the person drags is kept, by the caller, as a UI attachment.
 */
import { useMemo, useRef, useState, type PointerEvent } from "react";
import type { Item, Link, LinkEnd, View } from "./api";

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
  /** Dragging from one box's handle onto another: what to make of it. Without it, boxes have no handles. */
  onConnect?(source: string, target: string): void;
  /** A double click on empty space, with where it was. */
  onCreate?(at: [number, number]): void;
  /** Some Items are not boxes but text beside a box (an Interaction's signature). */
  height?: number;
}) {
  const { view, saved, selected, onSelect, onMove, onConnect, onCreate } = props;
  const [linking, setLinking] = useState<{ from: string; x: number; y: number; sx: number; sy: number }>();
  const svg = useRef<SVGSVGElement>(null);
  const point = (event: { clientX: number; clientY: number }): [number, number] => {
    const box = svg.current!.getBoundingClientRect();
    return [event.clientX - box.left, event.clientY - box.top];
  };
  const base = useMemo(() => layout(view), [view]);
  const siblings = useMemo(() => parallels(view), [view]);
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
    if (linking) {
      const [x, y] = point(event);
      setLinking({ ...linking, x, y });
      return;
    }
    if (!drag.current) return;
    drag.current.moved = true;
    const { id, dx, dy } = drag.current;
    setMoved((m) => ({ ...m, [id]: [Math.max(0, event.clientX - dx), Math.max(0, event.clientY - dy)] }));
  };
  const up = (subject: string) => {
    if (linking) {
      if (Math.hypot(linking.x - linking.sx, linking.y - linking.sy) > 8) onConnect?.(linking.from, subject);
      setLinking(undefined);
      return;
    }
    const current = drag.current;
    drag.current = undefined;
    if (current?.moved) onMove({ ...saved, ...moved, [current.id]: at(current.id) });
    else onSelect(subject);
  };

  if (tops.length === 0 && !onCreate) return <p className="empty">Nothing to show yet.</p>;
  return (
    <svg
      ref={svg}
      className={`graph ${linking ? "linking" : ""}`}
      width={width}
      height={Math.max(height, props.height ?? 0)}
      onPointerMove={move}
      onPointerUp={() => setLinking(undefined)}
      onDoubleClick={(event) => {
        if (onCreate && event.target === svg.current) onCreate(point(event));
      }}
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className="arrowhead" />
        </marker>
      </defs>
      {linking && (() => {
        const [x, y] = at(linking.from);
        return <line className="linking-line" x1={x + WIDTH} y1={y + HEIGHT / 2} x2={linking.x} y2={linking.y} />;
      })()}
      {view.links.map((link) => {
        if (!base[link.source] || !base[link.target]) return null;
        const shape = route(link, at(link.source), at(link.target), siblings.get(link.id) ?? [0, 1]);
        const select = link.subject ? () => onSelect(link.subject!) : undefined;
        return (
          <g
            key={link.id}
            className={`link ${link.kind.replace(/\s+/g, "-")} ${link.subject && selected === link.subject ? "selected" : ""} ${select ? "selectable" : ""}`}
            onClick={select}
          >
            {select && <path className="hit" d={shape.path} fill="none" />}
            <path d={shape.path} markerEnd={link.ends ? undefined : "url(#arrow)"} fill="none" />
            {link.ends ? (
              <>
                <EndLabel end={link.ends.source} at={shape.start} />
                <EndLabel end={link.ends.target} at={shape.end} />
                <title>{link.label}</title>
              </>
            ) : (
              link.label && (
                <text x={shape.mid[0]} y={shape.mid[1] - 4} textAnchor="middle">
                  {link.label}
                </text>
              )
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
            {onConnect && item.kind === "Entity" && (
              <circle
                className="handle"
                cx={WIDTH}
                cy={HEIGHT / 2}
                r={6}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  (event.target as Element).releasePointerCapture?.(event.pointerId);
                  const [x, y] = point(event);
                  setLinking({ from: item.subject, x, y, sx: x, sy: y });
                }}
              >
                <title>Drag onto an Entity to relate them</title>
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}

type Point = [number, number];

/**
 * Each Link's place among the Links between the same two Items, and how many there are, so
 * that two Relationships between Player and Monster bow apart instead of lying on each other.
 */
function parallels(view: View): Map<string, [number, number]> {
  const groups = new Map<string, string[]>();
  for (const link of view.links) {
    if (link.source === link.target) continue;
    const key = JSON.stringify([link.source, link.target].sort());
    groups.set(key, [...(groups.get(key) ?? []), link.id]);
  }
  const found = new Map<string, [number, number]>();
  for (const ids of groups.values()) ids.forEach((id, index) => found.set(id, [index, ids.length]));
  return found;
}

/** Where a box's edge is, from its centre towards `towards`. */
function edge([cx, cy]: Point, [tx, ty]: Point): Point {
  const dx = tx - cx;
  const dy = ty - cy;
  const t = Math.min(Math.abs(WIDTH / 2 / (dx || 1e-9)), Math.abs(HEIGHT / 2 / (dy || 1e-9)));
  return [cx + dx * t, cy + dy * t];
}

/**
 * A Link's path between two boxes, and where it leaves each: a straight line between their
 * centres cut at their edges, bowed when it has parallels, and a loop beside a box that
 * relates to itself. Each end comes with the way the path heads from it, to set a label by.
 */
function route(link: Link, [x1, y1]: Point, [x2, y2]: Point, [index, count]: [number, number]): { path: string; start: Anchor; end: Anchor; mid: Point } {
  if (link.source === link.target) {
    const top: Point = [x1 + WIDTH - 20, y1];
    const bottom: Point = [x1 + WIDTH - 20, y1 + HEIGHT];
    return {
      path: `M ${top[0]} ${top[1]} C ${x1 + WIDTH + 30} ${y1 - 40}, ${x1 + WIDTH + 30} ${y1 + HEIGHT + 40}, ${bottom[0]} ${bottom[1]}`,
      // A loop's ends read to its right, above and below it, clear of other Links leaving the box.
      start: { at: top, towards: [1, -1], label: [x1 + WIDTH + 14, y1 - 12] },
      end: { at: bottom, towards: [1, 1], label: [x1 + WIDTH + 14, y1 + HEIGHT + 20] },
      mid: [x1 + WIDTH + 34, y1 + HEIGHT / 2],
    };
  }
  const a: Point = [x1 + WIDTH / 2, y1 + HEIGHT / 2];
  const b: Point = [x2 + WIDTH / 2, y2 + HEIGHT / 2];
  // Bow by the Link's place among its parallels, the same way whichever Item it starts from.
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const length = Math.hypot(dx, dy) || 1;
  const flip = link.source < link.target ? 1 : -1;
  const bow = (index - (count - 1) / 2) * 46 * flip;
  const control: Point = [(a[0] + b[0]) / 2 - (dy / length) * bow, (a[1] + b[1]) / 2 + (dx / length) * bow];
  const from = edge(a, control);
  const to = edge(b, control);
  const unit = ([px, py]: Point, [qx, qy]: Point): Point => {
    const d = Math.hypot(qx - px, qy - py) || 1;
    return [(qx - px) / d, (qy - py) / d];
  };
  return {
    path: bow === 0 ? `M ${from[0]} ${from[1]} L ${to[0]} ${to[1]}` : `M ${from[0]} ${from[1]} Q ${control[0]} ${control[1]} ${to[0]} ${to[1]}`,
    start: { at: from, towards: unit(from, control) },
    end: { at: to, towards: unit(to, control) },
    mid: [(from[0] + 2 * control[0] + to[0]) / 4, (from[1] + 2 * control[1] + to[1]) / 4],
  };
}

/** Where a Link leaves a box, and which way it heads from there. */
interface Anchor {
  at: Point;
  towards: Point;
  /** Where its label goes, when not beside the line: a loop's. */
  label?: Point;
}

/**
 * What reads at one end of a Relationship, beside the box of that end's Entity: how many of it
 * there are, and the name it is reached by — a little way along the line, to one side of it.
 */
function EndLabel({ end, at: { at, towards, label } }: { end: LinkEnd; at: Anchor }) {
  if (label) {
    return (
      <text className="end-label" x={label[0]} y={label[1]} textAnchor="start">
        <EndText end={end} />
      </text>
    );
  }
  const [ux, uy] = towards;
  const length = Math.hypot(ux, uy) || 1;
  const [dx, dy] = [ux / length, uy / length];
  // Along the line, then off it to the side that faces away from the box.
  const side = Math.abs(dx) > Math.abs(dy) ? [0, -1] : [dx < 0 || (dx === 0 && dy > 0) ? 1 : -1, 0];
  const x = at[0] + dx * 18 + side[0]! * 9;
  const y = at[1] + dy * 18 + side[1]! * 9 + (side[1]! < 0 ? -2 : 4);
  const anchor = side[0] === 1 ? "start" : side[0] === -1 ? "end" : dx < -0.2 ? "end" : dx > 0.2 ? "start" : "middle";
  return (
    <text className="end-label" x={x} y={y} textAnchor={anchor}>
      <EndText end={end} />
    </text>
  );
}

/** An end, as it reads: `0..N prey`. */
function EndText({ end }: { end: LinkEnd }) {
  return (
    <>
      <tspan className="end-range">{end.range}</tspan>
      {end.name !== undefined ? <tspan className="end-name"> {end.name}</tspan> : <tspan className="end-name unnamed"> (unnamed)</tspan>}
    </>
  );
}
