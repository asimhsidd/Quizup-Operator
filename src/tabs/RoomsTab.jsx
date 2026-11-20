// Operator → Rooms: private rooms (Quizup docs/private-rooms-plan.md). Money: what rooms bring
// in (new players from room links, the join-ad gate, big rooms, the host's prize, lifelines);
// Rooms: open, scheduled and recent, one room's members and games, close or rename one;
// Settings: the Rooms config group. API: Quizup backend/routes/adminRooms.js.
import { Fragment, useEffect, useState } from 'react';
import { adminFetch, Badge, Btn, Spinner, fmtWhen, timeAgo } from '../lib/adminUtils.jsx';
import { useToastStore } from '../lib/toastStore';
import { usePlayerStore } from '../store/playerStore';
import { Pills, SectionHeading, StatCard, Table, n } from '../components/Panels.jsx';
import SettingsSection from '../components/SettingsSection.jsx';

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

function Money({ token }) {
  const [days, setDays] = useState(7);
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setD(null);
    adminFetch(`/admin/rooms/money?days=${days}`, {}, token).then(setD).catch(e => setError(e.message));
  }, [days, token]);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  return (
    <div className="flex flex-col gap-5">
      <Pills options={[[1, 'Today'], [7, '7 days'], [30, '30 days'], [90, '90 days']]} value={days} onChange={setDays} />
      {!d ? <Spinner /> : (
        <>
          <SectionHeading>Growth: the room link is the referral link</SectionHeading>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="New players from room links" value={n(d.growth.signups)} sub={`${n(d.growth.firstGames)} have finished a game`} />
            <StatCard label="New players per played room" value={d.growth.perRoom} sub="Above 0.3, rooms pay for themselves" />
            <StatCard label="Rooms made" value={n(d.rooms.made)} sub={`${n(d.rooms.scheduled)} scheduled · ${n(d.rooms.played)} played`} />
            <StatCard label="Games" value={n(d.rooms.games)} sub={`${d.rooms.avgPlayers} players a game · ${d.rooms.gamesPerRoom} a room`} />
          </div>

          <SectionHeading>The join ad (every guest join)</SectionHeading>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Guest joins" value={n(d.gate.joins)} sub={`${n(d.gate.held)} met the ad · ${n(d.gate.joins - d.gate.held)} exempt`} />
            <StatCard label="Join ads watched" value={n(d.gate.watched)} sub={`${pct(d.gate.watched, d.gate.held)} of those who met it`} />
            <StatCard label="Gave up at the ad" value={n(d.gate.expired)} sub={`place released · ${pct(d.gate.expired, d.gate.held)}`} />
            <StatCard label="Ad didn't load" value={n(d.gate.adFailed)} sub="20 in 10 minutes raises an alert" />
          </div>
          {Object.keys(d.gate.exempt).length > 0 && (
            <p className="text-xs text-gray-600">
              Exempt: {Object.entries(d.gate.exempt).map(([k, v]) => `${{ new: 'new players', plus: 'KWIZ+ guests', plus_host: "KWIZ+ hosts' rooms", off: 'ads off' }[k] ?? k} ${n(v)}`).join(' · ')}
            </p>
          )}

          <SectionHeading>The host pays</SectionHeading>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Room full (upsell shown)" value={n(d.gate.full)} sub="A guest tapped a full room's link" />
            <StatCard label="Big rooms for coins" value={n(d.money.bigByCoins.rooms)} sub={`${n(d.money.bigByCoins.coins)} coins · ${n(d.money.bigByCoins.refunded)} refunded`} />
            <StatCard label="Big rooms for ads" value={n(d.money.bigByAds)} sub="ads watched toward a big room" />
            <StatCard label="Host's prizes" value={n(d.money.prize.funded)} sub={`coins put up · ${n(d.money.prize.won)} won · ${n(d.money.prize.back)} back`} />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Lifelines used in rooms" value={n(d.money.lifelines.used)} sub={`${n(d.money.lifelines.free)} free (KWIZ+ or an ad)`} />
            <StatCard label="Room games running" value={n(d.running)} sub="now, on this server" />
          </div>
          <p className="text-xs text-gray-500">KWIZ+ trials started from a room show in Overview by paywall source "room".</p>
        </>
      )}
    </div>
  );
}

const STATUS = { open: 'bg-green-100 text-green-700', scheduled: 'bg-cyan-100 text-cyan-700', closed: 'bg-gray-100 text-gray-600', cancelled: 'bg-red-100 text-red-600' };

