// System: the KWIZ API's health (build, this instance, Postgres and Redis, queues, AI spend
// against the budget), tracked errors from the backend and the app, the daily digest, and
// how the cron jobs have been running (Quizup lib/systemHealth.js, lib/errorTracking.js,
// lib/cronLock.js). New errors, errors that come back, spikes and AI spend over 80% of the
// budget also open Inbox items.
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { adminFetch, Badge, Btn, Spinner, fmtWhen, timeAgo } from '../lib/adminUtils.jsx';
import { useToastStore } from '../lib/toastStore';
import { usePlayerStore } from '../store/playerStore';
import { StatCard, SectionHeading, Pills, n } from '../components/Panels.jsx';

const usd = v => `$${Number(v ?? 0).toFixed(2)}`;
const uptime = s => (s >= 86400 ? `${Math.floor(s / 86400)} d ${Math.floor((s % 86400) / 3600)} h` : s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min` : `${Math.floor(s / 60)} min`);

function Health({ token }) {
  const [h, setH] = useState(null);
  const [error, setError] = useState('');
  async function load() {
    try { setH(await adminFetch('/admin/system/health', {}, token)); setError(''); }
    catch (err) { setError(err.message || 'Health did not load'); }
  }
  useEffect(() => { load(); }, []);
  if (error) return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (!h) return <Spinner />;
  const s = h.aiSpend;
  const pct = s.share == null ? null : Math.round(s.share * 100);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          Build <span className="font-mono">{h.build.gitSha.slice(0, 8)}</span> · up {uptime(h.build.uptimeS)} (since {fmtWhen(h.build.startedAt)}) · Node {h.build.node} ·
          this instance {h.instance.name}, {h.instance.rssMb} MB{h.instance.sockets != null ? `, ${h.instance.sockets} sockets` : ''}
        </p>
        <Btn variant="ghost" onClick={load}>Refresh</Btn>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Postgres / Redis" value={`${h.postgres.ok ? `${h.postgres.ms} ms` : 'down'} · ${h.redis.ok ? `${h.redis.ms} ms` : 'down'}`} sub="a round trip from this instance" />
        <StatCard label="Matchmaking queue" value={n(h.queues.matchmaking)} sub={`${n(h.queues.topicsWaiting)} topics waiting for questions, ${n(h.queues.topicsThin)} thin`} />
        <StatCard label="Errors (24 h)" value={n(h.errors.last_24h)} sub={`${n(h.errors.open)} open · ${n(h.queues.failedGenerations24h)} failed generations`} />
        <StatCard label="AI spend this month" value={usd(s.month)}
                  sub={`${usd(s.today)} today${s.budget ? ` · ${pct}% of ${usd(s.budget)}` : ' · no budget set'}`} />
      </div>
      {s.budget > 0 && (
        <div className="h-2 overflow-hidden rounded-full bg-gray-200" title={`${pct}% of the month's AI budget`}>
          <div className={`h-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
    </div>
  );
}

function ErrorRow({ e, token, onChanged }) {
  const { addToast } = useToastStore();
  const openPlayer = usePlayerStore(s => s.openPlayer);
  const [open, setOpen] = useState(false);
  async function setStatus(status) {
    try { await adminFetch(`/admin/errors/${e.id}`, { method: 'POST', body: { status } }, token); onChanged(); }
    catch (err) { addToast(err.message, 'error'); }
  }
  const c = e.context ?? {};
  return (
    <div className="rounded-xl border border-[#E0E0E0] bg-white p-3">
      <div className="flex items-start gap-3">
        <Badge color={e.source === 'app' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-700'}>{e.source}</Badge>
        <button type="button" onClick={() => setOpen(o => !o)} className="min-w-0 flex-1 text-left">
          <div className="break-words font-mono text-xs text-[#1A1A2E]">{e.message.slice(0, 300)}</div>
          <div className="mt-0.5 text-xs text-gray-500">
            {n(e.count)} in all · {n(e.last_24h)} in 24 h · last {timeAgo(e.last_at)} · first {timeAgo(e.first_at)}
            {c.appVersion ? ` · app ${c.appVersion}` : ''}{c.url ? ` · ${c.url}` : ''}
          </div>
        </button>
        <div className="flex shrink-0 gap-1.5">
          {e.status !== 'resolved' && <Btn variant="success" onClick={() => setStatus('resolved')}>Resolved</Btn>}
          {e.status !== 'ignored' && <Btn variant="ghost" onClick={() => setStatus('ignored')}>Ignore</Btn>}
          {e.status !== 'open' && <Btn variant="primary" onClick={() => setStatus('open')}>Reopen</Btn>}
        </div>
      </div>
      {open && (
        <div className="mt-2 flex flex-col gap-1">
          {c.userId && <button type="button" onClick={() => openPlayer(c.userId)} className="self-start text-xs text-cyan-700 hover:underline">The player it last happened to</button>}
          {e.handled_by && <p className="text-xs text-gray-500">Marked {e.status} by {e.handled_by}, {fmtWhen(e.handled_at)}</p>}
          <pre className="max-h-72 overflow-auto rounded-lg bg-gray-900 p-3 text-[11px] leading-relaxed text-gray-100 whitespace-pre-wrap">{e.stack || e.message}</pre>
        </div>
      )}
    </div>
  );
}

function Errors({ token }) {
  const [status, setStatus] = useState('open');
  const [source, setSource] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  async function load() {
    try {
      setData(await adminFetch(`/admin/errors?status=${status}${source ? `&source=${source}` : ''}&limit=100`, {}, token));
      setError('');
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, [status, source]);

  // The hourly trend, backend and app side by side
  const hours = new Map();
  for (const r of data?.trend ?? []) {
    const k = new Date(r.hour).toLocaleTimeString(undefined, { hour: 'numeric' });
    hours.set(k, { hour: k, backend: 0, app: 0, ...hours.get(k), [r.source]: r.n });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Pills options={[['open', `Open${data?.counts.open ? ` · ${data.counts.open}` : ''}`], ['resolved', 'Resolved'], ['ignored', 'Ignored']]} value={status} onChange={setStatus} />
        <div className="flex items-center gap-2">
          <Pills options={[['', 'All'], ['backend', 'Backend'], ['app', 'App']]} value={source} onChange={setSource} />
          <Btn variant="ghost" onClick={load}>Refresh</Btn>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <Spinner />}
      {data && hours.size > 0 && (
        <div className="h-40 rounded-xl border border-[#E0E0E0] bg-white p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[...hours.values()]} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#6B7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} width={40} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="backend" name="Backend" stackId="e" fill="#475569" />
              <Bar dataKey="app" name="App" stackId="e" fill="#7C3AED" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {data?.errors.map(e => <ErrorRow key={e.id} e={e} token={token} onChanged={load} />)}
      {data && data.errors.length === 0 && <p className="py-6 text-center text-sm text-gray-400">No {status} errors.</p>}
      <p className="text-xs text-gray-500">
        Every console.error and unhandled rejection in the backend, and uncaught errors in the app, grouped by message and
        where it happened. Resolved errors reopen if they come back; ignored ones are counted but never alert.
      </p>
    </div>
  );
}

function Digest({ token }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    adminFetch('/admin/digests', {}, token).then(setD).catch(err => setError(err.message));
  }, []);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!d) return <Spinner />;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-cyan-700">The last 24 hours, now</div>
        {d.now.text}
      </div>
      {d.digests.map(g => (
        <div key={g.day} className="rounded-xl border border-[#E0E0E0] bg-white p-4 text-sm">
          <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
            <span className="font-bold text-[#1A1A2E]">{new Date(`${g.day}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>
            <span>{g.pushed_to ? `pushed to ${g.pushed_to} device${g.pushed_to === 1 ? '' : 's'}` : 'not pushed'}</span>
          </div>
          {g.text}
        </div>
      ))}
      {d.digests.length === 0 && <p className="text-sm text-gray-400">No digests yet; the first is written at 21:00 UTC.</p>}
      <p className="text-xs text-gray-500">
        Written daily at 21:00 UTC and pushed to the player account whose email matches an owner in Team (Config → System → digest_push).
      </p>
    </div>
  );
}

