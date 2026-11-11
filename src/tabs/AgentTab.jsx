// Agent: KWIZ's operating agent (Quizup docs/operator-agent.md). Its switches (the kill
// switch, each domain off / dry-run / live, its spend and push caps), what's waiting for the
// owner's approval, everything it did or would have done (with Undo), its playbooks (tier,
// daily cap and policy per action), the Live schedule it planned, and its digests.
// The API decides what the agent may do (Quizup backend/lib/agentPolicy.js); this tab only
// shows and changes the owner's side.
import { useEffect, useState } from 'react';
import { adminFetch, Badge, Btn, Spinner, fmtWhen, timeAgo } from '../lib/adminUtils.jsx';
import { StatCard, SectionHeading, Table, Pills } from '../components/Panels.jsx';
import SettingsSection from '../components/SettingsSection.jsx';
import { useToastStore } from '../lib/toastStore';
import { useConfigStore } from '../store/configStore';

const TIER_LABEL = { auto: 'Auto', auto_tell: 'Auto + tell', ask: 'Ask', never: 'Never' };
const TIER_COLOR = {
  auto: 'bg-green-100 text-green-700', auto_tell: 'bg-sky-100 text-sky-700',
  ask: 'bg-amber-100 text-amber-800', never: 'bg-gray-200 text-gray-600',
};
const MODE_COLOR = { live: 'bg-green-100 text-green-700', dry_run: 'bg-amber-100 text-amber-800', off: 'bg-gray-200 text-gray-600' };
const MODE_LABEL = { live: 'Live', dry_run: 'Dry-run', off: 'Off' };

