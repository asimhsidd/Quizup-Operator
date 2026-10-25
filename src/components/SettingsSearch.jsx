// The header's settings search: finds any app_config setting by label, hint or key and
// jumps to the tab (and view) it lives in, where its SettingsSection opens on it.
import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import { useNavStore } from '../store/navStore';
import { homeOf } from '../lib/settingsHome';

export default function SettingsSearch({ token, tabs, views }) {
  const { entries, load } = useConfigStore();
  const go = useNavStore(s => s.go);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const box = useRef(null);

  useEffect(() => {
    function onDown(e) { if (!box.current?.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hits = !words.length ? [] : (entries ?? []).filter(e => {
    const text = `${e.meta?.label ?? ''} ${e.meta?.hint ?? ''} ${e.key} ${e.meta?.group ?? ''}`.toLowerCase();
    return words.every(w => text.includes(w));
  }).slice(0, 12);

  function where(e) {
    const home = homeOf(e);
    const tab = tabs.find(t => t.id === home.tab)?.label ?? home.tab;
    return home.view ? `${tab} · ${views[home.view] ?? home.view}` : tab;
  }

  function pick(e) {
    const home = homeOf(e);
    go(home.tab, { view: home.view, key: e.key });
    setQ('');
    setOpen(false);
  }

  return (
    <div ref={box} className="relative hidden md:block">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 focus-within:border-slate-400">
        <Search size={15} className="text-slate-400" />
        <input
          value={q}
          placeholder="Find a setting…"
          onFocus={() => { if (!entries) load(token); setOpen(true); }}
          onChange={e => { setQ(e.target.value); setCursor(0); setOpen(true); }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, hits.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
            if (e.key === 'Enter' && hits[cursor]) pick(hits[cursor]);
            if (e.key === 'Escape') setOpen(false);
          }}
          className="w-56 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none lg:w-72"
        />
      </div>
      {open && words.length > 0 && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[26rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {!entries && <p className="px-4 py-3 text-sm text-slate-400">Loading settings…</p>}
          {entries && !hits.length && <p className="px-4 py-3 text-sm text-slate-400">No setting matches.</p>}
          {hits.map((e, i) => (
            <button key={e.key} type="button" onMouseEnter={() => setCursor(i)} onClick={() => pick(e)}
                    className={`block w-full px-4 py-2.5 text-left ${i === cursor ? 'bg-slate-50' : ''}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-semibold text-[#172033]">{e.meta?.label ?? e.key}</span>
                <span className="shrink-0 text-[11px] font-semibold text-[#E8453C]">{where(e)}</span>
              </div>
              <div className="truncate text-xs text-slate-400">{e.meta?.hint}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
