import { useEffect, useState } from 'react';
import { useToastStore } from '../lib/toastStore';
import { Trash2 } from 'lucide-react';
import { adminFetch, Btn, Spinner } from '../lib/adminUtils.jsx';

// ── XP Ranks Editor ───────────────────────────────────────────────────────────
function RanksEditor({ token }) {
  const [ranks, setRanks] = useState(null);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToastStore();

  async function load() {
    try {
      const data = await adminFetch('/admin/config', {}, token);
      const entry = data.find(c => c.key === 'xp_ranks');
      if (entry) setRanks(JSON.parse(entry.value));
    } catch (err) {
      addToast('Failed to load ranks: ' + err.message, 'error');
    }
  }

  useEffect(() => { load(); }, []);

  function update(idx, field, val) {
    setRanks(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  }

  function addRank() {
    setRanks(prev => [...prev, { title: '', min: 0, max: null }]);
  }

  function removeRank(idx) {
    setRanks(prev => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    // Validate + sort by min
    for (const r of ranks) {
      if (!r.title.trim()) return addToast('All ranks must have a title', 'error');
      if (r.min === '' || isNaN(Number(r.min))) return addToast('All ranks must have a valid Min XP', 'error');
    }
    const sorted = [...ranks]
      .map(r => ({ title: r.title.trim(), min: Number(r.min), max: r.max === '' || r.max === null ? null : Number(r.max) }))
      .sort((a, b) => a.min - b.min);
    // Top rank gets max: null
    sorted[sorted.length - 1].max = null;
    setSaving(true);
    try {
      await adminFetch('/admin/config', { method: 'PUT', body: { key: 'xp_ranks', value: JSON.stringify(sorted) } }, token);
      setRanks(sorted);
      addToast('XP ranks saved — takes effect within 30s', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!ranks) return <Spinner />;

  return (
    <div className="bg-white border border-[#E0E0E0] shadow-sm rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[#1A1A2E] font-semibold text-sm">XP Rank Bands</div>
          <div className="text-gray-500 text-xs mt-0.5">Sorted by Min XP. The highest rank always has no ceiling.</div>
        </div>
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
                <td className="py-2 pr-3">
                  <input
                    value={r.title}
                    onChange={e => update(i, 'title', e.target.value)}
                    className="bg-gray-50 border border-[#E0E0E0] rounded-lg px-2 py-1 text-[#1A1A2E] w-28 focus:outline-none focus:border-[#E8453C] text-sm"
                    placeholder="Title"
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    value={r.min}
                    onChange={e => update(i, 'min', e.target.value)}
                    className="bg-gray-50 border border-[#E0E0E0] rounded-lg px-2 py-1 text-[#1A1A2E] w-24 focus:outline-none focus:border-[#E8453C] text-sm"
                  />
                </td>
                <td className="py-2 pr-3">
                  {i === ranks.length - 1
                    ? <span className="text-gray-400 text-xs italic">∞ (top rank)</span>
                    : (
                      <input
                        type="number"
                        value={r.max ?? ''}
                        onChange={e => update(i, 'max', e.target.value)}
                        className="bg-gray-50 border border-[#E0E0E0] rounded-lg px-2 py-1 text-[#1A1A2E] w-24 focus:outline-none focus:border-[#E8453C] text-sm"
                      />
                    )
                  }
                </td>
                <td className="py-2">
                  <button
                    onClick={() => removeRank(i)}
                    disabled={ranks.length <= 2}
                    className="text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                    title="Remove rank"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 pt-1">
        <Btn onClick={addRank} variant="ghost">+ Add Rank</Btn>
        <Btn onClick={save} variant="success" disabled={saving}>{saving ? 'Saving…' : 'Save Ranks'}</Btn>
      </div>
    </div>
  );
}

// ── Tab: Config ───────────────────────────────────────────────────────────────
// Labels, hints, groups and allowed values come from the KWIZ API with each key
// (Quizup backend/services/configSchema.js), which also checks every value saved.

export default function ConfigTab({ token }) {
  const [config, setConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState({});
  const { addToast } = useToastStore();

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetch('/admin/config', {}, token);
      setConfig(data);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save(key) {
    setSaving(s => ({ ...s, [key]: true }));
    try {
      await adminFetch('/admin/config', { method: 'PUT', body: { key, value: editing[key] } }, token);
      addToast(`${config.find(c => c.key === key)?.meta?.label ?? key} updated`, 'success');
      setEditing(e => { const n = { ...e }; delete n[key]; return n; });
      load();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSaving(s => ({ ...s, [key]: false }));
    }
  }

  if (loading) return <Spinner />;

  // Group the keys; the API sends them in schema order, so groups keep that order
  const byGroup = {};
  config.filter(c => c.meta?.input !== 'ranks').forEach(entry => {
    const meta = entry.meta?.label ? entry.meta : { label: entry.key, hint: '', input: 'text', group: 'Other' };
    (byGroup[meta.group] ??= []).push({ ...entry, meta });
  });
  const groupOrder = Object.keys(byGroup);

  function ConfigCard({ entry }) {
    const { key, value, is_default, updated_at, meta } = entry;
    const draft = editing[key] ?? value;
    const isDirty = editing[key] !== undefined && editing[key] !== value;
    const isWide = meta.input === 'textarea' || meta.input === 'text';
    return (
      <div className={`bg-white border border-[#E0E0E0] shadow-sm rounded-xl p-4 flex flex-col gap-2 ${isWide ? 'col-span-2' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[#1A1A2E] font-semibold text-sm">{meta.label}</div>
            <div className="text-gray-500 text-xs mt-0.5 leading-relaxed">{meta.hint}</div>
          </div>
          <div className="shrink-0 mt-0.5">
            {is_default
              ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">default</span>
              : <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-100 text-cyan-700">custom</span>
            }
          </div>
        </div>
        <div className={`flex gap-2 ${isWide ? 'flex-col items-start' : 'items-center'}`}>
          {meta.input === 'toggle' ? (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <button
                role="switch"
                aria-checked={draft === 'true'}
                onClick={async () => {
                  const next = draft === 'true' ? 'false' : 'true';
                  setEditing(ed => ({ ...ed, [key]: next }));
                  setSaving(s => ({ ...s, [key]: true }));
                  try {
                    await adminFetch('/admin/config', { method: 'PUT', body: { key, value: next } }, token);
                    addToast(`${meta.label} ${next === 'true' ? 'enabled' : 'disabled'}`, 'success');
                    setEditing(e => { const n = { ...e }; delete n[key]; return n; });
                    load();
                  } catch (err) {
                    addToast(err.message, 'error');
                    setEditing(e => { const n = { ...e }; delete n[key]; return n; });
                  } finally {
                    setSaving(s => ({ ...s, [key]: false }));
                  }
                }}
                disabled={saving[key]}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
                  ${draft === 'true' ? 'bg-green-500' : 'bg-gray-300'} ${saving[key] ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${draft === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className={`text-sm font-semibold ${draft === 'true' ? 'text-green-600' : 'text-gray-400'}`}>
                {saving[key] ? 'Saving…' : draft === 'true' ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          ) : meta.input === 'textarea' ? (
            <textarea
              value={draft}
              rows={3}
              onChange={e => setEditing(ed => ({ ...ed, [key]: e.target.value }))}
              className="bg-gray-50 border border-[#E0E0E0] text-[#1A1A2E] rounded-lg px-3 py-2
                         text-sm w-full focus:outline-none focus:border-[#E8453C] resize-y font-mono"
            />
          ) : meta.input === 'text' ? (
            <input
              type="text"
              value={draft}
              onChange={e => setEditing(ed => ({ ...ed, [key]: e.target.value }))}
              className="bg-gray-50 border border-[#E0E0E0] text-[#1A1A2E] rounded-lg px-3 py-2
                         text-sm w-full focus:outline-none focus:border-[#E8453C]"
            />
          ) : (
            <input
              type="number"
              step={meta.type === 'int' ? 1 : 'any'}
              min={meta.min}
              max={meta.max}
              value={draft}
              onChange={e => setEditing(ed => ({ ...ed, [key]: e.target.value }))}
              className="bg-gray-50 border border-[#E0E0E0] text-[#1A1A2E] rounded-lg px-3 py-2
                         text-sm w-28 focus:outline-none focus:border-[#E8453C]"
            />
          )}
          {isDirty && (
            <div className="flex gap-2">
              <Btn onClick={() => save(key)} variant="success" disabled={saving[key]}>
                {saving[key] ? 'Saving…' : 'Save'}
              </Btn>
              <Btn onClick={() => setEditing(e => { const n = { ...e }; delete n[key]; return n; })} variant="ghost">
                Cancel
              </Btn>
            </div>
          )}
        </div>
        {meta.type === 'int' || meta.type === 'number'
          ? <div className="text-gray-400 text-xs">Allowed: {meta.min}–{meta.max}{!is_default && <> · default {entry.default}</>}</div>
          : !is_default && entry.default && meta.input !== 'textarea' && <div className="text-gray-400 text-xs truncate">Default: {entry.default}</div>}
        {!is_default && updated_at && (
          <div className="text-gray-400 text-xs">Last updated: {new Date(updated_at).toLocaleString()}</div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[#1A1A2E] font-bold text-lg">Game Configuration</h2>
          <p className="text-gray-500 text-xs mt-0.5">Changes take effect within 30 seconds. New games use the updated values.</p>
        </div>
        <Btn onClick={load} variant="ghost">Refresh</Btn>
      </div>

      <div className="flex flex-col gap-8">
        {groupOrder.filter(g => byGroup[g]?.length).map(group => (
          <div key={group}>
            <h3 className="text-[#1A1A2E] font-bold text-sm uppercase tracking-wider mb-3 pb-2 border-b border-[#E8E8E8]">{group}</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {byGroup[group].map(entry => <ConfigCard key={entry.key} entry={entry} />)}
            </div>
          </div>
        ))}

        <div>
          <h3 className="text-[#1A1A2E] font-bold text-sm uppercase tracking-wider mb-3 pb-2 border-b border-[#E8E8E8]">XP Ranks</h3>
          <RanksEditor token={token} />
        </div>
      </div>
    </div>
  );
}
