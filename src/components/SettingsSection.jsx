// The settings a tab owns, drawn from the config schema the API sends with each key (Quizup
// backend/services/configSchema.js, which also checks every value saved). Which keys show
// where is lib/settingsHome.js. Changes take effect within 30 seconds; new games use them.
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { Btn, Spinner } from '../lib/adminUtils.jsx';
import { useToastStore } from '../lib/toastStore';
import { useConfigStore } from '../store/configStore';
import { useNavStore } from '../store/navStore';
import { homeOf } from '../lib/settingsHome';

const inputCls = 'bg-gray-50 border border-[#E0E0E0] text-[#1A1A2E] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E8453C]';
const handledFocus = new Set();
const isDefault = e => e.is_default || e.value === e.default; // focus nonces already scrolled to, so a remount doesn't jump again

function Toggle({ on, busy, onClick }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onClick}
        disabled={busy}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
          ${on ? 'bg-green-500' : 'bg-gray-300'} ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
      <span className={`text-sm font-semibold ${on ? 'text-green-600' : 'text-gray-400'}`}>
        {busy ? 'Saving…' : on ? 'Enabled' : 'Disabled'}
      </span>
    </label>
  );
}

function SettingCard({ entry, token, highlight }) {
  const { key, value, updated_at, meta } = entry;
  // A stored row equal to the default still counts as default
  const is_default = isDefault(entry);
  const [draft, setDraft] = useState(null); // null = not editing
  const [busy, setBusy] = useState(false);
  const save = useConfigStore(s => s.save);
  const { addToast } = useToastStore();
  const shown = draft ?? value;
  const dirty = draft !== null && draft !== value;
  const wide = meta.input === 'textarea' || meta.input === 'text';

  async function commit(next, message) {
    setBusy(true);
    try {
      await save(token, key, next);
      addToast(message ?? `${meta.label} updated`, 'success');
      setDraft(null);
    } catch (err) { addToast(err.message, 'error'); }
    setBusy(false);
  }

  return (
    <div id={`setting-${key}`}
         className={`bg-white border shadow-sm rounded-xl p-4 flex flex-col gap-2 transition-shadow ${wide ? 'lg:col-span-2' : ''}
           ${highlight ? 'border-[#E8453C] ring-2 ring-[#E8453C]/30' : 'border-[#E0E0E0]'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[#1A1A2E] font-semibold text-sm">{meta.label}</div>
          <div className="text-gray-500 text-xs mt-0.5 leading-relaxed">{meta.hint}</div>
        </div>
        <span className={`shrink-0 mt-0.5 inline-block px-2 py-0.5 rounded-full text-xs font-bold ${is_default ? 'bg-gray-100 text-gray-500' : 'bg-cyan-100 text-cyan-700'}`}>
          {is_default ? 'default' : 'custom'}
        </span>
      </div>
      <div className={`flex gap-2 ${wide ? 'flex-col items-start' : 'items-center'}`}>
        {meta.input === 'toggle' ? (
          <Toggle on={shown === 'true'} busy={busy}
                  onClick={() => { const next = shown === 'true' ? 'false' : 'true'; commit(next, `${meta.label} ${next === 'true' ? 'enabled' : 'disabled'}`); }} />
        ) : meta.input === 'textarea' ? (
          <textarea value={shown} rows={3} onChange={e => setDraft(e.target.value)} className={`${inputCls} w-full resize-y font-mono`} />
        ) : meta.input === 'text' ? (
          <input type="text" value={shown} onChange={e => setDraft(e.target.value)} className={`${inputCls} w-full`} />
        ) : (
          <input type="number" step={meta.type === 'int' ? 1 : 'any'} min={meta.min} max={meta.max} value={shown}
                 onChange={e => setDraft(e.target.value)} className={`${inputCls} w-28`} />
        )}
        {dirty && (
          <div className="flex gap-2">
            <Btn onClick={() => commit(draft)} variant="success" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Btn>
            <Btn onClick={() => setDraft(null)} variant="ghost">Cancel</Btn>
          </div>
        )}
      </div>
      {meta.type === 'int' || meta.type === 'number'
        ? <div className="text-gray-400 text-xs">Allowed: {meta.min}–{meta.max}{!is_default && <> · default {entry.default}</>}</div>
        : !is_default && entry.default && meta.input !== 'textarea' && <div className="text-gray-400 text-xs truncate">Default: {entry.default}</div>}
      {!is_default && updated_at && <div className="text-gray-400 text-xs">Last updated: {new Date(updated_at).toLocaleString()}</div>}
    </div>
  );
}

// xp_ranks: a list of { title, min, max }, edited as a table
function RanksEditor({ entry, token, highlight }) {
  const [ranks, setRanks] = useState(() => JSON.parse(entry.value));
  const [busy, setBusy] = useState(false);
  const save = useConfigStore(s => s.save);
  const { addToast } = useToastStore();
  useEffect(() => { setRanks(JSON.parse(entry.value)); }, [entry.value]);

  const update = (idx, field, val) => setRanks(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));

  async function commit() {
    for (const r of ranks) {
      if (!r.title.trim()) return addToast('All ranks must have a title', 'error');
      if (r.min === '' || isNaN(Number(r.min))) return addToast('All ranks must have a valid Min XP', 'error');
    }
    const sorted = [...ranks]
      .map(r => ({ title: r.title.trim(), min: Number(r.min), max: r.max === '' || r.max === null ? null : Number(r.max) }))
      .sort((a, b) => a.min - b.min);
    sorted[sorted.length - 1].max = null; // the top rank has no ceiling
    setBusy(true);
    try {
      await save(token, 'xp_ranks', JSON.stringify(sorted));
      addToast('XP ranks saved — takes effect within 30s', 'success');
    } catch (err) { addToast(err.message, 'error'); }
    setBusy(false);
  }

  const cell = 'bg-gray-50 border border-[#E0E0E0] rounded-lg px-2 py-1 text-[#1A1A2E] focus:outline-none focus:border-[#E8453C] text-sm';
  return (
    <div id="setting-xp_ranks"
         className={`lg:col-span-2 bg-white border shadow-sm rounded-xl p-4 flex flex-col gap-3 ${highlight ? 'border-[#E8453C] ring-2 ring-[#E8453C]/30' : 'border-[#E0E0E0]'}`}>
      <div>
        <div className="text-[#1A1A2E] font-semibold text-sm">{entry.meta.label}</div>
        <div className="text-gray-500 text-xs mt-0.5">{entry.meta.hint}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs border-b border-[#E0E0E0]">
              <th className="pb-2 pr-3 font-semibold">Title</th>
              <th className="pb-2 pr-3 font-semibold">Min XP</th>
              <th className="pb-2 pr-3 font-semibold">Max XP</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {ranks.map((r, i) => (
              <tr key={i} className="border-b border-[#F0F0F0] last:border-0">
                <td className="py-2 pr-3"><input value={r.title} onChange={e => update(i, 'title', e.target.value)} className={`${cell} w-28`} placeholder="Title" /></td>
                <td className="py-2 pr-3"><input type="number" value={r.min} onChange={e => update(i, 'min', e.target.value)} className={`${cell} w-24`} /></td>
                <td className="py-2 pr-3">
                  {i === ranks.length - 1
                    ? <span className="text-gray-400 text-xs italic">∞ (top rank)</span>
                    : <input type="number" value={r.max ?? ''} onChange={e => update(i, 'max', e.target.value)} className={`${cell} w-24`} />}
                </td>
                <td className="py-2">
                  <button type="button" onClick={() => setRanks(prev => prev.filter((_, j) => j !== i))} disabled={ranks.length <= 2}
                          className="text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors" title="Remove rank">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 pt-1">
        <Btn onClick={() => setRanks(prev => [...prev, { title: '', min: 0, max: null }])} variant="ghost">+ Add Rank</Btn>
        <Btn onClick={commit} variant="success" disabled={busy}>{busy ? 'Saving…' : 'Save Ranks'}</Btn>
      </div>
    </div>
  );
}

/**
 * The settings whose home is this tab (and view). Collapsed to a one-line summary unless
 * `defaultOpen`; the settings search opens it on the key it's looking for.
 */
export default function SettingsSection({ token, tab, view, title = 'Settings', defaultOpen = false }) {
  const { entries, error, load } = useConfigStore();
  const focus = useNavStore(s => s.focus);
  const [open, setOpen] = useState(defaultOpen);
  const [highlight, setHighlight] = useState(null);

  useEffect(() => { if (!entries) load(token); }, []);

  const mine = (entries ?? []).filter(e => {
    const home = homeOf(e);
    return home.tab === tab && (!view || home.view === view);
  });

  useEffect(() => {
    if (!focus?.key || handledFocus.has(focus.nonce) || !mine.some(e => e.key === focus.key)) return;
    handledFocus.add(focus.nonce);
    setOpen(true);
    setHighlight(focus.key);
  }, [focus, entries]);

  // Scroll once the opened card is on the page, and again after the view's own data has
  // loaded above it and pushed it down; then let the highlight fade
  useEffect(() => {
    if (!highlight) return;
    const scroll = () => document.getElementById(`setting-${highlight}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timers = [setTimeout(scroll, 50), setTimeout(scroll, 900), setTimeout(() => setHighlight(null), 3000)];
    return () => timers.forEach(clearTimeout);
  }, [highlight]);

  if (error && !entries) return <p className="text-sm text-red-600">Settings did not load: {error}</p>;
  if (!entries) return <Spinner />;
  if (!mine.length) return null;

  const byGroup = {};
  mine.forEach(e => (byGroup[e.meta?.group ?? 'Other'] ??= []).push(e));
  const groups = Object.keys(byGroup);
  const changed = mine.filter(e => !isDefault(e)).length;

  return (
    <section className="flex flex-col gap-3">
      <button type="button" onClick={() => setOpen(o => !o)}
              className="flex items-center gap-2 border-t border-[#E8E8E8] pt-2 text-left">
        {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        <h3 className="text-[#1A1A2E] font-bold text-base">{title}</h3>
        <span className="text-xs text-gray-400">
          {mine.length} setting{mine.length === 1 ? '' : 's'}{changed ? ` · ${changed} changed from default` : ''} · take effect within 30 s
        </span>
      </button>
      {open && groups.map(group => (
        <div key={group} className="flex flex-col gap-3">
          {groups.length > 1 && <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">{group}</h4>}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {byGroup[group].map(e => e.meta?.input === 'ranks'
              ? <RanksEditor key={e.key} entry={e} token={token} highlight={highlight === e.key} />
              : <SettingCard key={e.key} entry={{ ...e, meta: e.meta?.label ? e.meta : { label: e.key, hint: '', input: 'text' } }} token={token} highlight={highlight === e.key} />)}
          </div>
        </div>
      ))}
    </section>
  );
}
