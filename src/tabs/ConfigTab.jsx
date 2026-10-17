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
const CONFIG_META = {
  rounds:              { label: 'Rounds per game',              hint: 'Number of questions per match (1–20)', group: 'Gameplay' },
  time_limit:          { label: 'Time limit (seconds)',          hint: 'Seconds allowed per question (5–60)', group: 'Gameplay' },
  score_max_points:    { label: 'Max points per question',       hint: 'Points awarded for an instant correct answer (e.g. 10). Scales down with response time.', group: 'Gameplay' },
  score_min_points:    { label: 'Min points per question',       hint: 'Minimum points for a correct but slow answer (e.g. 2). Must be less than max.', group: 'Gameplay' },
  questions_per_batch: { label: 'Questions per AI batch',        hint: 'How many questions to generate per AI call (50–200)', group: 'Gameplay' },
  // ── Multiplayer XP ──────────────────────────────────────────────────────────
  finish_bonus:        { label: 'Finish bonus XP',              hint: 'XP awarded to each player for completing a multiplayer game', group: 'XP Economy' },
  victory_bonus:       { label: 'Victory bonus XP',             hint: 'Extra XP for winning a multiplayer game', group: 'XP Economy' },
  close_match_bonus:   { label: 'Close match bonus XP',         hint: 'Bonus XP for both players when score difference is ≤ 5 in a decisive match', group: 'XP Economy' },
  win_streak_bonus:    { label: 'Win streak bonus XP (per level)', hint: 'XP awarded per streak level to the winner (e.g. 10 × streak, capped at 5×)', group: 'XP Economy' },
  accuracy_bonus:      { label: 'Accuracy bonus XP',            hint: 'Bonus XP when a player answers ≥ 80% of questions correctly in multiplayer', group: 'XP Economy' },
  // ── Solo XP ─────────────────────────────────────────────────────────────────
  solo_finish_bonus:   { label: 'Solo finish bonus XP',         hint: 'XP awarded for completing a solo game', group: 'XP Economy' },
  solo_perfect_bonus:  { label: 'Solo perfect bonus XP',        hint: 'Extra XP in solo mode for a perfect score (max points on every question)', group: 'XP Economy' },
  solo_speed_bonus:    { label: 'Solo speed bonus XP',          hint: 'Bonus XP in solo mode when average response time is under 5 seconds', group: 'XP Economy' },
  // ── Daily challenge XP ───────────────────────────────────────────────────────
  // ── Login streaks ────────────────────────────────────────────────────────────
  streak_milestones:   { label: 'Login streak milestones (JSON)', hint: 'JSON object mapping streak day count to bonus XP, e.g. {"3":50,"7":150,"30":500}', group: 'XP Economy', textarea: true },
  // ── Content ──────────────────────────────────────────────────────────────────
  problem_solving_keywords: { label: 'Problem-Solving Keywords', hint: 'Comma-separated topic keywords that trigger the problem-solving prompt instead of standard trivia (e.g. maths, coding, algebra). Changes take effect on the next generation.', group: 'Content', textarea: true },
  ingame_reaction_emojis: { label: 'In-Game Reaction Emojis',   hint: 'Comma-separated emoji set shown to players during multiplayer matches (e.g. 🔥,😂,👏,😤,💀,🎯)', group: 'Content', text: true },
  // ── Lifelines (priced in coins; XP is never spent) ──────────────────────────
  lifeline_5050_enabled:        { label: '50/50 lifeline — enabled',        hint: 'Show the 50/50 lifeline (removes 2 wrong answers).', group: 'Lifelines', toggle: true },
  lifeline_shield_enabled:      { label: 'Shield lifeline — enabled',       hint: 'Show the Shield lifeline (a wrong answer counts as right once).', group: 'Lifelines', toggle: true },
  lifeline_scoreheist_enabled:  { label: 'Score Heist lifeline — enabled',  hint: 'Show Score Heist (steals 30% of the opponent\'s score on a right answer; a wrong one costs the same stake from your own match score).', group: 'Lifelines', toggle: true },
  lifeline_doubledip_enabled:   { label: 'Double Dip lifeline — enabled',   hint: 'Show Double Dip (2× points for a right answer this round).', group: 'Lifelines', toggle: true },
  lifeline_5050_coins:          { label: '50/50 — price in coins',          hint: 'Coins taken when 50/50 is used. Default: 20.', group: 'Lifelines' },
  lifeline_shield_coins:        { label: 'Shield — price in coins',         hint: 'Coins taken when Shield is used. Default: 30.', group: 'Lifelines' },
  lifeline_scoreheist_coins:    { label: 'Score Heist — price in coins',    hint: 'Coins taken to arm the heist. Default: 40.', group: 'Lifelines' },
  lifeline_doubledip_coins:     { label: 'Double Dip — price in coins',     hint: 'Coins taken when Double Dip is used. Default: 25.', group: 'Lifelines' },
  // ── Coins ───────────────────────────────────────────────────────────────────
  coins_starting_grant:   { label: 'Starting coins',                 hint: 'Coins every new account gets once, at sign-up. Default: 150.', group: 'Coins' },
  mission_daily_coins:    { label: 'Daily mission reward (coins)',   hint: 'Coins per claimed daily mission, on top of its XP. Default: 10.', group: 'Coins' },
  mission_weekly_coins:   { label: 'Weekly mission reward (coins)',  hint: 'Coins per claimed weekly mission, on top of its XP. Default: 50.', group: 'Coins' },
  reward_track_coins:     { label: 'Daily reward track (coins, JSON)', hint: 'Coins for day 1…7 of the login reward track, e.g. [10,10,15,15,20,25,60]. Missing days pay none.', group: 'Coins', text: true },
  live_win_coins:         { label: 'KWIZ Live win (coins)',          hint: 'Coins each Live winner gets, on top of the XP prize. Default: 100.', group: 'Coins' },
  referral_coins:         { label: 'Invite reward (coins)',          hint: 'Coins for each side when an invited friend finishes their first match. Default: 100.', group: 'Coins' },
  live_extra_life_coins:  { label: 'Live extra life (coins)',        hint: 'Price of an extra KWIZ Live life, bought in the lobby. Unused ones are refunded. Default: 50.', group: 'Coins' },
  live_max_bought_lives:  { label: 'Live extra lives a player may buy', hint: 'Per event. 0 turns buying lives off. Default: 1.', group: 'Coins' },
  // ── KWIZ+ ───────────────────────────────────────────────────────────────────
  plus_enabled:                  { label: 'KWIZ+ — on',                        hint: 'Off: nobody gets KWIZ+ benefits and the paywall is hidden (subscriptions keep running in Play).', group: 'KWIZ+', toggle: true },
  plus_custom_topics_monthly:    { label: 'Brand-new AI topics a month',       hint: 'New custom topics (each one an AI generation) a KWIZ+ player may create per local month. Finding an existing topic is free for everyone. Default: 10.', group: 'KWIZ+' },
  plus_avatars_monthly:          { label: 'Cartoon portraits a month',         hint: 'Comic portraits after the free first one, per local month. Default: 5.', group: 'KWIZ+' },
  plus_free_lifelines_per_match: { label: 'Free lifelines each match',         hint: 'Lifelines that cost no coins in each game. Default: 1.', group: 'KWIZ+' },
  plus_live_lives_per_event:     { label: 'Extra lives each KWIZ Live',        hint: 'Used after the weekly free life, before bought ones. Default: 1.', group: 'KWIZ+' },
  plus_daily_coins:              { label: 'Daily coins',                       hint: 'Coins a KWIZ+ player collects once a local day (the Shop). Default: 30.', group: 'KWIZ+' },
  plus_badge_enabled:            { label: 'KWIZ+ badge on profiles',           hint: 'Show the KWIZ+ badge on subscribers\' profiles.', group: 'KWIZ+', toggle: true },
  // ── Store ───────────────────────────────────────────────────────────────────
  billing_enabled:               { label: 'Selling through Google Play — on',  hint: 'Off hides every buy button (the shop and the KWIZ+ paywall stay up). Coin packs are edited in the Store tab; money prices live in Play Console.', group: 'Store', toggle: true },
  avatar_cartoon_daily_limit:    { label: 'Cartoon portraits a day (anyone)',  hint: 'A safety cap on drawings per player per rolling day. Default: 5.', group: 'Store' },
};

