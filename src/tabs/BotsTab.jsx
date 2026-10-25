import { useEffect, useRef, useState } from 'react';
import { Fragment } from 'react';
import { useToastStore } from '../lib/toastStore';
import { adminFetch, Btn, Spinner, SortableTableHeader, makeSortHandler, multiSort, API } from '../lib/adminUtils.jsx';
import { fmtXp } from '../lib/fmt';
import SettingsSection from '../components/SettingsSection.jsx';

function fmtTimeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)   return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const TIER_COLOR = {
  easy:   'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  hard:   'bg-red-100 text-red-700',
};

const REGION_FLAG = { AU: '🇦🇺', US: '🇺🇸', CA: '🇨🇦', EU: '🇪🇺' };

const LOCATION_OPTIONS = [
  { region: 'AU', country: 'Australia',      city: 'Sydney' },
  { region: 'AU', country: 'Australia',      city: 'Melbourne' },
  { region: 'AU', country: 'Australia',      city: 'Brisbane' },
  { region: 'AU', country: 'Australia',      city: 'Perth' },
  { region: 'AU', country: 'Australia',      city: 'Adelaide' },
  { region: 'US', country: 'United States',  city: 'New York' },
  { region: 'US', country: 'United States',  city: 'Los Angeles' },
  { region: 'US', country: 'United States',  city: 'Chicago' },
  { region: 'US', country: 'United States',  city: 'Houston' },
  { region: 'US', country: 'United States',  city: 'Phoenix' },
  { region: 'CA', country: 'Canada',         city: 'Toronto' },
  { region: 'CA', country: 'Canada',         city: 'Vancouver' },
  { region: 'CA', country: 'Canada',         city: 'Montreal' },
  { region: 'CA', country: 'Canada',         city: 'Calgary' },
  { region: 'CA', country: 'Canada',         city: 'Ottawa' },
  { region: 'EU', country: 'United Kingdom', city: 'London' },
  { region: 'EU', country: 'Germany',        city: 'Berlin' },
  { region: 'EU', country: 'France',         city: 'Paris' },
  { region: 'EU', country: 'Netherlands',    city: 'Amsterdam' },
  { region: 'EU', country: 'Spain',          city: 'Madrid' },
];

