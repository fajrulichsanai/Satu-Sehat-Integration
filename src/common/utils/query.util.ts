/**
 * Reads a `limit` query parameter safely: missing, non-numeric, zero or
 * negative values give `undefined` (so the caller's default applies), and
 * anything above `max` is capped. A raw negative limit used to reach SQL and
 * fail with a 500.
 */
export function parseLimit(
  raw: string | undefined,
  max = 100,
): number | undefined {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.min(n, max);
}