const CONFIG_GROUP_ORDER = ['Gameplay', 'XP Economy', 'Coins', 'Lifelines', 'KWIZ+', 'Store', 'Content'];

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
      addToast(`${CONFIG_META[key]?.label ?? key} updated`, 'success');
      setEditing(e => { const n = { ...e }; delete n[key]; return n; });
      load();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSaving(s => ({ ...s, [key]: false }));
    }
  }

  if (loading) return <Spinner />;

  // Group config entries by their meta group
  const byGroup = {};
  config.filter(c => c.key !== 'xp_ranks').forEach(entry => {
    const meta = CONFIG_META[entry.key] ?? { label: entry.key, hint: '' };
    const g = meta.group ?? 'Other';
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push({ ...entry, meta });
  });
  const groupOrder = [...CONFIG_GROUP_ORDER, ...Object.keys(byGroup).filter(g => !CONFIG_GROUP_ORDER.includes(g))];

  function ConfigCard({ entry: { key, value, is_default, updated_at, meta } }) {
    const draft = editing[key] ?? value;
    const isDirty = editing[key] !== undefined && editing[key] !== value;
    const isWide = meta.textarea || meta.text;
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
          {meta.toggle ? (
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
          ) : meta.textarea ? (
            <textarea
              value={draft}
              rows={3}
              onChange={e => setEditing(ed => ({ ...ed, [key]: e.target.value }))}
              className="bg-gray-50 border border-[#E0E0E0] text-[#1A1A2E] rounded-lg px-3 py-2
                         text-sm w-full focus:outline-none focus:border-[#E8453C] resize-y font-mono"
            />
          ) : meta.text ? (
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
