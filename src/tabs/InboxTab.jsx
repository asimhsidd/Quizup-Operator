// Inbox: the KWIZ API's ops events (Quizup lib/opsEvents.js), what needs the operator's or
// the agent's attention. Player reports, questions pulled by reports, failed generations
// and cron jobs, voided purchases, finished Live events, tracked errors and AI spend.
// Repeats of an open item bump its count. Acknowledge = seen, someone's on it; Resolve =
// done. New and changed items arrive live over the admin socket (ops_event).
import { useEffect, useState } from 'react';
import { socket } from '../lib/socket';
import { adminFetch, Badge, Btn, Paginator, Spinner, fmtWhen, timeAgo } from '../lib/adminUtils.jsx';
import { useToastStore } from '../lib/toastStore';
import { usePlayerStore } from '../store/playerStore';

const LIMIT = 50;

const KINDS = {
  'report.user':          'Player report',
  'question.flagged':     'Question pulled',
  'ai.generation_failed': 'Generation failed',
  'cron.failed':          'Cron job failed',
  'billing.voided':       'Purchase voided',
  'live.finished':        'Live finished',
  'safety.agent_action':  'Agent restricted a player',
  'economy.signal':       'Economy signal',
  'error.new':            'New error (System)',
  'error.regressed':      'Error is back (System)',
  'error.spike':          'Error spike',
  'ai.budget':            'AI budget',
};