function Crons({ token }) {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      setJobs((await adminFetch('/admin/system/crons', {}, token)).jobs);
      setError('');
    } catch (err) {
      setError(err.message || 'Cron history did not load');
    }
  }
  useEffect(() => { load(); }, []);

  const failing = jobs?.filter(j => j.last_ok === false).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {jobs ? `${jobs.length} jobs, ${failing ? `${failing} failing on their last run` : 'all fine on their last run'}.` : ' '}
          {' '}A job missing here hasn't run since the history started.
        </p>
        <Btn variant="ghost" onClick={load}>Refresh</Btn>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!jobs && !error && <Spinner />}

      {jobs && (
        <div className="overflow-x-auto rounded-xl border border-[#E0E0E0] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E0E0E0] bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                {['Job', 'Last run', 'Result', 'Runs (24 h)', 'Failures (24 h)', 'Avg time', 'Last failure'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.job} className="border-b border-gray-100 align-top">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#1A1A2E]">{j.job}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500" title={fmtWhen(j.last_started_at)}>{timeAgo(j.last_started_at)}</td>
                  <td className="px-4 py-2.5">
                    {j.last_ok === null
                      ? <Badge color="bg-sky-100 text-sky-700">running</Badge>
                      : j.last_ok
                        ? <Badge color="bg-green-100 text-green-700">ok</Badge>
                        : <Badge color="bg-red-100 text-red-700">failed</Badge>}
                    {j.last_ok === false && j.last_error && <p className="mt-1 max-w-md text-xs text-red-700 break-words">{j.last_error}</p>}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{j.runs_24h}</td>
                  <td className={`px-4 py-2.5 tabular-nums ${j.failures_24h ? 'font-bold text-red-600' : 'text-gray-400'}`}>{j.failures_24h}</td>
                  <td className="px-4 py-2.5 tabular-nums text-gray-500">{j.avg_seconds != null ? `${j.avg_seconds}s` : '—'}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500" title={fmtWhen(j.last_failed_at)}>{j.last_failed_at ? timeAgo(j.last_failed_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {jobs.length === 0 && <p className="py-8 text-center text-gray-400">No runs recorded yet.</p>}
        </div>
      )}
    </div>
  );
}

export default function SystemTab({ token }) {
  const [view, setView] = useState('errors');
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-3 text-lg font-bold text-[#1A1A2E]">Health</h2>
        <Health token={token} />
      </div>
      <div>
        <SectionHeading right={<Pills options={[['errors', 'Errors'], ['digest', 'Daily digest'], ['crons', 'Cron jobs']]} value={view} onChange={setView} />}>
          {view === 'errors' ? 'Errors' : view === 'digest' ? 'Daily digest' : 'Cron jobs'}
        </SectionHeading>
        {view === 'errors' && <Errors token={token} />}
        {view === 'digest' && <Digest token={token} />}
        {view === 'crons' && <Crons token={token} />}
      </div>
    </div>
  );
}
