// The player drawer: one player's whole picture and every safety action, from anywhere
// (usePlayerStore.openPlayer(id)). API: GET /admin/users/:id/overview and the restriction,
// removal and rename routes (Quizup routes/adminSafety.js). Each action is audited by the API.
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { adminFetch, Badge, Btn, Spinner, fmtWhen, timeAgo } from '../lib/adminUtils.jsx';
import { useToastStore } from '../lib/toastStore';
import { usePlayerStore } from '../store/playerStore';
import WalletPanel from './WalletPanel.jsx';

const KIND_BADGE = {
  mute:    'bg-amber-100 text-amber-800',
  suspend: 'bg-red-100 text-red-700',
  ban:     'bg-gray-900 text-white',
};

export function restrictionLabel(r) {
  if (!r) return '';
  if (r.kind === 'ban') return 'Banned';
  return `${r.kind === 'mute' ? 'Muted' : 'Suspended'} until ${fmtWhen(r.ends_at)}`;
}

function Section({ title, children, right }) {
  return (
    <section className="border-t border-gray-100 px-5 py-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

/** Mute, suspend or ban form. Used here and in report cases. */
export function RestrictForm({ userId, token, reportId = null, defaultReason = '', onDone }) {
  const [kind, setKind] = useState('suspend');
  const [days, setDays] = useState('3');
  const [reason, setReason] = useState(defaultReason);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const { addToast } = useToastStore();

  async function submit(e) {
    e.preventDefault();
    if (kind === 'ban' && !confirm('Ban this player with no end date? They are signed out at once.')) return;
    setBusy(true);
    try {
      const { restriction } = await adminFetch(`/admin/users/${userId}/restrictions`, {
        method: 'POST',
        body: { kind, reason, note: note || undefined, reportId: reportId || undefined, ...(kind !== 'ban' && { days: Number(days) }) },
      }, token);
      addToast(restrictionLabel(restriction), 'success');
      setNote('');
      onDone?.(restriction);
    } catch (err) {
      addToast(err.message, 'error');
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap gap-2">
        <select value={kind} onChange={e => setKind(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5">
          <option value="mute">Mute (no messages or comments)</option>
          <option value="suspend">Suspend (no sign-in)</option>
          <option value="ban">Ban (no end)</option>
        </select>
        {kind !== 'ban' && (
          <label className="flex items-center gap-1.5 text-gray-600">
            for
            <input type="number" min="0.04" step="any" value={days} onChange={e => setDays(e.target.value)}
                   className="w-20 rounded-lg border border-gray-300 px-2 py-1.5" />
            days
          </label>
        )}
      </div>
      <input required minLength={3} value={reason} onChange={e => setReason(e.target.value)}
             placeholder="Reason the player sees, e.g. Abusive messages"
             className="rounded-lg border border-gray-300 px-2.5 py-1.5" />
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="Private note (optional)"
             className="rounded-lg border border-gray-300 px-2.5 py-1.5" />
      <div><Btn type="submit" variant="danger" disabled={busy}>{busy ? 'Applying…' : kind === 'mute' ? 'Mute' : kind === 'ban' ? 'Ban' : 'Suspend'}</Btn></div>
    </form>
  );
}

function RestrictionRow({ r, token, onChanged }) {
  const [days, setDays] = useState('');
  const [busy, setBusy] = useState(false);
  const { addToast } = useToastStore();

  async function act(fn, ok) {
    setBusy(true);
    try { await fn(); addToast(ok, 'success'); onChanged(); }
    catch (err) { addToast(err.message, 'error'); }
    setBusy(false);
  }

  return (
    <div className={`rounded-lg border p-3 text-sm ${r.active ? 'border-red-200 bg-red-50/40' : 'border-gray-100 bg-gray-50/50'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge color={KIND_BADGE[r.kind]}>{r.kind}</Badge>
        <span className="font-semibold text-[#1A1A2E]">{r.reason}</span>
        {r.active ? <Badge color="bg-red-100 text-red-700">in force</Badge> : <Badge color="bg-gray-100 text-gray-500">{r.lifted_at ? 'lifted' : 'ended'}</Badge>}
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {fmtWhen(r.starts_at)} → {r.ends_at ? fmtWhen(r.ends_at) : 'no end'} · by {r.actor_label} ({r.actor_role})
        {r.lifted_at && <> · lifted {fmtWhen(r.lifted_at)} by {r.lifted_by}{r.lift_note ? `: ${r.lift_note}` : ''}</>}
      </p>
      {r.note && <p className="mt-1 text-xs text-gray-600">Note: {r.note}</p>}
      {r.active && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Btn variant="success" disabled={busy} onClick={() => {
            const note = prompt('Why lift it? (optional, kept in the audit log)');
            if (note === null) return;
            act(() => adminFetch(`/admin/restrictions/${r.id}/lift`, { method: 'POST', body: { note } }, token), 'Lifted');
          }}>Lift now</Btn>
          <input type="number" min="0.04" step="any" value={days} onChange={e => setDays(e.target.value)} placeholder="days"
                 className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-xs" />
          <Btn variant="ghost" disabled={busy || !days} onClick={() => act(() => adminFetch(`/admin/restrictions/${r.id}`, { method: 'PATCH', body: { days: Number(days) } }, token), 'Length changed')}>
            Set length (from start)
          </Btn>
          {r.kind === 'suspend' && (
            <Btn variant="danger" disabled={busy} onClick={() => {
              if (confirm('Turn this suspension into a ban with no end?')) act(() => adminFetch(`/admin/restrictions/${r.id}`, { method: 'PATCH', body: { ban: true } }, token), 'Now a ban');
            }}>Make it a ban</Btn>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlayerDrawer({ token }) {
  const { playerId, closePlayer, changed } = usePlayerStore();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [rename, setRename] = useState('');
  const [showWallet, setShowWallet] = useState(false);
  const { addToast } = useToastStore();

  async function load(id = playerId) {
    if (!id) return;
    try { setData(await adminFetch(`/admin/users/${id}/overview`, {}, token)); setError(''); }
    catch (err) { setError(err.message); }
  }

  useEffect(() => {
    setData(null);
    setShowWallet(false);
    setRename('');
    if (playerId) load(playerId);
  }, [playerId]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') closePlayer(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function act(fn, ok) {
    try { await fn(); if (ok) addToast(ok, 'success'); await load(); changed(); }
    catch (err) { addToast(err.message, 'error'); }
  }

  if (!playerId) return null;
  const u = data?.user;
  const live = data?.restrictions.filter(r => r.active) ?? [];
  const signIns = u ? [u.has_google && 'Google', u.has_discord && 'Discord', u.has_password && 'email + password'].filter(Boolean).join(', ') : '';

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button type="button" aria-label="Close" onClick={closePlayer} className="absolute inset-0 bg-slate-950/40" />
      <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-3">
          <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Player</span>
          <button type="button" onClick={closePlayer} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={18} /></button>
        </div>

        {error && <p className="m-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!data && !error && <Spinner />}

        {u && (
          <>
            <div className="flex items-start gap-4 px-5 py-4">
              {u.avatar_url
                ? <img src={u.avatar_url} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
                : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xl font-bold text-gray-500">{u.username[0]?.toUpperCase()}</div>}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-[#1A1A2E]">{u.username}</h2>
                  {u.is_bot && <Badge color="bg-purple-100 text-purple-700">bot</Badge>}
                  {live.map(r => <Badge key={r.id} color={KIND_BADGE[r.kind]}>{restrictionLabel(r)}</Badge>)}
                  {u.underage_at && <Badge color="bg-red-100 text-red-700">under 16</Badge>}
                </div>
                <p className="text-sm text-gray-500 break-all">{u.email}</p>
                <p className="mt-1 text-xs text-gray-500">
                  Joined {fmtWhen(u.created_at)} · last seen {timeAgo(u.last_seen_at)} · signs in with {signIns || 'nothing'}
                  {u.city || u.country ? ` · ${[u.city, u.country].filter(Boolean).join(', ')}` : ''}
                  {u.birth_month ? ` · born ${new Date(u.birth_month).getFullYear()}` : ''}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 px-5 pb-4 text-center">
              {[['XP', u.total_xp?.toLocaleString()], ['Coins', u.coins?.toLocaleString()], ['Games', u.games_played], ['Friends', u.friend_count]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-gray-50 py-2">
                  <div className="text-sm font-bold text-[#1A1A2E]">{v ?? 0}</div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-400">{k}</div>
                </div>
              ))}
            </div>

            {!u.is_bot && (
              <Section title="Restrict">
                <RestrictForm userId={u.id} token={token} onDone={() => { load(); changed(); }} />
              </Section>
            )}

            <Section title={`Restrictions (${data.restrictions.length})`}>
              {data.restrictions.length === 0
                ? <p className="text-sm text-gray-400">Never restricted.</p>
                : <div className="flex flex-col gap-2">{data.restrictions.map(r => <RestrictionRow key={r.id} r={r} token={token} onChanged={() => { load(); changed(); }} />)}</div>}
            </Section>

            <Section title={`Reports against (${data.reportsAgainst.length})`} right={<span className="text-xs text-gray-400">filed {data.reportsFiled.total}, {data.reportsFiled.dismissed} dismissed</span>}>
              {data.reportsAgainst.length === 0
                ? <p className="text-sm text-gray-400">None.</p>
                : (
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {data.reportsAgainst.map(r => (
                      <li key={r.id} className="flex flex-wrap items-center gap-2">
                        <Badge color={r.status === 'pending' ? 'bg-[#E8453C]/10 text-[#E8453C]' : 'bg-gray-100 text-gray-600'}>{r.status}</Badge>
                        <span className="font-semibold">{r.reason}</span>
                        <span className="text-xs text-gray-400">by {r.reporter_username} · {timeAgo(r.created_at)}</span>
                        {r.resolution && <span className="text-xs text-gray-500">→ {r.resolution}</span>}
                      </li>
                    ))}
                  </ul>
                )}
            </Section>

            <Section title={`Recent comments (${data.comments.length})`}>
              {data.comments.length === 0
                ? <p className="text-sm text-gray-400">None.</p>
                : (
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {data.comments.map(c => (
                      <li key={c.id} className="flex items-start justify-between gap-2">
                        <span className="min-w-0 break-words text-gray-700">“{c.text}” <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span></span>
                        <button type="button" className="shrink-0 text-xs font-semibold text-red-600 hover:underline"
                                onClick={() => { if (confirm('Remove this comment?')) act(() => adminFetch(`/admin/comments/${c.id}`, { method: 'DELETE' }, token), 'Comment removed'); }}>
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
            </Section>

            <Section title="Name and picture">
              <div className="flex flex-wrap items-center gap-2">
                <input value={rename} onChange={e => setRename(e.target.value)} placeholder="New username (blank: a neutral one)"
                       className="min-w-48 flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm" />
                <Btn variant="ghost" onClick={() => {
                  if (confirm(rename ? `Rename to ${rename}?` : 'Give a neutral name (player_…)? They can choose another in Profile.')) {
                    act(() => adminFetch(`/admin/users/${u.id}/username`, { method: 'PUT', body: { username: rename } }, token), 'Renamed').then(() => setRename(''));
                  }
                }}>Rename</Btn>
                <Btn variant="danger" disabled={!u.avatar_url} onClick={() => {
                  if (confirm('Remove this picture? They get the letter avatar.')) act(() => adminFetch(`/admin/users/${u.id}/avatar-reset`, { method: 'POST' }, token), 'Picture removed');
                }}>Remove picture</Btn>
              </div>
            </Section>

            <Section title="Recent games">
              {data.recentGames.length === 0 ? <p className="text-sm text-gray-400">None.</p> : (
                <ul className="flex flex-col gap-1 text-sm">
                  {data.recentGames.map(g => (
                    <li key={g.id} className="flex flex-wrap gap-2 text-gray-700">
                      <span className="text-xs text-gray-400 w-20 shrink-0">{timeAgo(g.completed_at)}</span>
                      <span>{g.mode}</span>
                      <span className="text-gray-500">{g.topic ?? '—'}</span>
                      {g.opponent && <span>vs {g.opponent}{g.opponent_is_bot ? ' (bot)' : ''}</span>}
                      <span className="tabular-nums">{g.score}{g.opponent ? `–${g.opponent_score}` : ''}</span>
                      {g.won && <Badge color="bg-green-100 text-green-700">won</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {data.topics.length > 0 && (
              <Section title={`Topics they made (${data.topics.length})`}>
                <ul className="flex flex-col gap-1 text-sm">
                  {data.topics.map(t => (
                    <li key={t.id} className="flex items-center justify-between gap-2">
                      <span className={t.is_active ? 'text-gray-700' : 'text-gray-400 line-through'}>{t.name}</span>
                      <button type="button" className="text-xs font-semibold text-gray-500 hover:underline"
                              onClick={() => act(() => adminFetch(`/admin/topics/${t.id}`, { method: 'PUT', body: { is_active: !t.is_active } }, token), t.is_active ? 'Topic hidden' : 'Topic back')}>
                        {t.is_active ? 'Hide' : 'Show'}
                      </button>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title="Wallet" right={<Btn variant="ghost" onClick={() => setShowWallet(s => !s)}>{showWallet ? 'Hide' : 'Show'}</Btn>}>
              {showWallet ? <WalletPanel userId={u.id} token={token} onChanged={() => { load(); changed(); }} /> : <p className="text-sm text-gray-400">Coins, KWIZ+ and purchases.</p>}
            </Section>

            <Section title="Audit">
              <p className="text-sm text-gray-500">{data.auditCount} operator changes to this player. Filter the Audit log by target id <code className="text-xs">{u.id}</code>.</p>
            </Section>
          </>
        )}
      </aside>
    </div>
  );
}
