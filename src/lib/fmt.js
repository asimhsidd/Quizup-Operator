/** Format an XP (or any large integer) as a short string.
 *  1310  → "1.3K"
 *  12000 → "12K"
 *  1e6   → "1M"
 */
export function fmtXp(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${+(v / 1_000).toFixed(1)}K`;
  return String(v);
}