function MatchHistoryRow({ bot, token, onClose }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToastStore();

  useEffect(() => {
    adminFetch(`/admin/bots/${bot.id}/matches?limit=50`, {}, token)
      .then(d => setMatches(d.matches ?? []))
      .catch(err => addToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [bot.id]);

  return (
    <tr>
      <td colSpan={7} className="px-0 py-0 border-b border-[#E0E0E0]">
        <div className="bg-gray-50 border-t border-[#E0E0E0]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#E0E0E0]">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Match History vs Real Users
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm leading-none">✕</button>
          </div>
          {loading ? (
            <div className="py-6 flex justify-center"><Spinner /></div>
          ) : matches.length === 0 ? (
            <p className="text-center text-gray-400 py-6 text-sm">No matches yet.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 border-b border-[#E0E0E0]">
                  <tr className="text-left text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2 font-semibold">Opponent</th>
                    <th className="px-4 py-2 font-semibold">Topic</th>
                    <th className="px-4 py-2 font-semibold">Score</th>
                    <th className="px-4 py-2 font-semibold">Date</th>
                    <th className="px-4 py-2 font-semibold">Who Won</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map(m => {
                    const botWon  = m.result === 'win';
                    const isDraw  = m.result === 'draw';
                    return (
                      <tr key={m.id} className="border-b border-gray-100 hover:bg-white">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {m.real_user_avatar
                              ? <img src={m.real_user_avatar} className="w-6 h-6 rounded-full object-cover" alt="" />
                              : <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold">{m.real_user_name?.[0]}</div>
                            }
                            <span className="text-[#1A1A2E] font-medium text-xs">{m.real_user_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 text-xs">
                          {m.topic_icon} {m.topic_name ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-mono text-gray-500">
                          {m.bot_score}–{m.real_score}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-400">{fmtTimeAgo(m.created_at)}</td>
                        <td className="px-4 py-2.5">
                          {isDraw ? (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Draw</span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {botWon ? (
                                <>
                                  {bot.avatar_url
                                    ? <img src={bot.avatar_url} className="w-4 h-4 rounded-full object-cover" alt="" />
                                    : <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-[8px] font-bold">{bot.username[0]}</div>
                                  }
                                  <span className="text-xs font-semibold text-green-700">{bot.username}</span>
                                </>
                              ) : (
                                <>
                                  {m.real_user_avatar
                                    ? <img src={m.real_user_avatar} className="w-4 h-4 rounded-full object-cover" alt="" />
                                    : <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-[8px] font-bold">{m.real_user_name?.[0]}</div>
                                  }
                                  <span className="text-xs font-semibold text-blue-700">{m.real_user_name}</span>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function CreateBotPanel({ token, onClose, onCreated }) {
  const [form, setForm] = useState({
    firstName: '', gender: 'male', tier: 'medium',
    locationIdx: 0, active: true,
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const { addToast } = useToastStore();

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!file) { setError('Avatar image is required'); return; }
    if (form.firstName.trim().length < 2) { setError('First name must be at least 2 characters'); return; }
    setSaving(true);
    try {
      const loc = LOCATION_OPTIONS[form.locationIdx];
      const fd = new FormData();
      fd.append('avatar',          file);
      fd.append('firstName',       form.firstName.trim());
      fd.append('gender',          form.gender);
      fd.append('tier',            form.tier);
      fd.append('locationRegion',  loc.region);
      fd.append('locationCountry', loc.country);
      fd.append('locationCity',    loc.city);
      fd.append('active',          String(form.active));

      const res = await fetch(`${API}/admin/bots`, {
        method: 'POST',
        headers: { 'x-admin-token': token },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      addToast(`Bot ${form.firstName} created!`, 'success');
      onCreated(data.bot);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E0E0E0]">
          <h3 className="font-extrabold text-[#1A1A2E] text-base">Create Bot</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {/* Avatar upload */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-2">Profile Picture *</label>
            <div
              className="flex items-center gap-4 cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              {preview
                ? <img src={preview} className="w-16 h-16 rounded-full object-cover border-2 border-[#E8453C]/30" alt="" />
                : <div className="w-16 h-16 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-2xl">+</div>
              }
              <div>
                <div className="text-sm font-semibold text-[#E8453C]">Upload photo</div>
                <div className="text-xs text-gray-400">JPG, PNG — max 10MB</div>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { handleFile(e.target.files[0]); e.target.value = ''; }} />
          </div>

          {/* First name */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">First Name *</label>
            <input
              value={form.firstName}
              onChange={e => set('firstName', e.target.value)}
              placeholder="e.g. Alex"
              className="w-full border border-[#E0E0E0] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#E8453C]"
              required
            />
          </div>

          {/* Gender + Tier */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Gender</label>
              <select value={form.gender} onChange={e => set('gender', e.target.value)}
                className="w-full border border-[#E0E0E0] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#E8453C] bg-white">
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Skill Tier</label>
              <select value={form.tier} onChange={e => set('tier', e.target.value)}
                className="w-full border border-[#E0E0E0] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#E8453C] bg-white">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Location</label>
            <select value={form.locationIdx} onChange={e => set('locationIdx', parseInt(e.target.value))}
              className="w-full border border-[#E0E0E0] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#E8453C] bg-white">
              {LOCATION_OPTIONS.map((loc, i) => (
                <option key={i} value={i}>
                  {REGION_FLAG[loc.region] || ''} {loc.city}, {loc.country}
                </option>
              ))}
            </select>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`w-10 h-6 rounded-full transition-colors relative ${form.active ? 'bg-green-500' : 'bg-gray-300'}`}
              onClick={() => set('active', !form.active)}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.active ? 'left-5' : 'left-1'}`} />
            </div>
            <span className="text-sm text-gray-700 font-medium">Active (available for matchmaking)</span>
          </label>

          {error && <p className="text-red-500 text-xs">{error}</p>}
        </form>
        <div className="px-5 py-4 border-t border-[#E0E0E0] flex gap-2 justify-end">
          <Btn onClick={onClose} variant="ghost">Cancel</Btn>
          <Btn onClick={handleSubmit} variant="primary" disabled={saving || !file || !form.firstName.trim()}>
            {saving ? 'Creating…' : 'Create Bot'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

export default function BotsTab({ token }) {
  const [bots, setBots]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [settings, setSettings]     = useState({});
  const [editSettings, setEditSettings] = useState({});
  const [savingSettings, setSavingSettings] = useState({});
  const [drawerBot, setDrawerBot]   = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [botSortKeys, setBotSortKeys] = useState([]);
  const handleBotSort = makeSortHandler(setBotSortKeys);
  const { addToast } = useToastStore();

  async function load() {
    setLoading(true);
    try {
      const [botsData, settingsData] = await Promise.all([
        adminFetch('/admin/bots', {}, token),
        adminFetch('/admin/bot-settings', {}, token),
      ]);
      setBots(botsData);
      setSettings(settingsData);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(bot) {
    try {
      await adminFetch(`/admin/bots/${bot.id}/active`, { method: 'PATCH', body: { active: !bot.bot_active } }, token);
      setBots(bs => bs.map(b => b.id === bot.id ? { ...b, bot_active: !b.bot_active } : b));
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function saveSetting(key) {
    const meta = SETTINGS_META.find(m => m.key === key);
    const val  = editSettings[key];
    if (!val || isNaN(parseInt(val))) return;
    const dbValue = meta?.isMs ? parseInt(val) * 1000 : parseInt(val);
    setSavingSettings(s => ({ ...s, [key]: true }));
    try {
      await adminFetch('/admin/bot-settings', { method: 'PATCH', body: { key, value: String(dbValue) } }, token);
      setSettings(s => ({ ...s, [key]: dbValue }));
      setEditSettings(e => { const n = { ...e }; delete n[key]; return n; });
      addToast('Setting saved', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSavingSettings(s => ({ ...s, [key]: false }));
    }
  }

  async function saveSettingDirect(key, value) {
    try {
      await adminFetch('/admin/bot-settings', { method: 'PATCH', body: { key, value: String(value) } }, token);
      setSettings(s => ({ ...s, [key]: value }));
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  const sorted = multiSort(bots, botSortKeys);

  const BOT_COLS = [
    { label: 'Bot',         key: 'username'          },
    { label: 'Location',    key: 'location'          },
    { label: 'Tier',        key: 'bot_tier'          },
    { label: 'XP',          key: 'total_xp'          },
    { label: 'Matches',     key: 'real_user_matches' },
    { label: 'Last Active', key: 'last_game_at'      },
    { label: 'Active',      key: 'bot_active'        },
  ];

  const SETTINGS_META = [
    { key: 'matchmaking_bot_delay_ms',               label: 'Matchmaking bot delay',   unit: 's', isMs: true, hint: 'Wait before injecting a bot when no real player is found (default 8s)' },
    { key: 'scheduler_min_delay_ms',                 label: 'Tick interval min',       unit: 's', isMs: true, hint: 'Minimum time between global bot activity ticks (default 60s)' },
    { key: 'scheduler_max_delay_ms',                 label: 'Tick interval max',       unit: 's', isMs: true, hint: 'Maximum time between global bot activity ticks (default 180s = 3 min)' },
    { key: 'bot_cooldown_ms',                        label: 'Per-bot cooldown',        unit: 's', isMs: true, hint: 'How long before the same bot can act again (default 900s = 15 min)' },
    { key: 'max_challenges_per_online_user_per_day', label: 'Max challenges per user/day', unit: '',  isMs: false, hint: 'Max bot challenges a single real user can receive in 24 hours (default 3)' },
  ];

  const challengeOfflineEnabled = !!settings['bots_challenge_offline_users'];

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-6">
      {/* Settings */}
      <div className="bg-white border border-[#E0E0E0] shadow-sm rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-[#1A1A2E] text-base">Bot Settings</h3>
          {/* Master switch */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <span className="text-sm font-semibold text-[#1A1A2E]">Bots Enabled</span>
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={!!settings['bots_enabled']}
                onChange={e => saveSettingDirect('bots_enabled', e.target.checked ? 1 : 0)}
              />
              <div
                onClick={() => saveSettingDirect('bots_enabled', settings['bots_enabled'] ? 0 : 1)}
                className={`w-11 h-6 rounded-full cursor-pointer transition-colors ${settings['bots_enabled'] ? 'bg-green-500' : 'bg-gray-300'}`}
              />
              <div
                onClick={() => saveSettingDirect('bots_enabled', settings['bots_enabled'] ? 0 : 1)}
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform cursor-pointer ${settings['bots_enabled'] ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </div>
          </label>
        </div>
        <div className={`flex flex-col gap-4 max-w-lg ${!settings['bots_enabled'] ? 'opacity-50 pointer-events-none' : ''}`}>
          {SETTINGS_META.map(({ key, label, hint, unit, isMs }) => {
            const rawDb   = settings[key] ?? '';
            const display = rawDb !== '' && isMs ? String(Math.round(Number(rawDb) / 1000)) : String(rawDb);
            const draft   = editSettings[key] ?? display;
            const dirty   = editSettings[key] !== undefined && editSettings[key] !== display;
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <div className="text-sm font-semibold text-[#1A1A2E]">
                  {label}{unit ? <span className="ml-1 text-xs font-normal text-gray-400">({unit})</span> : null}
                </div>
                <div className="text-xs text-gray-400">{hint}</div>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={draft}
                    onChange={e => setEditSettings(es => ({ ...es, [key]: e.target.value }))}
                    className="w-36 border border-[#E0E0E0] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#E8453C]"
                  />
                  {dirty && (
                    <Btn onClick={() => saveSetting(key)} variant="success" disabled={savingSettings[key]}>
                      {savingSettings[key] ? 'Saving…' : 'Save'}
                    </Btn>
                  )}
                  {dirty && (
                    <Btn onClick={() => setEditSettings(es => { const n = { ...es }; delete n[key]; return n; })} variant="ghost">
                      Cancel
                    </Btn>
                  )}
                </div>
              </div>
            );
          })}

          {/* Divider */}
          <div className="border-t border-[#E0E0E0] my-1" />

          {/* Checkboxes */}
          {[
            { key: 'bots_challenge_real_users',    label: 'Bots challenge real users',           hint: 'Allow bots to proactively send challenges to real users' },
            { key: 'bots_accept_challenges',        label: 'Bots accept challenges from real users', hint: 'Allow bots to accept challenges sent by real users. If off, bot challenges are immediately declined.' },
            { key: 'bots_challenge_offline_users',  label: 'Bots challenge offline real users',  hint: 'Allow bots to challenge users who are not currently online' },
          ].map(({ key, label, hint }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!settings[key]}
                  onChange={e => saveSettingDirect(key, e.target.checked ? 1 : 0)}
                  className="w-4 h-4 accent-[#1A1A2E] cursor-pointer"
                />
                <span className="text-sm font-semibold text-[#1A1A2E]">{label}</span>
              </label>
              <div className="text-xs text-gray-400 ml-6">{hint}</div>
            </div>
          ))}

          {/* Divider */}
          <div className="border-t border-[#E0E0E0] my-1" />

          {/* Challenge cap dropdowns */}
          {[
            { key: 'max_challenges_per_online_user_per_day',  label: 'Max bot challenges per online user per 24 hours',  disabled: false },
            { key: 'max_challenges_per_offline_user_per_day', label: 'Max bot challenges per offline user per 24 hours', disabled: !challengeOfflineEnabled },
          ].map(({ key, label, disabled }) => (
            <div key={key} className={`flex flex-col gap-1.5 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="text-sm font-semibold text-[#1A1A2E]">{label}</div>
              <select
                value={settings[key] ?? 3}
                onChange={e => saveSettingDirect(key, parseInt(e.target.value))}
                disabled={disabled}
                className="w-24 border border-[#E0E0E0] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] bg-white focus:outline-none focus:border-[#E8453C]"
              >
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Bot list */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-extrabold text-[#1A1A2E] text-base">
            Bots ({bots.length})
            <span className="ml-2 text-xs font-normal text-gray-400">
              {bots.filter(b => b.bot_active).length} active
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <Btn onClick={() => setShowCreate(true)} variant="primary">+ Create Bot</Btn>
            <Btn onClick={load} variant="ghost">Refresh</Btn>
          </div>
        </div>

        <div className="overflow-x-auto bg-white border border-[#E0E0E0] rounded-xl shadow-sm">
          <table className="w-full text-sm">
            <SortableTableHeader columns={BOT_COLS} sortKeys={botSortKeys} onSort={handleBotSort} />
            <tbody>
              {sorted.map(bot => (
                <Fragment key={bot.id}>
                  <tr className={`border-b border-gray-100 ${drawerBot?.id === bot.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {bot.avatar_url
                          ? <img src={bot.avatar_url} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                          : <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold shrink-0">{bot.username[0]}</div>
                        }
                        <span className="font-semibold text-[#1A1A2E]">{bot.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {REGION_FLAG[bot.bot_location?.region] || ''} {bot.bot_location?.city ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${TIER_COLOR[bot.bot_tier] ?? 'bg-gray-100 text-gray-500'}`}>
                        {bot.bot_tier ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-cyan-600 font-bold text-xs">{fmtXp(bot.total_xp)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDrawerBot(drawerBot?.id === bot.id ? null : bot)}
                        className="text-cyan-600 font-bold text-xs underline-offset-2 hover:underline"
                      >
                        {bot.real_user_matches ?? 0}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtTimeAgo(bot.last_game_at)}</td>
                    <td className="px-4 py-3">
                      {/* Toggle switch */}
                      <div
                        className={`w-9 h-5 rounded-full cursor-pointer transition-colors relative ${bot.bot_active ? 'bg-green-500' : 'bg-gray-300'}`}
                        onClick={() => toggleActive(bot)}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${bot.bot_active ? 'left-4' : 'left-0.5'}`} />
                      </div>
                    </td>
                  </tr>
                  {drawerBot?.id === bot.id && (
                    <MatchHistoryRow bot={bot} token={token} onClose={() => setDrawerBot(null)} />
                  )}
                </Fragment>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 py-8 text-sm">No bots found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateBotPanel
          token={token}
          onClose={() => setShowCreate(false)}
          onCreated={bot => {
            setBots(bs => [bot, ...bs]);
            setShowCreate(false);
          }}
        />
      )}

      <SettingsSection token={token} tab="bots" title="Bots in lists and clans" />
    </div>
  );
}
