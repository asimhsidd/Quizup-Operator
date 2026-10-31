// Admin → Live: the KWIZ Live switch, its daily schedule and prize, recent events,
// and manual events (schedule one with a name, mode and theme; start one now, cancel).
// See lib/live.js. Tap an event for its entrants, eliminations and lives (lib/gameOps.js).
// Bots are left out. Themes, Word Rush puzzles and round reports are views of their own.
import { Fragment, useEffect, useState } from 'react';
import { adminFetch, Badge, Btn, Spinner, timeAgo } from '../lib/adminUtils.jsx';
import { usePlayerStore } from '../store/playerStore';
import { Pills, StatCard, Table, n } from '../components/Panels.jsx';
import SettingsSection from '../components/SettingsSection.jsx';
import LiveThemes from '../components/live/LiveThemes.jsx';
import LivePuzzles from '../components/live/LivePuzzles.jsx';
import LiveReports from '../components/live/LiveReports.jsx';

// The KWIZ Live modes (backend lib/live.js); Mixed takes turns with all the others
const MODES = [['classic', 'Classic'], ['true_false', 'True or False'], ['odd_one_out', 'Odd One Out'], ['word_rush', 'Word Rush'], ['mixed', 'Mixed']];
const modeName = m => MODES.find(([v]) => v === m)?.[1] ?? 'Classic';

const STATUS_COLOR = {
  scheduled: 'bg-cyan-100 text-cyan-700',
  running:   'bg-green-100 text-green-700',
  finished:  'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
};

function EventDetail({ id, token }) {
  const openPlayer = usePlayerStore(s => s.openPlayer);
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    adminFetch(`/admin/live/events/${id}`, {}, token).then(setD).catch(err => setError(err.message));
  }, [id]);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!d) return <Spinner />;
  const t = d.totals;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Entrants" value={n(t.entrants)} sub={`${n(t.reminded)} asked for a reminder`} />
        <StatCard label="Survivors" value={n(t.survivors)} sub={`${n(t.prize_xp)} prize XP paid`} />
        <StatCard label="Lives" value={`${n(t.bought_lives)} + ${n(t.ad_lives)}`} sub={`bought + from ads · ${n(t.lives_used)} used`} />
        <StatCard label="Coins on lives" value={n(t.coins_spent)} sub={t.coins_refunded ? `${n(t.coins_refunded)} refunded (unused)` : 'none refunded'} />
      </div>
      {d.eliminatedByRound.length > 0 && (
        <p className="text-xs text-gray-600">
          Out by round: {d.eliminatedByRound.map(r => `${r.round}: ${r.players}`).join(' · ')}
        </p>
      )}
      <Table
        cols={['Player', 'Joined', 'Result', 'Correct', 'Lives (bought / ad / used)', 'Prize']}
        empty="Nobody joined."
        rows={d.entrants.map(e => (
          <tr key={e.user_id} className="border-b border-gray-100">
            <td className="px-4 py-2"><button type="button" onClick={() => openPlayer(e.user_id)} className="font-semibold text-[#1A1A2E] hover:underline">{e.username}</button></td>
            <td className="px-4 py-2 text-xs text-gray-500">{timeAgo(e.joined_at)}{e.reminded ? ' · reminder' : ''}</td>
            <td className="px-4 py-2 text-xs">{e.eliminated_round ? `out in round ${e.eliminated_round}` : e.correct > 0 ? <span className="font-semibold text-green-700">survived</span> : 'did not play'}</td>
            <td className="px-4 py-2 tabular-nums">{e.correct}</td>
            <td className="px-4 py-2 tabular-nums">{e.bought_lives} / {e.ad_lives} / {e.lives_used}</td>
            <td className="px-4 py-2 tabular-nums">{e.prize_xp ? `${n(e.prize_xp)} XP` : ''}</td>
          </tr>
        ))}
      />
    </div>
  );
}

export default function LiveTab({ token }) {
  const [view, setView] = useState('events');
  return (
    <div className="flex flex-col gap-5">
      <Pills options={[['events', 'Events'], ['themes', 'Themes'], ['puzzles', 'Word Rush puzzles'], ['reports', 'Reports']]} value={view} onChange={setView} />
      {view === 'events' && <LiveEvents token={token} />}
      {view === 'themes' && <LiveThemes token={token} />}
      {view === 'puzzles' && <LivePuzzles token={token} />}
      {view === 'reports' && <LiveReports token={token} />}
    </div>
  );
}