function Json({ value }) {
  if (value == null || (typeof value === 'object' && !Object.keys(value).length)) return null;
  return (
    <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap break-words">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────

function Overview({ token, data, reload }) {
  const { addToast } = useToastStore();
  const [busy, setBusy] = useState(false);
  const reloadConfig = useConfigStore(s => s.load);
  if (!data) return <Spinner />;
  const beat = data.heartbeat;
  const stale = !beat || Date.now() - new Date(beat.at).getTime() > 5 * 60_000;
  const counts = {};
  for (const r of data.last24h) counts[r.domain] = { ...counts[r.domain], [r.mode]: r.n };

  async function setConfig(key, value, label) {
    setBusy(true);
    try {
      await adminFetch('/admin/config', { method: 'PUT', body: { key, value: String(value) } }, token);
      addToast(label, 'success');
      await Promise.all([reload(), reloadConfig(token)]);
    } catch (err) {
      addToast(err.message, 'error');
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${data.enabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
        <div>
          <div className="font-bold text-[#1A1A2E]">{data.enabled ? 'The agent is on' : 'The agent is off'}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {data.enabled
              ? 'It acts only in domains switched to live, within each action\'s tier and daily cap.'
              : 'The API refuses every change it tries. It still reads, so its heartbeat shows below.'}
          </div>
        </div>
        <Btn variant={data.enabled ? 'danger' : 'success'} disabled={busy}
             onClick={() => setConfig('agent_enabled', !data.enabled, data.enabled ? 'Agent switched off' : 'Agent switched on')}>
          {data.enabled ? 'Switch off' : 'Switch on'}
        </Btn>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Last seen" value={beat ? timeAgo(beat.at) : 'never'} sub={beat ? `${beat.label ?? ''} · ${String(beat.version ?? 'dev').slice(0, 8)}` : 'No agent has read its state yet'} />
        <StatCard label="Waiting for you" value={data.pendingProposals} sub="proposals to approve or decline" />
        <StatCard label="Model spend today" value={`$${data.llm.spentTodayUsd.toFixed(3)}`} sub={`of $${data.llm.dailyBudgetUsd} a day · ${data.llm.callsToday} calls`} />
        <StatCard label="Actions, 24 h" value={data.last24h.filter(r => r.mode === 'live').reduce((a, r) => a + r.n, 0)}
                  sub={`${data.last24h.filter(r => r.mode === 'dry_run').reduce((a, r) => a + r.n, 0)} more in dry-run`} />
      </div>
      {data.enabled && stale && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The agent hasn't checked in for {beat ? timeAgo(beat.at).replace(' ago', '') : 'ever'}. It reads its state every minute; check its container.
        </p>
      )}

      <div>
        <SectionHeading>Domains</SectionHeading>
        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(data.domains).map(([d, label]) => (
            <div key={d} className="rounded-xl border border-[#E0E0E0] bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[#1A1A2E]">{label}</span>
                <Badge color={MODE_COLOR[data.modes[d]]}>{MODE_LABEL[data.modes[d]]}</Badge>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Last 24 h: {counts[d]?.live ?? 0} done, {counts[d]?.dry_run ?? 0} in dry-run
              </div>
              <div className="mt-3">
                <Pills options={[['off', 'Off'], ['dry_run', 'Dry-run'], ['live', 'Live']]} value={data.modes[d]}
                       onChange={m => m !== data.modes[d] && setConfig(`agent_mode_${d}`, m, `${label}: ${MODE_LABEL[m]}`)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <SettingsSection token={token} tab="agent" title="Agent settings" />
    </div>
  );
}

// ── Approvals ────────────────────────────────────────────────────────────────

function Approvals({ token, onChanged }) {
  const { addToast } = useToastStore();
  const [status, setStatus] = useState('pending');
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(null);

  async function load(s = status) {
    try { setList((await adminFetch(`/admin/agent/proposals?status=${s}`, {}, token)).proposals); }
    catch (err) { addToast(err.message, 'error'); }
  }
  useEffect(() => { load(status); }, [status]);

  async function decide(p, approve) {
    const note = approve ? '' : prompt('Decline: a note for the record (optional)');
    if (note === null) return;
    setBusy(p.id);
    try {
      await adminFetch(`/admin/agent/proposals/${p.id}/decision`, { method: 'POST', body: { approve, ...(note && { note }) } }, token);
      addToast(approve ? 'Approved: the agent carries it out within a minute' : 'Declined', 'success');
      await load();
      onChanged();
    } catch (err) {
      addToast(err.message, 'error');
    }
    setBusy(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <Pills options={[['pending', 'Waiting'], ['approved', 'Approved'], ['done', 'Done'], ['declined', 'Declined'], ['all', 'All']]} value={status} onChange={setStatus} />
      {!list && <Spinner />}
      {list?.length === 0 && <p className="py-10 text-center text-gray-400">{status === 'pending' ? 'Nothing waiting for you.' : 'None.'}</p>}
      {list?.map(p => (
        <div key={p.id} className="rounded-xl border border-[#E0E0E0] bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[#1A1A2E]">{p.title}</span>
            <Badge color="bg-gray-100 text-gray-600">{p.action}</Badge>
            <Badge color={p.status === 'pending' ? 'bg-amber-100 text-amber-800' : p.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}>{p.status}</Badge>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Proposed {timeAgo(p.created_at)}{p.decided_by && ` · ${p.status === 'declined' ? 'declined' : 'approved'} by ${p.decided_by}`}
            {p.status === 'pending' && ` · lapses ${fmtWhen(p.expires_at)}`}
          </div>
          {p.reasoning && <p className="mt-2 text-sm text-gray-700">{p.reasoning}</p>}
          <p className="mt-2 font-mono text-xs text-gray-500">{p.request.method} {p.request.path}</p>
          <Json value={p.request.body} />
          <Json value={p.evidence} />
          {p.decision_note && <p className="mt-2 text-xs text-gray-600">Note: {p.decision_note}</p>}
          {p.status === 'pending' && (
            <div className="mt-3 flex gap-2">
              <Btn variant="success" disabled={busy === p.id} onClick={() => decide(p, true)}>Approve</Btn>
              <Btn variant="danger" disabled={busy === p.id} onClick={() => decide(p, false)}>Decline</Btn>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Activity ─────────────────────────────────────────────────────────────────

function Activity({ token, domains }) {
  const { addToast } = useToastStore();
  const [domain, setDomain] = useState('');
  const [mode, setMode] = useState('');
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);

  async function load() {
    const qs = new URLSearchParams({ limit: 100 });
    if (domain) qs.set('domain', domain);
    if (mode) qs.set('mode', mode);
    try { setList((await adminFetch(`/admin/agent/actions?${qs}`, {}, token)).actions); }
    catch (err) { addToast(err.message, 'error'); }
  }
  useEffect(() => { load(); }, [domain, mode]);

  async function undo(a) {
    if (!confirm(`Undo "${a.title}"?`)) return;
    try {
      await adminFetch(`/admin/agent/actions/${a.id}/undo`, { method: 'POST' }, token);
      addToast('Undone', 'success');
      load();
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={domain} onChange={e => setDomain(e.target.value)} className="rounded-lg border border-[#E0E0E0] bg-white px-2 py-1.5 text-xs font-semibold text-gray-600">
          <option value="">Every domain</option>
          {Object.entries(domains ?? {}).map(([d, label]) => <option key={d} value={d}>{label}</option>)}
        </select>
        <Pills options={[['', 'All'], ['live', 'Done'], ['dry_run', 'Dry-run']]} value={mode} onChange={setMode} />
        <Btn variant="ghost" onClick={load}>Refresh</Btn>
      </div>
      {!list && <Spinner />}
      {list?.length === 0 && <p className="py-10 text-center text-gray-400">Nothing yet.</p>}
      {list && list.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[#E0E0E0] bg-white divide-y divide-[#EEE]">
          {list.map(a => (
            <div key={a.id} className="p-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm ${a.undone_at ? 'line-through text-gray-400' : 'text-[#1A1A2E]'}`}>{a.title}</span>
                    {a.mode === 'dry_run' && <Badge color={MODE_COLOR.dry_run}>would have</Badge>}
                    {a.mode === 'live' && a.ok === false && <Badge color="bg-red-100 text-red-700">failed</Badge>}
                    {a.undone_at && <Badge color="bg-gray-200 text-gray-600">undone by {a.undone_by}</Badge>}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    <span title={fmtWhen(a.at)}>{timeAgo(a.at)}</span> · {a.action} · <Badge color={TIER_COLOR[a.tier]}>{TIER_LABEL[a.tier]}</Badge>
                    {a.target_type && <span className="font-mono"> · {a.target_type}: {a.target_id}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {a.mode === 'live' && a.ok && a.undo && !a.undone_at && <Btn variant="danger" onClick={() => undo(a)}>Undo</Btn>}
                  <button type="button" onClick={() => setOpen(open === a.id ? null : a.id)} className="text-xs font-semibold text-gray-400 hover:text-gray-700">
                    {open === a.id ? 'Hide' : 'Details'}
                  </button>
                </div>
              </div>
              {open === a.id && (
                <div className="mt-2">
                  {a.reasoning && <p className="text-sm text-gray-700">{a.reasoning}</p>}
                  {a.request && <p className="mt-2 font-mono text-xs text-gray-500">{a.request.method} {a.request.path}</p>}
                  <Json value={a.request?.body} />
                  <Json value={a.evidence} />
                  <Json value={a.response} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Playbooks ────────────────────────────────────────────────────────────────

function PlaybookRow({ b, token, onSaved }) {
  const { addToast } = useToastStore();
  const [tier, setTier] = useState(b.tier);
  const [cap, setCap] = useState(String(b.dailyCap));
  const [policy, setPolicy] = useState(b.policy ?? '');
  const [busy, setBusy] = useState(false);
  const changed = tier !== b.tier || cap !== String(b.dailyCap) || (policy || null) !== (b.policy || null);
  const fixed = b.defaultTier === 'never';

  async function save(body) {
    setBusy(true);
    try {
      await adminFetch(`/admin/agent/playbooks/${b.action}`, { method: 'PUT', body }, token);
      addToast('Playbook saved', 'success');
      onSaved();
    } catch (err) {
      addToast(err.message, 'error');
    }
    setBusy(false);
  }

  return (
    <tr className="border-b border-[#F0F0F0] align-top">
      <td className="px-4 py-3">
        <div className="text-sm text-[#1A1A2E]">{b.label}</div>
        <div className="font-mono text-xs text-gray-400">{b.action}</div>
        {!fixed && (
          <textarea value={policy} onChange={e => setPolicy(e.target.value)} rows={1} placeholder="Policy for the agent (optional)"
                    className="mt-2 w-full rounded-lg border border-[#E0E0E0] px-2 py-1 text-xs focus:outline-none focus:border-[#E8453C]" />
        )}
      </td>
      <td className="px-4 py-3">
        {fixed ? <Badge color={TIER_COLOR.never}>Never</Badge> : (
          <select value={tier} onChange={e => setTier(e.target.value)} className="rounded-lg border border-[#E0E0E0] bg-white px-2 py-1 text-xs">
            {['auto', 'auto_tell', 'ask', 'never'].map(t => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
          </select>
        )}
        {b.tier !== b.defaultTier && <div className="mt-1 text-[11px] text-gray-400">default {TIER_LABEL[b.defaultTier]}</div>}
      </td>
      <td className="px-4 py-3">
        {!fixed && <input value={cap} onChange={e => setCap(e.target.value.replace(/\D/g, ''))} className="w-16 rounded-lg border border-[#E0E0E0] px-2 py-1 text-xs" />}
        <div className="mt-1 text-[11px] text-gray-400">{b.usedToday} used today</div>
      </td>
      <td className="px-4 py-3">
        {!fixed && (
          <div className="flex gap-2">
            <Btn variant="primary" disabled={!changed || busy || cap === ''}
                 onClick={() => save({ tier, dailyCap: Number(cap), policy })}>Save</Btn>
            {(b.updatedAt) && <Btn variant="ghost" disabled={busy} onClick={() => save({ tier: null, dailyCap: null, policy: null })}>Reset</Btn>}
          </div>
        )}
      </td>
    </tr>
  );
}

function Playbooks({ token }) {
  const { addToast } = useToastStore();
  const [data, setData] = useState(null);
  async function load() {
    try { setData(await adminFetch('/admin/agent/playbooks', {}, token)); }
    catch (err) { addToast(err.message, 'error'); }
  }
  useEffect(() => { load(); }, []);
  if (!data) return <Spinner />;
  const byDomain = {};
  for (const b of data.playbooks) (byDomain[b.domain] ??= []).push(b);
  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-gray-500">
        Auto: acts and logs. Auto + tell: acts, then an Inbox item with Undo. Ask: proposes and waits for you. Never: refused by the API.
        The API enforces the tier and the daily cap whatever the agent does.
      </p>
      {Object.entries(byDomain).map(([d, books]) => (
        <div key={d}>
          <SectionHeading>{data.domains[d] ?? d}</SectionHeading>
          <Table cols={['Action', 'Tier', 'Daily cap', '']}
                 rows={books.map(b => <PlaybookRow key={`${b.action}:${b.updatedAt}`} b={b} token={token} onSaved={load} />)} />
        </div>
      ))}
    </div>
  );
}

// ── Live schedule and digests ────────────────────────────────────────────────

function Schedule({ token }) {
  const { addToast } = useToastStore();
  const [events, setEvents] = useState(null);
  useEffect(() => {
    adminFetch('/admin/live?limit=100', {}, token)
      .then(d => setEvents(d.events.filter(e => e.status === 'scheduled').sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))))
      .catch(err => addToast(err.message, 'error'));
  }, []);
  if (!events) return <Spinner />;
  return (
    <Table cols={['Starts', 'Event', 'Mix', 'Joined', 'Scheduled by']} empty="Nothing scheduled."
           rows={events.map(e => (
             <tr key={e.id} className="border-b border-[#F0F0F0]">
               <td className="px-4 py-2.5 text-sm whitespace-nowrap">{fmtWhen(e.starts_at)}</td>
               <td className="px-4 py-2.5 text-sm">{e.name || 'KWIZ Live'}</td>
               <td className="px-4 py-2.5 text-xs text-gray-600">
                 {e.mode === 'mixed' && e.mode_weights ? Object.entries(e.mode_weights).map(([k, w]) => `${k.replace(/_/g, ' ')} ${w}`).join(' · ') : e.mode}
               </td>
               <td className="px-4 py-2.5 text-sm">{e.joined}</td>
               <td className="px-4 py-2.5 text-xs">{e.created_by === 'agent' ? <Badge color="bg-sky-100 text-sky-700">agent</Badge> : e.created_by ?? 'daily default'}</td>
             </tr>
           ))} />
  );
}

function Digests({ token }) {
  const { addToast } = useToastStore();
  const [data, setData] = useState(null);
  useEffect(() => {
    adminFetch('/admin/digests', {}, token).then(setData).catch(err => addToast(err.message, 'error'));
  }, []);
  if (!data) return <Spinner />;
  return (
    <div className="flex flex-col gap-3">
      {data.digests.length === 0 && <p className="py-10 text-center text-gray-400">No digests yet.</p>}
      {data.digests.map(d => (
        <div key={d.day} className="rounded-xl border border-[#E0E0E0] bg-white p-4">
          <div className="text-xs font-bold text-gray-500">{d.day} · pushed to {d.pushed_to}</div>
          <p className="mt-1 text-sm text-[#1A1A2E]">{d.text}</p>
          {d.agent_text && d.agent_text !== d.text && (
            <p className="mt-2 border-l-2 border-amber-300 pl-3 text-sm text-gray-600">
              <span className="text-xs font-bold text-amber-700">The agent's version (dry-run): </span>{d.agent_text}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── The tab ──────────────────────────────────────────────────────────────────

const VIEWS = [['overview', 'Overview'], ['approvals', 'Approvals'], ['activity', 'Activity'], ['playbooks', 'Playbooks'], ['schedule', 'Live schedule'], ['digests', 'Digests']];

export default function AgentTab({ token }) {
  const [view, setView] = useState('overview');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      setData(await adminFetch('/admin/agent/overview', {}, token));
      setError('');
    } catch (err) {
      setError(err.message || 'The agent overview did not load');
    }
  }
  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[#1A1A2E] font-bold text-lg">Agent</h2>
          <p className="text-gray-500 text-xs mt-0.5">KWIZ's operating agent: what it may do, what it did, and what it's asking you.</p>
        </div>
        <Pills options={VIEWS.map(([v, label]) => [v, v === 'approvals' && data?.pendingProposals ? `${label} (${data.pendingProposals})` : label])}
               value={view} onChange={setView} />
      </div>
      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {view === 'overview' && <Overview token={token} data={data} reload={load} />}
      {view === 'approvals' && <Approvals token={token} onChanged={load} />}
      {view === 'activity' && <Activity token={token} domains={data?.domains} />}
      {view === 'playbooks' && <Playbooks token={token} />}
      {view === 'schedule' && <Schedule token={token} />}
      {view === 'digests' && <Digests token={token} />}
    </div>
  );
}
