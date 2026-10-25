// The Library's left pane: categories → subcategories → topics, with counts and a health
// dot on every row. Topics load when their subcategory opens. The health filter prunes the
// tree to the branches that have such topics; the search finds categories and topics by name.
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Search, Library, FolderX } from 'lucide-react';
import { adminFetch } from '../../lib/adminUtils.jsx';
import { HealthDot, HealthBadge, needsAttention } from './common.jsx';

const n = v => Number(v ?? 0).toLocaleString();

function keep(totals, health) {
  if (!health) return true;
  if (health === 'attention') return needsAttention(totals);
  return (totals[health] ?? 0) > 0;
}

function Row({ depth, selected, open, onToggle, onClick, dim, children, right }) {
  return (
    <div className={`group flex items-center gap-1.5 pr-2 py-1.5 cursor-pointer select-none text-sm
                     ${selected ? 'bg-[#E8453C]/10 text-[#1A1A2E]' : 'hover:bg-gray-50 text-gray-700'} ${dim ? 'opacity-50' : ''}`}
         style={{ paddingLeft: 8 + depth * 16 }} onClick={onClick}>
      {onToggle
        ? <button type="button" onClick={e => { e.stopPropagation(); onToggle(); }} className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-200">
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        : <span className="w-[18px] shrink-0" />}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div>
      {right}
    </div>
  );
}