function RoomDetail({ id, token, onChanged }) {
  const { addToast } = useToastStore();
  const openPlayer = usePlayerStore(s => s.openPlayer);
  const [d, setD] = useState(null);
  const load = () => adminFetch(`/admin/rooms/${id}`, {}, token).then(setD).catch(e => addToast(e.message, 'error'));
  useEffect(() => { load(); }, [id]);
  if (!d) return <Spinner />;
  async function close() {
    if (!window.confirm(`Close "${d.room.name}"? Everyone in it is sent out.`)) return;
    await adminFetch(`/admin/rooms/${id}/close`, { method: 'POST', body: JSON.stringify({ reason: 'closed_by_operator' }) }, token)
      .then(() => { addToast('Room closed', 'success'); onChanged(); }).catch(e => addToast(e.message, 'error'));
  }
  async function rename() {
    const name = window.prompt('New name for the room', d.room.name);
    if (!name) return;
    await adminFetch(`/admin/rooms/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }, token)
      .then(() => { addToast('Renamed', 'success'); load(); onChanged(); }).catch(e => addToast(e.message, 'error'));
  }
  return (
    <div className="flex flex-col gap-3 p-3 bg-gray-50 rounded-xl">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm">Code <b>{d.room.code}</b> · host <button type="button" className="font-semibold hover:underline" onClick={() => openPlayer(d.room.hostId)}>{d.room.host}</button> · {d.room.topic ?? 'no topic'}{d.room.bigVia ? ` · big (${d.room.bigVia})` : ''}</span>
        <div className="flex-1" />
        <Btn onClick={rename}>Rename</Btn>
        {['open', 'scheduled'].includes(d.room.status) && <Btn variant="danger" onClick={close}>Close room</Btn>}
      </div>
      <Table
        cols={['Player', 'State', "I'm in", 'Join ads', 'Last join']}
        empty="Nobody yet."
        rows={d.members.map(m => (
          <tr key={m.user_id} className="border-b border-gray-100">
            <td className="px-4 py-2"><button type="button" onClick={() => openPlayer(m.user_id)} className="font-semibold hover:underline">{m.username}</button></td>
            <td className="px-4 py-2 text-xs">{m.state}</td>
            <td className="px-4 py-2 text-xs">{m.rsvp ? 'yes' : ''}</td>
            <td className="px-4 py-2 tabular-nums">{m.ad_joins}</td>
            <td className="px-4 py-2 text-xs text-gray-500">{timeAgo(m.joined_at)}</td>
          </tr>
        ))}
      />
      {d.games.length > 0 && (
        <Table
          cols={['Game', 'Players', 'Prize', 'Result']}
          rows={d.games.map(g => (
            <tr key={g.id} className="border-b border-gray-100">
              <td className="px-4 py-2 text-xs">{fmtWhen(g.started_at)} · {g.status}</td>
              <td className="px-4 py-2 tabular-nums">{g.players}</td>
              <td className="px-4 py-2 tabular-nums">{g.pot_coins || ''}</td>
              <td className="px-4 py-2 text-xs">{(g.results ?? []).slice(0, 3).map(r => `${r.place}. ${r.username} (${r.score})`).join(' · ')}</td>
            </tr>
          ))}
        />
      )}
    </div>
  );
}

function RoomList({ token }) {
  const [status, setStatus] = useState('live');
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);
  const load = () => { setRows(null); adminFetch(`/admin/rooms?status=${status}`, {}, token).then(d => setRows(d.rooms)).catch(() => setRows([])); };
  useEffect(load, [status, token]);
  return (
    <div className="flex flex-col gap-3">
      <Pills options={[['live', 'Open now'], ['scheduled', 'Scheduled'], ['recent', 'Closed (7 days)']]} value={status} onChange={setStatus} />
      {!rows ? <Spinner /> : (
        <Table
          cols={['Room', 'Host', 'Topic', 'When', 'In / going', 'Games', '']}
          empty="No rooms here."
          rows={rows.map(r => (
            <Fragment key={r.id}>
              <tr className="border-b border-gray-100 cursor-pointer hover:bg-gray-50" onClick={() => setOpen(open === r.id ? null : r.id)}>
                <td className="px-4 py-2 font-semibold">{r.name} <span className="text-xs text-gray-400">{r.code}</span></td>
                <td className="px-4 py-2">{r.host}</td>
                <td className="px-4 py-2 text-xs">{r.topic}</td>
                <td className="px-4 py-2 text-xs">{r.scheduled_at ? fmtWhen(r.scheduled_at) : timeAgo(r.last_active_at)}</td>
                <td className="px-4 py-2 tabular-nums">{r.members} / {r.going}</td>
                <td className="px-4 py-2 tabular-nums">{r.games}</td>
                <td className="px-4 py-2"><Badge color={STATUS[r.status]}>{r.running ? 'game on' : r.status}</Badge>{r.big_via && <Badge color="bg-amber-100 text-amber-700">big</Badge>}</td>
              </tr>
              {open === r.id && <tr><td colSpan={7} className="p-2"><RoomDetail id={r.id} token={token} onChanged={load} /></td></tr>}
            </Fragment>
          ))}
        />
      )}
    </div>
  );
}

export default function RoomsTab({ token }) {
  const [view, setView] = useState('money');
  return (
    <div className="flex flex-col gap-5">
      <Pills options={[['money', 'Money'], ['rooms', 'Rooms'], ['settings', 'Settings']]} value={view} onChange={setView} />
      {view === 'money' && <Money token={token} />}
      {view === 'rooms' && <RoomList token={token} />}
      {view === 'settings' && <SettingsSection token={token} tab="rooms" />}
    </div>
  );
}
