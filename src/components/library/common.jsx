// Shared bits of the Library tab (tabs/LibraryTab.jsx): the category tree model, health and
// source badges, and the category picker used by Move to….
import { Badge } from '../../lib/adminUtils.jsx';

// Health comes from the API (Quizup lib/library.js): pending, critical (< 7 questions),
// low (< 14, the top-up floor), healthy; assorted topics have none.
export const HEALTH = {
  pending:  { label: 'Pending',  color: 'bg-amber-100 text-amber-700' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700' },
  low:      { label: 'Low',      color: 'bg-orange-100 text-orange-700' },
  healthy:  { label: 'Healthy',  color: 'bg-green-100 text-green-700' },
  assorted: { label: 'Assorted', color: 'bg-indigo-100 text-indigo-700' },
};

export const SOURCES = {
  seeded: { label: 'Seed',        color: 'bg-purple-100 text-purple-700' },
  custom: { label: 'Player-made', color: 'bg-sky-100 text-sky-700' },
  admin:  { label: 'Operator',    color: 'bg-orange-100 text-orange-700' },
  image:  { label: 'Pictures',    color: 'bg-teal-100 text-teal-700' },
  system: { label: 'Assorted',    color: 'bg-indigo-100 text-indigo-700' },
};

export function HealthBadge({ health }) {
  const h = HEALTH[health];
  return h ? <Badge color={h.color}>{h.label}</Badge> : null;
}

export function SourceBadge({ source }) {
  const s = SOURCES[source] ?? { label: source, color: 'bg-gray-100 text-gray-600' };
  return <Badge color={s.color}>{s.label}</Badge>;
}

const ZERO = { topics: 0, assorted: 0, off: 0, pending: 0, critical: 0, low: 0, healthy: 0, questions: 0, flagged: 0, reported: 0, games: 0 };

/**
 * The flat list from GET /admin/library/tree as roots with their subcategories. A root's
 * `totals` are its own topics' counts plus every subcategory's.
 */
export function buildTree(categories) {
  const byId = new Map(categories.map(c => [c.id, { ...c, subs: [] }]));
  const roots = [];
  for (const c of byId.values()) {
    if (c.parent_id && byId.has(c.parent_id)) byId.get(c.parent_id).subs.push(c);
    else roots.push(c);
  }
  for (const c of byId.values()) {
    c.totals = { ...ZERO };
    for (const n of [c, ...c.subs]) for (const k of Object.keys(ZERO)) c.totals[k] += n[k] ?? 0;
  }
  return { roots, byId };
}

/** Topics that need a look: still generating, under one game's worth, or with questions to review. */
export const needsAttention = t => t.pending + t.critical + t.flagged + t.reported > 0;

/** A dot for a tree row: red = topics critical or pending, amber = questions to review. */
export function HealthDot({ totals }) {
  const color = totals.critical + totals.pending > 0 ? 'bg-red-500'
    : totals.flagged + totals.reported > 0 ? 'bg-amber-400'
    : 'bg-emerald-400';
  return <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />;
}

/** A <select> of every subcategory (and childless root) to file topics under. */
export function CategoryPicker({ roots, value, onChange, placeholder = 'Move to…', allowNone = false, className = '' }) {
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value)}
            className={`border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-[#E8453C] ${className}`}>
      <option value="" disabled>{placeholder}</option>
      {allowNone && <option value="none">Uncategorised</option>}
      {roots.map(r => (
        <optgroup key={r.id} label={r.name}>
          {r.subs.length
            ? r.subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
            : <option value={r.id}>{r.name}</option>}
        </optgroup>
      ))}
    </select>
  );
}
