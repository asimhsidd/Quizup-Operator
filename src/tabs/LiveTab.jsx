// Admin → Live: the KWIZ Live switch, its daily schedule and prize, recent events,
// and manual events (schedule one, start one now, cancel). See lib/live.js.
import { useEffect, useState } from 'react';
import { adminFetch, Badge, Btn, Spinner } from '../lib/adminUtils.jsx';

const STATUS_COLOR = {
  scheduled: 'bg-cyan-100 text-cyan-700',
  running:   'bg-green-100 text-green-700',
  finished:  'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
};

export default function LiveTab({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ startsAt: '', prizeXp: '', minPlayers: '', questionCount: '' });

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
                ? `On. One event a day at ${s.dailyTime} (${s.timezone}). Survivors split ${s.prizeXp.toLocaleString()} XP, at least ${s.minEach} each. Under ${s.minPlayers} players it runs as practice with no prize.`
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
          Time, zone, prize, minimum players, question count and round length are the live_* keys in Config.
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
                ...(form.prizeXp && { prizeXp: Number(form.prizeXp) }),
                ...(form.minPlayers && { minPlayers: Number(form.minPlayers) }),
                ...(form.questionCount && { questionCount: Number(form.questionCount) }),
              },
            }, token));
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 col-span-2 sm:col-span-2">
            Starts at (your time)
            <input id="live-starts" type="datetime-local" required value={form.startsAt}
                   onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))}
                   className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900" />
          </label>
          {[['prizeXp', 'Prize XP', s.prizeXp], ['minPlayers', 'Min players', s.minPlayers], ['questionCount', 'Questions', s.questionCount]].map(([key, label, ph]) => (
            <label key={key} className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
              {label}
              <input id={`live-${key}`} type="number" min="0" placeholder={String(ph)} value={form[key]}
                     onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                     className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900" />
            </label>
          ))}
          <div className="col-span-2 sm:col-span-5"><Btn type="submit" variant="primary" disabled={busy}>Schedule</Btn></div>
        </form>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>{['Starts', 'Status', 'Joined', 'Winners', 'Prize each', ''].map(h => <th key={h} className="text-left px-4 py-2">{h}</th>)}</tr>
          </thead>
          <tbody>
            {data.events.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">No events yet.</td></tr>
            )}
            {data.events.map(e => (
              <tr key={e.id} className="border-t border-gray-100">
                <td className="px-4 py-2 tabular-nums">{new Date(e.starts_at).toLocaleString()}</td>
                <td className="px-4 py-2">
                  <Badge color={STATUS_COLOR[e.status]}>{e.status}</Badge>
                  {e.practice && <span className="ml-1 text-xs text-gray-500">practice</span>}
                </td>
                <td className="px-4 py-2 tabular-nums">{e.joined}</td>
                <td className="px-4 py-2 tabular-nums">{e.status === 'finished' ? e.winners : '–'}</td>
                <td className="px-4 py-2 tabular-nums">{e.status === 'finished' ? `${e.prize_each} XP` : `${e.prize_xp} XP pool`}</td>
                <td className="px-4 py-2">
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
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
