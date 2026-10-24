// Reports: one card per player report, as a case. What the reporter saw (DMs between the
// two and the reported player's comments, copied when the report was filed), how often
// this player has been reported and by how many people, how often the reporter's own
// reports were dismissed, and the actions: restrict, remove a message, open the player,
// close with a resolution. API: /admin/reports, /admin/users/:id/restrictions,
// /admin/messages/:id (Quizup routes/admin.js, routes/adminSafety.js).
import { useEffect, useState } from 'react';
import { adminFetch, Badge, Btn, Paginator, fmtWhen, timeAgo } from '../lib/adminUtils.jsx';
import { useToastStore } from '../lib/toastStore';
import { usePlayerStore } from '../store/playerStore';
import { RestrictForm, restrictionLabel } from '../components/PlayerDrawer.jsx';

const LIMIT = 50;

function Person({ label, id, name, avatar, color }) {
  const openPlayer = usePlayerStore(s => s.openPlayer);
  return (
    <button type="button" onClick={() => openPlayer(id)} className="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-80">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white" style={{ background: color }}>
        {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : name?.[0]?.toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="truncate text-sm font-semibold text-[#1A1A2E] underline-offset-2 hover:underline">{name}</p>
      </div>
    </button>
  );
}

function Evidence({ r, token, onRemoved }) {
  const { addToast } = useToastStore();
  const ev = r.evidence;
  if (!ev) return <p className="text-xs text-gray-400">No evidence kept (filed before evidence was recorded).</p>;

  async function removeMessage(m) {
    if (!confirm('Remove this message from the conversation? The copy here stays as evidence.')) return;
    try {
      await adminFetch(`/admin/messages/${m.id}`, { method: 'DELETE' }, token);
      addToast('Message removed', 'success');
      onRemoved(m.id);
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
          Messages between them ({ev.messages.length}, newest last, copied {timeAgo(ev.capturedAt)})
        </p>
        {ev.messages.length === 0 ? <p className="text-xs text-gray-400">They have no DMs.</p> : (
          <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto rounded-lg bg-gray-50 p-2">
            {ev.messages.map(m => (
              <div key={m.id} className={`group flex items-start gap-2 ${m.from_reported ? '' : 'flex-row-reverse'}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-1.5 text-sm ${m.from_reported ? 'bg-red-100 text-red-900' : 'bg-white text-gray-700 border border-gray-200'}`}>
                  {m.text || <em className="text-gray-500">({m.attachment_type ?? 'attachment'})</em>}
                  {m.attachment_type === 'image' && m.attachment_url && (
                    <a href={m.attachment_url} target="_blank" rel="noreferrer" className="mt-1 block text-xs underline">photo</a>
                  )}
                  <div className="mt-0.5 text-[10px] opacity-60">{fmtWhen(m.created_at)}</div>
                </div>
                {m.from_reported && !r.removedIds?.includes(m.id) && (
                  <button type="button" onClick={() => removeMessage(m)} className="mt-1 text-[11px] font-semibold text-red-600 opacity-0 hover:underline group-hover:opacity-100">
                    Remove
                  </button>
                )}
                {r.removedIds?.includes(m.id) && <span className="mt-1 text-[11px] text-gray-400">removed</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      {ev.comments.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Their recent comments</p>
          <ul className="flex flex-col gap-1 text-sm text-gray-700">
            {ev.comments.map(c => <li key={c.id}>“{c.text}” <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReportCard({ r, token, status, onClosed, onUpdate }) {
  const [showEvidence, setShowEvidence] = useState(status === 'pending');
  const [restricting, setRestricting] = useState(false);
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState(false);
  const { addToast } = useToastStore();

  async function close(newStatus, text = resolution) {
    setBusy(true);
    try {
      await adminFetch(`/admin/reports/${r.id}`, { method: 'PUT', body: { status: newStatus, resolution: text || undefined } }, token);
      onClosed(r.id);
    } catch (err) {
      addToast(`Report not updated: ${err.message}`, 'error');
    }
    setBusy(false);
  }

  return (
    <div className="rounded-xl border border-[#E0E0E0] bg-white p-4">
      <div className="flex items-start gap-3">
        <Person label="Reporter" id={r.reporter_id} name={r.reporter_username} avatar={r.reporter_avatar} color="#E8453C" />
        <div className="shrink-0 text-base text-gray-400">→</div>
        <Person label="Reported" id={r.reported_id} name={r.reported_username} avatar={r.reported_avatar} color="#9C6FE4" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge color="bg-[#FEF2F2] text-[#E8453C]">{r.reason}</Badge>
        <span className="text-[11px] text-gray-400">{fmtWhen(r.created_at)}</span>
        <Badge color={r.reports_on_player > 1 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}>
          {r.reports_on_player} report{r.reports_on_player === 1 ? '' : 's'} on this player from {r.reporters_of_player} {r.reporters_of_player === 1 ? 'person' : 'people'}
        </Badge>
        {r.reporter_dismissed > 0 && <Badge color="bg-gray-100 text-gray-600">reporter: {r.reporter_dismissed} dismissed before</Badge>}
        {r.restriction && <Badge color="bg-red-100 text-red-700">{restrictionLabel(r.restriction)}</Badge>}
      </div>
      {r.context && <p className="mt-2 text-sm leading-relaxed text-gray-700">“{r.context}”</p>}
      {r.resolution && <p className="mt-1 text-xs text-gray-500">Resolution: {r.resolution} ({r.handled_by}, {timeAgo(r.handled_at)})</p>}

      <div className="mt-3">
        <button type="button" onClick={() => setShowEvidence(s => !s)} className="text-xs font-semibold text-gray-500 hover:text-gray-800">
          {showEvidence ? 'Hide evidence' : 'Show evidence'}
        </button>
        {showEvidence && <div className="mt-2"><Evidence r={r} token={token} onRemoved={id => onUpdate({ ...r, removedIds: [...(r.removedIds ?? []), id] })} /></div>}
      </div>

      {status === 'pending' && (
        <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-3">
          {restricting ? (
            <div className="rounded-lg bg-red-50/50 p-3">
              <RestrictForm
                userId={r.reported_id}
                token={token}
                reportId={r.id}
                defaultReason={r.reason}
                onDone={restriction => close('reviewed', resolution || restrictionLabel(restriction))}
              />
              <button type="button" onClick={() => setRestricting(false)} className="mt-2 text-xs text-gray-500 hover:underline">Cancel</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Resolution note (optional)"
                     className="min-w-48 flex-1 rounded-lg border border-[#E0E0E0] px-2.5 py-1.5 text-sm" />
              <Btn variant="danger" disabled={busy} onClick={() => setRestricting(true)}>Restrict player…</Btn>
              <Btn variant="success" disabled={busy} onClick={() => close('reviewed')}>Reviewed, no action</Btn>
              <Btn variant="ghost" disabled={busy} onClick={() => close('dismissed')}>Dismiss</Btn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReportsTab({ token }) {
  const [reports, setReports] = useState([]);
  const [total, setTotal]     = useState(0);
  const [status, setStatus]   = useState('pending');
  const [page, setPage]       = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const version = usePlayerStore(s => s.version);

  async function load(s = status, p = page) {
    setLoading(true);
    try {
      const data = await adminFetch(`/admin/reports?status=${s}&limit=${LIMIT}&offset=${p * LIMIT}`, {}, token);
      setReports(data.reports ?? []);
      setTotal(data.total ?? 0);
      setError('');
    } catch (err) {
      setError(err.message || 'Reports did not load');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [version]);

  function switchStatus(s) {
    setStatus(s);
    setPage(0);
    load(s, 0);
  }

  function goToPage(p) {
    setPage(p);
    load(status, p);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[#1A1A2E]">User Reports{total > 0 && <span className="text-gray-400 font-semibold"> ({total})</span>}</h2>
        <div className="flex gap-2">
          {['pending', 'reviewed', 'dismissed'].map(s => (
            <button
              key={s}
              onClick={() => switchStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors capitalize
                ${status === s ? 'bg-[#E8453C] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => load()} className="font-bold underline">Retry</button>
        </div>
      )}
      {loading && reports.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No {status} reports.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map(r => (
            <ReportCard
              key={r.id}
              r={r}
              token={token}
              status={status}
              onClosed={id => { setReports(prev => prev.filter(x => x.id !== id)); setTotal(t => Math.max(0, t - 1)); }}
              onUpdate={next => setReports(prev => prev.map(x => (x.id === next.id ? next : x)))}
            />
          ))}
          {total > LIMIT && (
            <div className="bg-white rounded-xl border border-[#E0E0E0]">
              <Paginator page={page} total={total} limit={LIMIT} onPage={goToPage} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