const SEVERITY = {
  error: { dot: 'bg-red-500',   badge: 'bg-red-100 text-red-700' },
  warn:  { dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800' },
  info:  { dot: 'bg-sky-500',   badge: 'bg-sky-100 text-sky-700' },
};

const STATUS_BADGE = {
  open:     'bg-[#E8453C]/10 text-[#E8453C]',
  acked:    'bg-gray-100 text-gray-600',
  resolved: 'bg-green-100 text-green-700',
};

function EventCard({ ev, token, onChanged }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const { addToast } = useToastStore();
  const openPlayer = usePlayerStore(s => s.openPlayer);
  const sev = SEVERITY[ev.severity] ?? SEVERITY.info;

  // An agent's restriction can be lifted from here; the drawer has the rest
  async function liftAgentAction() {
    const why = prompt('Lift this restriction now? Say why (kept in the audit log):');
    if (why === null) return;
    setBusy(true);
    try {
      await adminFetch(`/admin/restrictions/${ev.detail.restrictionId}/lift`, { method: 'POST', body: { note: why } }, token);
      const { event } = await adminFetch(`/admin/ops-events/${ev.id}`, { method: 'POST', body: { status: 'resolved', note: `Lifted: ${why}` } }, token);
      onChanged(event);
    } catch (err) {
      addToast(err.message, 'error');
    }
    setBusy(false);
  }

  async function setStatus(status) {
    setBusy(true);
    try {
      const { event } = await adminFetch(`/admin/ops-events/${ev.id}`, { method: 'POST', body: { status, ...(note.trim() && { note: note.trim() }) } }, token);
      onChanged(event);
      setNote('');
    } catch (err) {
      addToast(err.message, 'error');
    }
    setBusy(false);
  }

  return (
    <div className="bg-white rounded-xl border border-[#E0E0E0] p-4">
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${sev.dot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[#1A1A2E]">{ev.title}</span>
            {ev.count > 1 && <Badge color="bg-gray-900 text-white">×{ev.count}</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <Badge color={sev.badge}>{KINDS[ev.kind] ?? ev.kind}</Badge>
            <Badge color={STATUS_BADGE[ev.status]}>{ev.status}</Badge>
            {ev.subject_type && <span className="font-mono">{ev.subject_type}: {ev.subject_id}</span>}
            <span title={fmtWhen(ev.last_at)}>last {timeAgo(ev.last_at)}</span>
            {ev.count > 1 && <span title={fmtWhen(ev.created_at)}>first {timeAgo(ev.created_at)}</span>}
            {ev.handled_by && <span>{ev.status === 'resolved' ? 'resolved' : 'acknowledged'} by {ev.handled_by}</span>}
          </div>
          {ev.note && <p className="mt-1 text-xs text-gray-600">Note: {ev.note}</p>}
        </div>
        <button type="button" onClick={() => setOpen(o => !o)} className="shrink-0 text-xs font-semibold text-gray-400 hover:text-gray-700">
          {open ? 'Hide' : 'Details'}
        </button>
      </div>

      {open && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap break-words">
          {JSON.stringify(ev.detail, null, 2)}
        </pre>
      )}

      {ev.status !== 'resolved' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="min-w-40 flex-1 rounded-lg border border-[#E0E0E0] px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#E8453C]"
          />
          {ev.subject_type === 'user' && ev.subject_id && <Btn variant="primary" onClick={() => openPlayer(ev.subject_id)}>Open player</Btn>}
          {ev.kind === 'safety.agent_action' && ev.detail?.restrictionId && <Btn variant="danger" disabled={busy} onClick={liftAgentAction}>Lift it</Btn>}
          {ev.status === 'open' && <Btn variant="ghost" disabled={busy} onClick={() => setStatus('acked')}>Acknowledge</Btn>}
          <Btn variant="success" disabled={busy} onClick={() => setStatus('resolved')}>Resolve</Btn>
        </div>
      )}
    </div>
  );
}

export default function InboxTab({ token }) {
  const [status, setStatus] = useState('active');
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function load(s = status, k = kind, p = page) {
    try {
      const qs = new URLSearchParams({ status: s, limit: LIMIT, offset: p * LIMIT });
      if (k) qs.set('kind', k);
      setData(await adminFetch(`/admin/ops-events?${qs}`, {}, token));
      setError('');
    } catch (err) {
      setError(err.message || 'The inbox did not load');
    }
  }

  useEffect(() => { load(status, kind, page); }, [status, kind, page]);

  // Live: a new or changed event that belongs in this view goes to the top; one that no
  // longer belongs (resolved while viewing active, say) drops out.
  useEffect(() => {
    function onEvent(ev) {
      setData(d => {
        if (!d) return d;
        const fits = (status === 'active' ? ev.status !== 'resolved' : ev.status === status) && (!kind || ev.kind === kind);
        const rest = d.events.filter(e => e.id !== ev.id);
        const wasThere = rest.length !== d.events.length;
        const total = d.total + (fits && !wasThere ? 1 : 0) - (!fits && wasThere ? 1 : 0);
        return { ...d, total, events: fits ? [ev, ...rest] : rest };
      });
    }
    socket.on('ops_event', onEvent);
    return () => { socket.off('ops_event', onEvent); };
  }, [status, kind]);

  function changed(ev) {
    setData(d => {
      if (!d) return d;
      const stays = status === 'active' ? ev.status !== 'resolved' : ev.status === status;
      return {
        ...d,
        total: stays ? d.total : Math.max(0, d.total - 1),
        events: stays ? d.events.map(e => (e.id === ev.id ? ev : e)) : d.events.filter(e => e.id !== ev.id),
      };
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#1A1A2E]">
          Inbox{data && <span className="text-gray-400 font-semibold"> ({data.total})</span>}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {[['active', 'Needs attention'], ['open', 'New'], ['acked', 'Acknowledged'], ['resolved', 'Resolved']].map(([s, label]) => (
            <button
              key={s}
              type="button"
              onClick={() => { setStatus(s); setPage(0); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${status === s ? 'bg-[#E8453C] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {label}
            </button>
          ))}
          <select
            value={kind}
            onChange={e => { setKind(e.target.value); setPage(0); }}
            className="rounded-lg border border-[#E0E0E0] bg-white px-2 py-1.5 text-xs font-semibold text-gray-600"
          >
            <option value="">Every kind</option>
            {Object.entries(KINDS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <Btn variant="ghost" onClick={() => load()}>Refresh</Btn>
        </div>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!data && !error && <Spinner />}
      {data && data.events.length === 0 && (
        <p className="py-12 text-center text-gray-400">{status === 'resolved' ? 'Nothing resolved yet.' : 'Nothing needs attention.'}</p>
      )}
      {data?.events.map(ev => <EventCard key={ev.id} ev={ev} token={token} onChanged={changed} />)}
      {data && data.total > LIMIT && (
        <div className="bg-white rounded-xl border border-[#E0E0E0]">
          <Paginator page={page} total={data.total} limit={LIMIT} onPage={setPage} />
        </div>
      )}
    </div>
  );
}
