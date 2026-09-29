/**
 * By convention, a Relationship's cardinality max of `0` means "unbounded"
 * (displayed as "N") — the common shorthand for "1 or more" is written as
 * `[1, 0]`, not `[1, Infinity]`. This does mean a cardinality can't express
 * "exactly zero max" (a relationship that may never exist), which is an
 * accepted trade-off for not needing a separate sentinel value.
 */
export function isUnboundedMax(max: number): boolean {
  return max === 0;
}

export function formatCardinalityBound(max: number): string {
  return isUnboundedMax(max) ? "N" : String(max);
}

export function formatCardinality([min, max]: [number, number]): string {
  return `[${min}, ${formatCardinalityBound(max)}]`;
}