function LiveEvents({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ startsAt: '', prizeXp: '', minPlayers: '', questionCount: '', name: '', mode: 'classic', themeId: '' });
  const [openId, setOpenId] = useState(null);

  async function load() {
    try { setData(await adminFetch('/admin/live', {}, token)); setError(''); }
    catch (err) { setError(err.message || 'Live settings did not load'); }
  }
  useEffect(() => { load(); }, []);

  async function act(fn) {
    setBusy(true);
    try { await fn(); await load(); setError(''); }
    catch (err) { setError(err.message || 'That did not work'); }
    setBusy(false);
  }

  if (!data) return error ? <p className="text-red-600 text-sm">{error}</p> : <Spinner />;
  const s = data.settings;

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#1A1A2E]">KWIZ Live</h2>
            <p className="text-sm text-gray-600">
              {s.enabled
                ? `On. One event a day at ${s.dailyTime} (${s.timezone}). The pool grows ${s.poolPerPlayer ?? 100} XP a player, from ${(s.poolMin ?? 2000).toLocaleString()} up to ${s.prizeXp.toLocaleString()} XP; survivors split it, at least ${s.minEach} each, and get the Champion plate for ${s.championDays ?? 7} days. Under ${s.minPlayers} players it runs as practice with no prize.`
                : 'Off. Players see nothing. Turn it on when there are enough real players to fill a room.'}
            </p>
          </div>
          <Btn
            variant={s.enabled ? 'danger' : 'success'}
            disabled={busy}
            onClick={() => act(() => adminFetch('/admin/live/enabled', { method: 'PUT', body: { enabled: !s.enabled } }, token))}
          >
            {s.enabled ? 'Turn off' : 'Turn on'}
          </Btn>
        </div>
        <p className="text-xs text-gray-500">
          Time, zone, prize, minimum players, question count and round length are in Settings at the bottom of this page.
        </p>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
        <h3 className="font-bold text-[#1A1A2E]">Schedule an event</h3>
        <p className="text-xs text-gray-500">Manual events run whether Live is on or off, which is how to test it with a few accounts.</p>
        <form
          className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end"
          onSubmit={e => {
            e.preventDefault();
            act(() => adminFetch('/admin/live/events', {
              method: 'POST',
              body: {
                startsAt: new Date(form.startsAt).toISOString(),
                name: form.name || null, mode: form.mode, themeId: form.themeId || null,
                ...(form.prizeXp && { prizeXp: Number(form.prizeXp) }),
                ...(form.minPlayers && { minPlayers: Number(form.minPlayers) }),
                ...(form.questionCount && { questionCount: Number(form.questionCount) }),
              },
            }, token));
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 col-span-2 sm:col-span-2">
            Event name (optional)
            <input id="live-name" maxLength={60} value={form.name} placeholder="e.g. Halloween Champs"
                   onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                   className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
            Mode
            <select id="live-mode" value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900">
              {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 col-span-2 sm:col-span-2">
            Theme
            <select id="live-theme" value={form.themeId} onChange={e => setForm(f => ({ ...f, themeId: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900">
              <option value="">Default ({data.themes?.find(t => t.is_default)?.name ?? 'KWIZ Arena'})</option>
              {(data.themes ?? []).filter(t => !t.is_default).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 col-span-2 sm:col-span-2">
            Starts at (your time)
            <input id="live-starts" type="datetime-local" required value={form.startsAt}
                   onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))}
                   className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900" />
          </label>
          {[['prizeXp', 'Max pool XP', s.prizeXp], ['minPlayers', 'Min players', s.minPlayers], ['questionCount', 'Questions', s.questionCount]].map(([key, label, ph]) => (
            <label key={key} className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
              {label}
              <input id={`live-${key}`} type="number" min="0" placeholder={String(ph)} value={form[key]}
                     onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                     className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900" />
            </label>
          ))}
          <div className="col-span-2 sm:col-span-5 flex items-center gap-3">
            <Btn type="submit" variant="primary" disabled={busy}>Schedule</Btn>
            {['word_rush', 'mixed'].includes(form.mode) && (
              <span className="text-xs text-gray-500">
                Word Rush puzzles playable now: {Object.values(data.wordRushStock ?? {}).reduce((a, b) => a + b, 0)} (by difficulty {[1, 2, 3, 4, 5].map(k => `${k}: ${data.wordRushStock?.[k] ?? 0}`).join(', ')}).
                The mode and theme are copied onto the event when it starts.
              </span>
            )}
            {['odd_one_out', 'mixed'].includes(form.mode) && (
              <span className="text-xs text-gray-500">
                Odd One Out puzzles: {Object.values(data.oddStock ?? {}).reduce((a, b) => a + b, 0)} (by difficulty {[1, 2, 3].map(k => `${k}: ${data.oddStock?.[k] ?? 0}`).join(', ')}).
                {form.mode === 'mixed' && ' A kind that runs short hands its turns to classic questions.'}
              </span>
            )}
          </div>
        </form>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>{['Starts', 'Event', 'Status', 'Joined', 'Winners', 'Prize each', 'Lives', ''].map(h => <th key={h} className="text-left px-4 py-2">{h}</th>)}</tr>
          </thead>
          <tbody>
            {data.events.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-500">No events yet.</td></tr>
            )}
            {data.events.map(e => (
              <Fragment key={e.id}>
              <tr className={`border-t border-gray-100 cursor-pointer hover:bg-gray-50 ${openId === e.id ? 'bg-gray-50' : ''}`}
                  onClick={() => setOpenId(id => (id === e.id ? null : e.id))}>
                <td className="px-4 py-2 tabular-nums">{openId === e.id ? '▾ ' : '▸ '}{new Date(e.starts_at).toLocaleString()}</td>
                <td className="px-4 py-2 text-xs" onClick={ev => e.status === 'scheduled' && ev.stopPropagation()}>
                  <div className="font-semibold text-gray-800">{e.name ?? 'KWIZ Live'}</div>
                  {e.status === 'scheduled' ? (
                    <div className="flex gap-1 mt-1">
                      <select value={e.mode} disabled={busy} aria-label="Mode"
                              onChange={ev => act(() => adminFetch(`/admin/live/events/${e.id}`, { method: 'PUT', body: { mode: ev.target.value } }, token))}
                              className="border border-gray-300 rounded px-1 py-0.5">
                        {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <select value={e.theme_id ?? ''} disabled={busy} aria-label="Theme"
                              onChange={ev => act(() => adminFetch(`/admin/live/events/${e.id}`, { method: 'PUT', body: { themeId: ev.target.value || null } }, token))}
                              className="border border-gray-300 rounded px-1 py-0.5">
                        <option value="">Default theme</option>
                        {(data.themes ?? []).filter(t => !t.is_default).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="text-gray-500">{modeName(e.mode)} · {e.theme?.name ?? e.theme_name ?? 'default theme'}
                      {e.open_reports > 0 && <span className="ml-1 text-amber-700 font-semibold">· {e.open_reports} reports</span>}</div>
                  )}
                </td>
                <td className="px-4 py-2">
                  <Badge color={STATUS_COLOR[e.status]}>{e.status}</Badge>
                  {e.practice && <span className="ml-1 text-xs text-gray-500">practice</span>}
                </td>
                <td className="px-4 py-2 tabular-nums">{e.joined}</td>
                <td className="px-4 py-2 tabular-nums">{e.status === 'finished' ? e.winners : '–'}</td>
                <td className="px-4 py-2 tabular-nums">{e.status === 'finished' ? `${e.prize_each} XP` : `up to ${e.prize_xp} XP`}</td>
                <td className="px-4 py-2 tabular-nums text-xs text-gray-600">{e.bought_lives || e.ad_lives ? `${e.bought_lives} bought · ${e.ad_lives} ad` : '–'}</td>
                <td className="px-4 py-2" onClick={ev => ev.stopPropagation()}>
                  {e.status === 'scheduled' && (
                    <div className="flex gap-2">
                      <Btn variant="success" disabled={busy || data.running}
                           onClick={() => act(() => adminFetch(`/admin/live/events/${e.id}/start`, { method: 'POST' }, token))}>Start now</Btn>
                      <Btn variant="danger" disabled={busy}
                           onClick={() => act(() => adminFetch(`/admin/live/events/${e.id}/cancel`, { method: 'POST' }, token))}>Cancel</Btn>
                    </div>
                  )}
                </td>
              </tr>
              {openId === e.id && (
                <tr className="border-t border-gray-100 bg-gray-50/60">
                  <td colSpan={8} className="px-4 py-4"><EventDetail id={e.id} token={token} /></td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </section>
      <SettingsSection token={token} tab="live" />
    </div>
  );
}
