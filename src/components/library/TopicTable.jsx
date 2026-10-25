// The Library's topics table, scoped to the selected category (or all of them): sortable,
// filtered by health, source and on/off, with bulk select to top up, regenerate, switch on
// or off, or move. The filters are shared with the tree (LibraryTab owns them).
import { useEffect, useRef, useState } from 'react';
import { adminFetch, Badge, Btn, Paginator, Spinner } from '../../lib/adminUtils.jsx';
import { useToastStore } from '../../lib/toastStore';
import { Pills } from '../Panels.jsx';
import { CategoryPicker, HealthBadge, SourceBadge, SOURCES } from './common.jsx';

const LIMIT = 50;
const HEALTH_FILTERS = [['', 'All'], ['attention', 'Needs attention'], ['critical', 'Critical'], ['pending', 'Pending'], ['low', 'Low'], ['healthy', 'Healthy'], ['assorted', 'Assorted']];
const COLS = [
  { key: 'name', label: 'Topic' },
  { key: null, label: 'Where', where: true },
  { key: 'questions', label: 'Questions' },
  { key: 'health', label: 'Health' },
  { key: 'review', label: 'To review' },
  { key: 'games', label: 'Games' },
  { key: 'created', label: 'Added' },
];

export default function TopicTable({ token, category, scopedToSub, roots, filters, setFilters, onOpenTopic, version, onChanged }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState({ key: 'games', dir: 'desc' });
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const { addToast } = useToastStore();
  const timer = useRef(null);

  async function load(p = page, term = q) {
    const qs = new URLSearchParams({ sort: sort.key, dir: sort.dir, limit: LIMIT, offset: p * LIMIT });
    if (category) qs.set('category', category);
    if (term.trim()) qs.set('q', term.trim());
    for (const k of ['health', 'source', 'active']) if (filters[k]) qs.set(k, filters[k]);
    try { setData(await adminFetch(`/admin/library/topics?${qs}`, {}, token)); }
    catch (err) { addToast(err.message, 'error'); setData({ topics: [], total: 0 }); }
  }

  useEffect(() => { setPage(0); setPicked(new Set()); load(0); }, [category, sort, filters.health, filters.source, filters.active]);
  useEffect(() => { if (version) load(); }, [version]);

  function onSearch(v) {
    setQ(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setPage(0); load(0, v); }, 300);
  }

  function sortBy(key) {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' });
  }

  const rows = data?.topics ?? [];
  const allPicked = rows.length > 0 && rows.every(t => picked.has(t.id));
  function togglePick(id) {
    setPicked(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  async function bulk(action, categoryId) {
    const ids = [...picked];
    const label = { on: 'Switch on', off: 'Switch off', move: 'Move', generate: 'Top up', regenerate: 'Regenerate' }[action];
    if (action === 'regenerate' && !confirm(`Regenerate ${ids.length} topic${ids.length === 1 ? '' : 's'}? Their questions are deleted and a fresh set is generated.`)) return;
    if (action === 'off' && !confirm(`Switch off ${ids.length} topic${ids.length === 1 ? '' : 's'}? Players stop seeing them.`)) return;
    setBusy(true);
    try {
      const r = await adminFetch('/admin/library/topics/bulk', { method: 'POST', body: { ids, action, categoryId } }, token);
      addToast(`${label}: ${r.affected} topic${r.affected === 1 ? '' : 's'}${r.skipped ? `, ${r.skipped} skipped (assorted or picture topics)` : ''}${action === 'generate' || action === 'regenerate' ? ' — generating in the background' : ''}`, 'success');
      setPicked(new Set());
      await load();
      onChanged?.();
    } catch (err) { addToast(err.message, 'error'); }
    setBusy(false);
  }

  const cols = COLS.filter(c => !(c.where && scopedToSub));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pills options={HEALTH_FILTERS} value={filters.health} onChange={v => setFilters(f => ({ ...f, health: v }))} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={e => onSearch(e.target.value)} placeholder="Search these topics…"
               className="w-56 rounded-lg border border-[#E0E0E0] bg-white px-3 py-1.5 text-sm focus:outline-none focus:border-[#E8453C]" />
        <select value={filters.source} onChange={e => setFilters(f => ({ ...f, source: e.target.value }))}
                className="rounded-lg border border-[#E0E0E0] bg-white px-2 py-1.5 text-sm">
          <option value="">Any source</option>
          {Object.entries(SOURCES).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
        <select value={filters.active} onChange={e => setFilters(f => ({ ...f, active: e.target.value }))}
                className="rounded-lg border border-[#E0E0E0] bg-white px-2 py-1.5 text-sm">
          <option value="">On and off</option>
          <option value="on">On</option>
          <option value="off">Off</option>
        </select>
        <span className="text-xs text-gray-400">{data ? `${data.total.toLocaleString()} topic${data.total === 1 ? '' : 's'}` : ''}</span>
      </div>

      {picked.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-[#E8453C]/30 bg-[#FFF5F4] px-3 py-2">
          <span className="text-sm font-bold text-[#1A1A2E]">{picked.size} selected</span>
          <Btn variant="primary" disabled={busy} onClick={() => bulk('generate')}>Top up</Btn>
          <Btn variant="ghost" disabled={busy} onClick={() => bulk('regenerate')}>Regenerate</Btn>
          <Btn variant="success" disabled={busy} onClick={() => bulk('on')}>Switch on</Btn>
          <Btn variant="danger" disabled={busy} onClick={() => bulk('off')}>Switch off</Btn>
          <CategoryPicker roots={roots} value="" onChange={id => bulk('move', id === 'none' ? null : id)} allowNone />
          <button type="button" onClick={() => setPicked(new Set())} className="ml-auto text-xs font-semibold text-gray-500 hover:text-gray-800">Clear</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#E0E0E0] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E0E0E0] bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
              <th className="w-8 px-3 py-2.5">
                <input type="checkbox" checked={allPicked} aria-label="Select all on this page"
                       onChange={() => setPicked(prev => { const next = new Set(prev); rows.forEach(t => allPicked ? next.delete(t.id) : next.add(t.id)); return next; })} />
              </th>
              {cols.map(c => (
                <th key={c.label} className={`px-3 py-2.5 ${c.key ? 'cursor-pointer select-none hover:text-[#1A1A2E]' : ''}`} onClick={c.key ? () => sortBy(c.key) : undefined}>
                  {c.label}{sort.key === c.key && <span className="ml-1 text-[10px]">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.id} onClick={() => onOpenTopic(t)}
                  className={`cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${picked.has(t.id) ? 'bg-[#FFF5F4]' : ''} ${t.is_active ? '' : 'opacity-60'}`}>
                <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={picked.has(t.id)} onChange={() => togglePick(t.id)} aria-label={`Select ${t.name}`} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span>{t.icon}</span>
                    <span className="font-semibold text-[#1A1A2E]">{t.name}</span>
                    <SourceBadge source={t.source} />
                    {!t.is_active && <Badge color="bg-gray-200 text-gray-600">off</Badge>}
                  </div>
                </td>
                {!scopedToSub && (
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {t.category_name ? <>{t.parent_name && <>{t.parent_name} › </>}{t.category_name}</> : <span className="text-amber-600">uncategorised</span>}
                  </td>
                )}
                <td className="px-3 py-2 tabular-nums">{t.is_assorted ? '—' : t.question_count}</td>
                <td className="px-3 py-2"><HealthBadge health={t.health} /></td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">
                  {t.flagged > 0 && <span className="mr-2 font-semibold text-amber-700">{t.flagged} flagged</span>}
                  {t.reported > 0 && <span className="font-semibold text-red-600">{t.reported} reported</span>}
                </td>
                <td className="px-3 py-2 tabular-nums text-gray-600">{t.games_played.toLocaleString()}</td>
                <td className="px-3 py-2 text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data && <Spinner />}
        {data && !rows.length && (
          <p className="py-8 text-center text-sm text-gray-400">
            {filters.health === 'attention' ? 'Nothing needs attention here.' : 'No topics match.'}
          </p>
        )}
        {data && <Paginator page={page} total={data.total} limit={LIMIT} onPage={p => { setPage(p); load(p); }} />}
      </div>
    </div>
  );
}