export default function Tree({ token, tree, uncategorised, selection, onSelect, filters, version }) {
  const [open, setOpen] = useState(() => new Set());
  const [topics, setTopics] = useState({}); // subId → topics[] | 'loading'
  const [q, setQ] = useState('');
  const [hits, setHits] = useState(null);
  const timer = useRef(null);
  const filterKey = `${filters.health}|${filters.source}|${filters.active}|${version}`;

  // Filters or a change elsewhere: drop the loaded topic lists, reload the open ones
  useEffect(() => {
    setTopics({});
    open.forEach(id => { const c = tree.byId.get(id); if (c && listsTopics(c)) loadTopics(id); });
  }, [filterKey]);

  // Open the selected category, and the branch holding it
  useEffect(() => {
    const c = tree.byId.get(selection.cat);
    if (!c) return;
    setOpen(prev => {
      const next = new Set(prev);
      if (c.parent_id) next.add(c.parent_id);
      next.add(c.id);
      return next;
    });
    if (listsTopics(c) && !topics[c.id]) loadTopics(c.id);
  }, [selection.cat, selection.topic, tree]);

  async function loadTopics(subId) {
    setTopics(t => ({ ...t, [subId]: 'loading' }));
    const qs = new URLSearchParams({ category: subId, sort: 'name', dir: 'asc', limit: 200 });
    for (const k of ['health', 'source', 'active']) if (filters[k]) qs.set(k, filters[k]);
    try {
      const d = await adminFetch(`/admin/library/topics?${qs}`, {}, token);
      setTopics(t => ({ ...t, [subId]: d.topics }));
    } catch { setTopics(t => ({ ...t, [subId]: [] })); }
  }

  // A subcategory lists its topics; so does a root with no subcategories
  const listsTopics = c => !!c.parent_id || c.subs.length === 0;

  function toggle(c) {
    const opening = !open.has(c.id);
    setOpen(prev => {
      const next = new Set(prev);
      if (opening) next.add(c.id); else next.delete(c.id);
      return next;
    });
    if (opening && listsTopics(c) && !topics[c.id]) loadTopics(c.id);
  }

  function leaves(c, depth) {
    const list = topics[c.id];
    const pad = { paddingLeft: 26 + depth * 16 };
    if (list === 'loading' || !list) return <p className="py-1 text-xs text-gray-400" style={pad}>Loading…</p>;
    if (!list.length) return <p className="py-1 text-xs text-gray-400 italic" style={pad}>No topics{filters.health || filters.source || filters.active ? ' match the filters' : ''}</p>;
    return list.map(t => (
      <Row key={t.id} depth={depth} selected={selection.topic === t.id} dim={!t.is_active}
           onClick={() => onSelect({ cat: c.id, topic: t.id })}
           right={t.is_assorted ? <HealthBadge health="assorted" /> : <span className="text-xs text-gray-400">{t.question_count}q</span>}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.health === 'critical' || t.health === 'pending' ? 'bg-red-500' : t.flagged + t.reported > 0 ? 'bg-amber-400' : t.health === 'assorted' ? 'bg-indigo-300' : 'bg-emerald-400'}`} />
        <span className="truncate text-[13px]">{t.name}</span>
      </Row>
    ));
  }

  function onSearch(value) {
    setQ(value);
    clearTimeout(timer.current);
    if (!value.trim()) { setHits(null); return; }
    timer.current = setTimeout(async () => {
      const term = value.trim().toLowerCase();
      const cats = [...tree.byId.values()].filter(c => c.name.toLowerCase().includes(term)).slice(0, 10);
      let found = [];
      try { found = (await adminFetch(`/admin/library/topics?${new URLSearchParams({ q: value.trim(), limit: 30 })}`, {}, token)).topics; } catch {}
      setHits({ cats, topics: found });
    }, 250);
  }

  const pick = sel => { onSelect(sel); setQ(''); setHits(null); };
  const total = tree.roots.reduce((a, r) => a + r.totals.topics, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#E0E0E0] p-2">
        <div className="flex items-center gap-2 rounded-lg border border-[#E0E0E0] bg-gray-50 px-2.5 py-1.5 focus-within:border-[#E8453C]">
          <Search size={14} className="text-gray-400" />
          <input value={q} onChange={e => onSearch(e.target.value)} placeholder="Find a category or topic…"
                 className="w-full bg-transparent text-sm focus:outline-none" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {hits ? (
          <div className="flex flex-col">
            {hits.cats.map(c => (
              <Row key={c.id} depth={0} onClick={() => pick({ cat: c.id })}>
                <span>{c.icon}</span>
                <span className="truncate font-semibold">{c.name}</span>
                <span className="truncate text-xs text-gray-400">{c.parent_id ? tree.byId.get(c.parent_id)?.name : 'category'}</span>
              </Row>
            ))}
            {hits.topics.map(t => (
              <Row key={t.id} depth={0} dim={!t.is_active} onClick={() => pick({ cat: t.category_id ?? 'none', topic: t.id })}>
                <span>{t.icon}</span>
                <span className="truncate">{t.name}</span>
                <span className="truncate text-xs text-gray-400">{t.category_name ?? 'uncategorised'}</span>
              </Row>
            ))}
            {!hits.cats.length && !hits.topics.length && <p className="px-4 py-6 text-center text-sm text-gray-400">Nothing matches.</p>}
          </div>
        ) : (
          <>
            <Row depth={0} selected={!selection.cat && !selection.topic} onClick={() => onSelect({})}
                 right={<span className="text-xs text-gray-400">{n(total)}</span>}>
              <Library size={15} className="text-gray-500" />
              <span className="font-semibold">All topics</span>
            </Row>
            {uncategorised > 0 && (
              <Row depth={0} selected={selection.cat === 'none' && !selection.topic} onClick={() => onSelect({ cat: 'none' })}
                   right={<span className="text-xs font-semibold text-amber-600">{n(uncategorised)}</span>}>
                <FolderX size={15} className="text-amber-500" />
                <span className="font-semibold">Uncategorised</span>
              </Row>
            )}
            {tree.roots.filter(r => keep(r.totals, filters.health)).map(root => (
              <div key={root.id}>
                <Row depth={0} open={open.has(root.id)} onToggle={root.subs.length || root.totals.topics + root.totals.assorted ? () => toggle(root) : undefined}
                     selected={selection.cat === root.id && !selection.topic} dim={!root.is_active}
                     onClick={() => onSelect({ cat: root.id })}
                     right={<span className="text-xs text-gray-400">{n(root.totals.topics)}</span>}>
                  <HealthDot totals={root.totals} />
                  <span>{root.icon}</span>
                  <span className="truncate font-semibold">{root.name}</span>
                </Row>
                {open.has(root.id) && !root.subs.length && leaves(root, 1)}
                {open.has(root.id) && root.subs.filter(s => keep(s.totals, filters.health)).map(sub => (
                  <div key={sub.id}>
                    <Row depth={1} open={open.has(sub.id)} onToggle={() => toggle(sub)}
                         selected={selection.cat === sub.id && !selection.topic} dim={!sub.is_active}
                         onClick={() => onSelect({ cat: sub.id })}
                         right={<span className="text-xs text-gray-400">{n(sub.totals.topics)}</span>}>
                      <HealthDot totals={sub.totals} />
                      <span className="truncate">{sub.name}</span>
                    </Row>
                    {open.has(sub.id) && leaves(sub, 2)}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
