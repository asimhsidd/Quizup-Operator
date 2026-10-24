// Game world: clans (standings and a map preview per country), missions, crowns, rivals and
// who Discover can find (Quizup lib/gameOps.js). Read-only. Clan boards count bot XP while
// clan_bots is on, exactly as the game does; everything else leaves bots out.
import { useEffect, useState } from 'react';
import { adminFetch, Badge, Btn, Spinner, timeAgo } from '../lib/adminUtils.jsx';
import { usePlayerStore } from '../store/playerStore';
import { StatCard, SectionHeading, Table, Pills, n } from '../components/Panels.jsx';

const pct = v => (v == null ? '—' : `${Math.round(v * 100)}%`);
const month = p => (p ? new Date(`${p}T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }) : '—');

// GET a path, again whenever it changes
function useAdmin(path, token) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setError('');
    adminFetch(path, {}, token).then(d => { if (live) setData(d); }).catch(err => { if (live) setError(err.message); });
    return () => { live = false; };
  }, [path]);
  return { data, error };
}

// ── Clans ────────────────────────────────────────────────────────────────────

// Where the country's activity is: places as dots sized by players, on the country's
// bounds (no basemap; the game's map is in the app).
function MapPreview({ map }) {
  if (!map?.bounds) return <p className="text-sm text-gray-400">No map for this country.</p>;
  const [w, s, e, nth] = map.bounds;
  // Inner drawing area with room round it for dots and labels
  const IW = 440, IH = Math.round(IW * ((nth - s) / (e - w)) * 1.15), PAD = 20, RIGHT = 90;
  const W = IW + PAD + RIGHT, H = IH + 2 * PAD;
  const x = lng => PAD + ((lng - w) / (e - w)) * IW;
  const y = lat => PAD + ((nth - lat) / (nth - s)) * IH;
  const landmarks = new Map();
  for (const l of map.landmarks) landmarks.set(l.placeKey, [...(landmarks.get(l.placeKey) ?? []), l]);
  const max = Math.max(1, ...map.places.map(p => p.players));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[460px] rounded-xl border border-[#E0E0E0] bg-sky-50/40">
      {map.places.map(p => {
        const r = p.players ? 4 + 14 * Math.sqrt(p.players / max) : 2.5;
        const lm = landmarks.get(p.key) ?? [];
        return (
          <g key={p.key}>
            <title>{`${p.name}: ${p.players} players${lm.length ? `\nLandmarks: ${lm.map(l => `${l.name} (${l.leader?.username ?? 'no leader'})`).join(', ')}` : ''}`}</title>
            <circle cx={x(p.lng)} cy={y(p.lat)} r={r}
                    fill={p.players ? (p.kind === 'city' ? '#E8453C' : '#F59E0B') : '#CBD5E1'} fillOpacity={p.players ? 0.75 : 0.6}
                    stroke="#1A1A2E" strokeWidth={lm.length ? 1.5 : 0} />
            {p.players > 0 && <text x={x(p.lng) + r + 3} y={y(p.lat) + 4} fontSize="11" fill="#1A1A2E">{p.short ?? p.name}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function Clans({ token }) {
  const openPlayer = usePlayerStore(s => s.openPlayer);
  const [cc, setCc] = useState('');
  const { data: d, error } = useAdmin(`/admin/clans${cc ? `?cc=${cc}` : ''}`, token);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!d) return <Spinner />;
  const c = d.country;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-gray-500">
        {month(d.period)} (players' local months). A city is a clan from {d.rules.minPlayers} players; below that its players
        play for their state. Bot XP {d.rules.bots ? 'counts' : 'is left out'} (clan_bots).
      </p>
      <Pills options={d.countries.map(x => [x.code, `${x.code} · ${n(x.players)}`])} value={c?.code} onChange={setCc} />
      {c && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(() => { const t = d.countries.find(x => x.code === c.code); return (<>
              <StatCard label="Players this month" value={n(t.players)} />
              <StatCard label="Clan XP" value={n(t.xp)} />
              <StatCard label="Cities with players" value={n(t.cities)} />
              <StatCard label="Teams" value={n(c.teams.length)} sub={`${c.teams.filter(x => x.kind === 'city').length} city clans`} />
            </>); })()}
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <div>
              <SectionHeading>Map preview</SectionHeading>
              <MapPreview map={c.map} />
              <p className="mt-1 text-xs text-gray-500">Red: cities, amber: states. Outlined places have topic landmarks; hover for them and their leaders.</p>
            </div>
            <div className="flex flex-col gap-6">
              <div>
                <SectionHeading>Standings</SectionHeading>
                <Table
                  cols={['#', 'Team', 'Kind', 'XP', 'Players']}
                  empty="No clan XP yet this month."
                  rows={c.teams.slice(0, 30).map((t, i) => (
                    <tr key={t.key} className="border-b border-gray-100">
                      <td className="px-4 py-2 tabular-nums text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2 font-semibold text-[#1A1A2E]">{t.name}{t.kind === 'city' && t.region ? <span className="ml-1 text-xs font-normal text-gray-400">{t.region}</span> : null}</td>
                      <td className="px-4 py-2 text-xs">{t.kind === 'city' ? 'city' : `rest of state (${t.cities})`}</td>
                      <td className="px-4 py-2 tabular-nums">{n(t.xp)}</td>
                      <td className="px-4 py-2 tabular-nums">{n(t.players)}</td>
                    </tr>
                  ))}
                />
              </div>
              <div>
                <SectionHeading>States</SectionHeading>
                <Table
                  cols={['State', 'XP', 'Players', 'Cities']}
                  empty="—"
                  rows={c.states.map(s => (
                    <tr key={s.name} className="border-b border-gray-100">
                      <td className="px-4 py-2">{s.name}</td>
                      <td className="px-4 py-2 tabular-nums">{n(s.xp)}</td>
                      <td className="px-4 py-2 tabular-nums">{n(s.players)}</td>
                      <td className="px-4 py-2 tabular-nums">{n(s.cities)}</td>
                    </tr>
                  ))}
                />
              </div>
            </div>
          </div>
          {c.map.landmarks.length > 0 && (
            <div>
              <SectionHeading>Landmarks</SectionHeading>
              <Table
                cols={['Topic', 'Place', 'Players', 'Leader']}
                empty="—"
                rows={c.map.landmarks.map(l => (
                  <tr key={`${l.placeKey}${l.topicId}`} className="border-b border-gray-100">
                    <td className="px-4 py-2">{l.name}</td>
                    <td className="px-4 py-2">{l.place}</td>
                    <td className="px-4 py-2 tabular-nums">{n(l.players)}</td>
                    <td className="px-4 py-2">{l.leader ? <button type="button" onClick={() => openPlayer(l.leader.id)} className="hover:underline">{l.leader.username} · {n(l.leader.xp)} XP</button> : '—'}</td>
                  </tr>
                ))}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Missions ─────────────────────────────────────────────────────────────────

function Missions({ token }) {
  const [days, setDays] = useState(30);
  const { data: d, error } = useAdmin(`/admin/missions?days=${days}`, token);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500 max-w-2xl">
          Each player gets {d?.counts.daily ?? '…'} daily and {d?.counts.weekly ?? '…'} weekly missions, picked from the pools by a hash.
          The picks aren't stored, so "offered" is an estimate: active player-days (or weeks) × the share of the pool each player gets.
        </p>
        <Pills options={[[7, '7 days'], [30, '30 days'], [90, '90 days']]} value={days} onChange={setDays} />
      </div>
      {!d ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Active players" value={n(d.active.players)} sub={`${n(d.active.player_days)} player-days`} />
            <StatCard label="Missions claimed" value={n(d.missions.reduce((a, m) => a + m.claims, 0))} />
            <StatCard label="Ad swaps" value={n(d.missions.reduce((a, m) => a + m.swappedOut, 0))} />
            <StatCard label="Reward track claims" value={n(d.track.reduce((a, t) => a + t.claims, 0))} />
          </div>
          {['daily', 'weekly'].map(cad => (
            <div key={cad}>
              <SectionHeading>{cad === 'daily' ? 'Daily missions' : 'Weekly missions'}</SectionHeading>
              <Table
                cols={['Mission', 'Reward', 'Offered ≈', 'Claimed', 'Rate', 'Swapped out / in']}
                empty="—"
                rows={d.missions.filter(m => m.cadence === cad).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1)).map(m => (
                  <tr key={m.key} className="border-b border-gray-100">
                    <td className="px-4 py-2"><span className="font-semibold text-[#1A1A2E]">{m.label}</span> <span className="font-mono text-[10px] text-gray-400">{m.key}</span></td>
                    <td className="px-4 py-2 tabular-nums">{m.rewardXp} XP</td>
                    <td className="px-4 py-2 tabular-nums text-gray-500">{n(m.offered)}</td>
                    <td className="px-4 py-2 tabular-nums">{n(m.claims)}</td>
                    <td className={`px-4 py-2 tabular-nums font-semibold ${m.rate != null && m.rate < 0.1 ? 'text-red-600' : ''}`}>{pct(m.rate)}</td>
                    <td className="px-4 py-2 tabular-nums text-gray-500">{cad === 'daily' ? `${m.swappedOut} / ${m.swappedIn}` : '—'}</td>
                  </tr>
                ))}
              />
            </div>
          ))}
          <div>
            <SectionHeading>Daily reward track</SectionHeading>
            <Table
              cols={['Day', 'Claims', 'XP paid']}
              empty="No claims in this window."
              rows={d.track.map(t => (
                <tr key={t.track_day} className="border-b border-gray-100">
                  <td className="px-4 py-2">Day {t.track_day}</td>
                  <td className="px-4 py-2 tabular-nums">{n(t.claims)}</td>
                  <td className="px-4 py-2 tabular-nums">{n(t.xp)}</td>
                </tr>
              ))}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── Crowns, rivals, Discover ─────────────────────────────────────────────────

function Crowns({ token }) {
  const openPlayer = usePlayerStore(s => s.openPlayer);
  const [period, setPeriod] = useState('');
  const { data: d, error } = useAdmin(`/admin/crowns${period ? `?period=${period}` : ''}`, token);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!d) return <Spinner />;
  if (!d.period) return <p className="text-sm text-gray-400">No crowns awarded yet. The crown job writes a month's winners once every time zone has finished it.</p>;
  return (
    <div className="flex flex-col gap-5">
      <Pills options={d.periods.map(p => [p.period, `${month(p.period)} · ${p.crowns}`])} value={d.period} onChange={setPeriod} />
      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <div>
          <SectionHeading>Most crowns</SectionHeading>
          <Table
            cols={['Player', 'Crowns']}
            empty="—"
            rows={d.holders.map(h => (
              <tr key={h.user_id} className="border-b border-gray-100">
                <td className="px-4 py-2"><button type="button" onClick={() => openPlayer(h.user_id)} className="hover:underline">{h.username}</button>{h.is_bot && <span className="ml-1"><Badge color="bg-gray-100 text-gray-500">bot</Badge></span>}</td>
                <td className="px-4 py-2 tabular-nums">{h.crowns}</td>
              </tr>
            ))}
          />
        </div>
        <div>
          <SectionHeading>Crowns</SectionHeading>
          <Table
            cols={['Topic', 'Scope', 'Place', 'Holder', 'XP']}
            empty="—"
            rows={d.crowns.map(c => (
              <tr key={`${c.topic}${c.scope}${c.scope_key}`} className="border-b border-gray-100">
                <td className="px-4 py-2">{c.topic}</td>
                <td className="px-4 py-2 text-xs">{c.scope}</td>
                <td className="px-4 py-2">{c.place}</td>
                <td className="px-4 py-2"><button type="button" onClick={() => openPlayer(c.user_id)} className="hover:underline">{c.username}</button>{c.is_bot && <span className="ml-1 text-xs text-gray-400">bot</span>}</td>
                <td className="px-4 py-2 tabular-nums">{n(c.xp)}</td>
              </tr>
            ))}
          />
        </div>
      </div>
    </div>
  );
}

function Rivals({ token }) {
  const openPlayer = usePlayerStore(s => s.openPlayer);
  const { data: d, error } = useAdmin('/admin/rivals', token);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!d) return <Spinner />;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {d.levels.map(l => <StatCard key={l.level} label={l.name} value={n(l.pairs)} sub={`pairs with ${l.min}+ games`} />)}
      </div>
      <div>
        <SectionHeading>Busiest rivalries (real players)</SectionHeading>
        <Table
          cols={['Pair', 'Games', 'Record', 'Level', 'Last played']}
          empty="No games between real players yet."
          rows={d.top.map(r => (
            <tr key={`${r.user_lo}${r.user_hi}`} className="border-b border-gray-100">
              <td className="px-4 py-2">
                <button type="button" onClick={() => openPlayer(r.user_lo)} className="font-semibold hover:underline">{r.lo_name}</button>
                <span className="text-gray-400"> v </span>
                <button type="button" onClick={() => openPlayer(r.user_hi)} className="font-semibold hover:underline">{r.hi_name}</button>
              </td>
              <td className="px-4 py-2 tabular-nums">{r.games}</td>
              <td className="px-4 py-2 tabular-nums">{r.lo_wins}–{r.hi_wins}{r.draws ? ` (${r.draws} drawn)` : ''}</td>
              <td className="px-4 py-2 text-xs">{r.level?.name ?? '—'}</td>
              <td className="px-4 py-2 text-xs text-gray-500">{timeAgo(r.last_played_at)}</td>
            </tr>
          ))}
        />
      </div>
    </div>
  );
}

function Discover({ token }) {
  const { data: d, error } = useAdmin('/admin/discover', token);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!d) return <Spinner />;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-gray-500">Real players over 16. Findable: Discover on, location shared and known.</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Findable" value={n(d.findable)} sub={`of ${n(d.players)} players`} />
        <StatCard label="Discover off" value={n(d.opted_out)} />
        <StatCard label="Location hidden" value={n(d.location_hidden)} />
        <StatCard label="No location" value={n(d.no_location)} />
        <StatCard label="Age not asked yet" value={n(d.age_not_asked)} />
      </div>
      <div>
        <SectionHeading>Findable players by country</SectionHeading>
        <Table
          cols={['Country', 'Players', 'Cities']}
          empty="Nobody is findable yet."
          rows={d.countries.map(c => (
            <tr key={c.code} className="border-b border-gray-100">
              <td className="px-4 py-2">{c.name ?? c.code} <span className="text-xs text-gray-400">{c.code}</span></td>
              <td className="px-4 py-2 tabular-nums">{n(c.findable)}</td>
              <td className="px-4 py-2 tabular-nums">{n(c.cities)}</td>
            </tr>
          ))}
        />
      </div>
    </div>
  );
}

const VIEWS = [['clans', 'Clans'], ['missions', 'Missions'], ['crowns', 'Crowns'], ['rivals', 'Rivals'], ['discover', 'Discover']];

export default function GameWorldTab({ token }) {
  const [view, setView] = useState('clans');
  const [key, setKey] = useState(0);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pills options={VIEWS} value={view} onChange={setView} />
        <Btn variant="ghost" onClick={() => setKey(k => k + 1)}>Refresh</Btn>
      </div>
      <div key={`${view}${key}`}>
        {view === 'clans' && <Clans token={token} />}
        {view === 'missions' && <Missions token={token} />}
        {view === 'crowns' && <Crowns token={token} />}
        {view === 'rivals' && <Rivals token={token} />}
        {view === 'discover' && <Discover token={token} />}
      </div>
    </div>
  );
}
