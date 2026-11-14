// Player 360 v1 (Quizup docs/retention-plan.md §16.1): how one player plays, from the behaviour
// model. API: GET /admin/users/:id/profile (Quizup lib/profile.js getProfile + lib/skill.js),
// POST /admin/users/:id/profile/rebuild. The profile is rebuilt nightly (17:00 UTC) and topped up
// after each match; ratings update every 5 minutes.
import { useEffect, useState } from 'react';
import { adminFetch, Btn, Spinner, fmtWhen } from '../lib/adminUtils.jsx';
import { useToastStore } from '../lib/toastStore';

const DAYPARTS = ['morning', 'midday', 'afternoon', 'evening', 'night', 'late'];
const DAYPART_HOURS = { morning: '5–10', midday: '10–14', afternoon: '14–17', evening: '17–21', night: '21–1', late: '1–5' };
const MODES = ['solo', 'random', 'duel', 'live'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pct = v => `${Math.round((v ?? 0) * 100)}%`;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
/** 'night:solo:weekday' → 'Night · solo · weekday' */
const ctxLabel = c => c.split(':').map((p, i) => (i ? p : cap(p))).join(' · ');

function Sub({ children }) {
  return <h4 className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{children}</h4>;
}

function Chips({ ids, name, empty = '—' }) {
  if (!ids?.length) return <span className="text-sm text-gray-400">{empty}</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {ids.map(id => <span key={id} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">{name(id)}</span>)}
    </span>
  );
}

/** Cell shade for a 0…max value */
const shade = (v, max) => (v > 0 ? { backgroundColor: `rgba(79, 70, 229, ${0.12 + 0.88 * Math.min(1, v / (max || 1))})` } : undefined);

/** Topics × dayparts: the plays-weighted affinity of each topic in each daypart. */
function AffinityGrid({ affinity, name }) {
  const topics = affinity.filter(a => a.context === '*' && a.plays > 0).slice(0, 8);
  const cell = {};
  for (const a of affinity) {
    if (a.context === '*' || !a.plays) continue;
    const d = a.context.split(':')[0];
    const k = `${a.topicId}|${d}`;
    cell[k] ??= { s: 0, n: 0 };
    cell[k].s += a.score * a.plays;
    cell[k].n += a.plays;
  }
  const val = (t, d) => (cell[`${t}|${d}`] ? cell[`${t}|${d}`].s / cell[`${t}|${d}`].n : 0);
  const max = Math.max(0, ...topics.flatMap(t => DAYPARTS.map(d => val(t.topicId, d))));
  if (!topics.length) return <p className="text-sm text-gray-400">No plays in 90 days.</p>;
  return (
    <table className="w-full table-fixed text-xs">
      <thead>
        <tr className="text-gray-400">
          <th className="w-1/3 text-left font-normal">Topic</th>
          {DAYPARTS.map(d => <th key={d} className="font-normal" title={`${DAYPART_HOURS[d]} local`}>{cap(d)}</th>)}
        </tr>
      </thead>
      <tbody>
        {topics.map(t => (
          <tr key={t.topicId}>
            <td className="truncate py-0.5 pr-2 text-gray-700" title={`overall ${t.score} · ${t.plays} plays`}>{name(t.topicId)}</td>
            {DAYPARTS.map(d => {
              const v = val(t.topicId, d);
              const c = cell[`${t.topicId}|${d}`];
              return (
                <td key={d} className="p-0.5">
                  <div className="h-5 rounded-sm bg-gray-50" style={shade(v, max)}
                       title={c ? `${v.toFixed(2)} · ${c.n} plays` : 'no plays'} />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RhythmGrid({ heat }) {
  if (!heat?.length) return null;
  const max = Math.max(0, ...heat.flat());
  return (
    <div className="flex flex-col gap-px">
      {heat.map((row, d) => (
        <div key={d} className="flex items-center gap-px">
          <span className="w-8 shrink-0 text-[10px] text-gray-400">{DOW[d]}</span>
          {row.map((v, h) => <div key={h} className="h-3 flex-1 rounded-[2px] bg-gray-50" style={shade(v, max)} title={`${DOW[d]} ${h}:00 · ${v}`} />)}
        </div>
      ))}
      <div className="flex gap-px pl-8 text-[9px] text-gray-400">
        {Array.from({ length: 24 }, (_, h) => <span key={h} className="flex-1 text-center">{h % 6 === 0 ? h : ''}</span>)}
      </div>
    </div>
  );
}

export default function PlayerBehaviour({ userId, token }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { addToast } = useToastStore();

  async function load() {
    try { setP(await adminFetch(`/admin/users/${userId}/profile`, {}, token)); setError(''); }
    catch (err) { setError(err.message); }
  }
  useEffect(() => { setP(null); load(); }, [userId]);

  async function rebuild() {
    setBusy(true);
    try {
      await adminFetch(`/admin/users/${userId}/profile/rebuild`, { method: 'POST' }, token);
      addToast('Profile rebuilt', 'success');
      await load();
    } catch (err) { addToast(err.message, 'error'); }
    setBusy(false);
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!p) return <Spinner />;
  const name = id => p.names.topics[id] ?? p.names.categories[id] ?? id.slice(0, 8);
  const todayPlays = Object.values(p.today.plays ?? {}).reduce((a, b) => a + b, 0);
  const r = p.rhythm ?? {};
  const mixRows = DAYPARTS.filter(d => p.modeMix?.[d]);

  return (
    <div className="text-sm text-gray-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          {p.builtAt ? `Built ${fmtWhen(p.builtAt)}` : 'Not built yet'} · {p.plays90d} plays in 90 days
          {todayPlays ? ` · +${todayPlays} since` : ''}
          {p.breadth != null ? ` · breadth ${p.breadth} bits` : ''}
        </p>
        <Btn variant="ghost" onClick={rebuild} disabled={busy}>{busy ? 'Rebuilding…' : 'Rebuild now'}</Btn>
      </div>

      <div className="mt-2 grid grid-cols-[6rem_1fr] gap-x-2 gap-y-1.5">
        <span className="text-xs text-gray-400">Core</span><Chips ids={p.core} name={name} />
        <span className="text-xs text-gray-400">Rising</span><Chips ids={p.rising} name={name} />
        <span className="text-xs text-gray-400">Fading</span><Chips ids={p.fading} name={name} />
        <span className="text-xs text-gray-400" title="Viewed or searched 3+ times in 14 days, not played">Wanted</span><Chips ids={p.wanted} name={name} />
      </div>

      <Sub>Habitats</Sub>
      {p.habitats.length === 0 ? <p className="text-sm text-gray-400">None yet (a context needs 3+ plays and 10% of their play).</p> : (
        <ul className="flex flex-col gap-1">
          {p.habitats.map(h => (
            <li key={h.context} className="flex flex-wrap items-center gap-2">
              <span className="w-48 shrink-0 text-xs font-semibold">{ctxLabel(h.context)} <span className="font-normal text-gray-400">{pct(h.share)}</span></span>
              <Chips ids={h.topics} name={name} />
            </li>
          ))}
        </ul>
      )}

      <Sub>Topic affinity by time of day</Sub>
      <AffinityGrid affinity={p.affinity} name={name} />

      <Sub>Mode mix by time of day</Sub>
      {mixRows.length === 0 ? <p className="text-sm text-gray-400">—</p> : (
        <table className="w-full text-xs">
          <thead><tr className="text-gray-400"><th className="text-left font-normal" />{MODES.map(m => <th key={m} className="text-right font-normal">{cap(m)}</th>)}</tr></thead>
          <tbody>
            {mixRows.map(d => (
              <tr key={d}>
                <td className="text-gray-600">{cap(d)}</td>
                {MODES.map(m => <td key={m} className="text-right tabular-nums">{p.modeMix[d][m] ? pct(p.modeMix[d][m]) : '·'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Sub>Rhythm ({r.source === 'sessions' ? 'app sessions' : 'from games until the app reports sessions'})</Sub>
      <RhythmGrid heat={r.heat} />
      <p className="mt-1 text-xs text-gray-500">
        Peak hours {r.peakHours?.length ? r.peakHours.map(h => `${h}:00`).join(', ') : '—'}
        {' · '}regularity {r.regularity ?? '—'}
        {' · '}median gap {r.gapHours != null ? `${r.gapHours} h` : '—'}
        {' · '}{r.sessions30d ?? 0} sessions in 30 days
      </p>
      {r.typicalSession && Object.keys(r.typicalSession).length > 0 && (
        <p className="text-xs text-gray-500">
          Games per session: {DAYPARTS.filter(d => r.typicalSession[d] != null).map(d => `${d} ${r.typicalSession[d]}`).join(', ')}
        </p>
      )}
      {p.entryMix && (
        <p className="text-xs text-gray-500">
          Opens from: {Object.entries(p.entryMix).filter(([k]) => k !== 'pushDependent').map(([k, v]) => `${k.replace('_', ' ')} ${pct(v)}`).join(', ')}
          {p.entryMix.pushDependent ? ' · push-dependent' : ''}
        </p>
      )}

      <Sub>Skill (1500 = start; +200 over a question ≈ 76% right)</Sub>
      {!p.skill.overall ? <p className="text-sm text-gray-400">No rated answers yet.</p> : (
        <>
          <p className="text-xs text-gray-600">
            Overall <b className="tabular-nums">{p.skill.overall.rating}</b> · {p.skill.overall.answers} answers, {pct(p.skill.overall.correct / (p.skill.overall.answers || 1))} right
          </p>
          <table className="mt-1 w-full text-xs">
            <tbody>
              {[...p.skill.categories.map(c => ({ ...c, kind: 'cat' })), ...p.skill.topics.slice(0, 10).map(t => ({ ...t, kind: 'topic' }))].map(s => (
                <tr key={`${s.kind}${s.id}`}>
                  <td className={`truncate py-0.5 ${s.kind === 'cat' ? 'font-semibold' : 'pl-3'}`}>{name(s.id)}</td>
                  <td className="text-right font-semibold tabular-nums">{s.rating}</td>
                  <td className="text-right tabular-nums text-gray-500">{s.answers} ans</td>
                  <td className="text-right tabular-nums text-gray-500">{pct(s.correct / (s.answers || 1))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
