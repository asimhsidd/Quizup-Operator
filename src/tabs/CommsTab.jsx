// Comms: push campaigns to a segment of real players, and the launch waitlist (Quizup
// lib/campaigns.js). A campaign is previewed first and sent only after a confirm; the API
// refuses one above the cap (Settings at the bottom). The waitlist has no email provider behind it:
// export the addresses, send the launch email by hand, then mark them notified.
import { useEffect, useState } from 'react';
import { adminFetch, Badge, Btn, Spinner, fmtWhen, timeAgo } from '../lib/adminUtils.jsx';
import { useToastStore } from '../lib/toastStore';
import { usePlayerStore } from '../store/playerStore';
import { StatCard, SectionHeading, Table, n } from '../components/Panels.jsx';
import SettingsSection from '../components/SettingsSection.jsx';

const TITLE_MAX = 65;
const BODY_MAX = 240;
const input = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900';

const segmentText = s => [
  s.country ? `in ${s.country}` : 'everywhere',
  s.inactiveDays ? `away ${s.inactiveDays}+ days` : null,
  s.plus === 'plus' ? 'KWIZ+ only' : s.plus === 'free' ? 'without KWIZ+' : null,
].filter(Boolean).join(', ');

function Campaigns({ token }) {
  const { addToast } = useToastStore();
  const openPlayer = usePlayerStore(s => s.openPlayer);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [seg, setSeg] = useState({ country: '', inactiveDays: '', plus: 'any' });
  const [msg, setMsg] = useState({ title: '', body: '' });
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setData(await adminFetch('/admin/push/campaigns', {}, token)); setError(''); }
    catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, []);
  // Follow a campaign while it sends
  const sending = data?.campaigns.some(c => c.status === 'sending' && !c.stalled);
  useEffect(() => {
    if (!sending) return undefined;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [sending]);

  const segment = { country: seg.country.trim(), inactiveDays: seg.inactiveDays, plus: seg.plus };
  // A changed segment needs a new preview before it can be sent
  useEffect(() => { setPreview(null); }, [seg.country, seg.inactiveDays, seg.plus]);

  async function doPreview() {
    setBusy(true);
    try { setPreview(await adminFetch('/admin/push/preview', { method: 'POST', body: { segment } }, token)); }
    catch (err) { addToast(err.message, 'error'); }
    setBusy(false);
  }

  async function send() {
    if (!window.confirm(`Send "${msg.title}" to ${preview.players.toLocaleString()} players (${segmentText(preview.segment)})? This can't be undone.`)) return;
    setBusy(true);
    try {
      await adminFetch('/admin/push/campaigns', { method: 'POST', body: { ...msg, segment } }, token);
      addToast('Sending', 'success');
      setMsg({ title: '', body: '' });
      setPreview(null);
      await load();
    } catch (err) { addToast(err.message, 'error'); }
    setBusy(false);
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <Spinner />;
  const r = data.reach;
  const overCap = preview && preview.players > preview.cap;
  const canSend = preview && preview.players > 0 && !overCap && preview.pushEnabled
    && msg.title.trim() && msg.body.trim() && msg.title.length <= TITLE_MAX && msg.body.length <= BODY_MAX;

  return (
    <div className="flex flex-col gap-6">
      {!r.enabled && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Push isn't configured on this server (FIREBASE_SERVICE_ACCOUNT), so campaigns can't be sent.</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Players with push on" value={n(r.players)} sub={`${n(r.devices)} devices`} />
        {r.byDevice.slice(0, 3).map(d => <StatCard key={d.device} label={d.device} value={n(d.devices)} sub={`${n(d.players)} players`} />)}
      </div>

      <section className="rounded-xl border border-[#E0E0E0] bg-white p-5 flex flex-col gap-4">
        <h3 className="font-bold text-[#1A1A2E]">New campaign</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
            Country (2 letters, blank = all)
            <input value={seg.country} maxLength={2} placeholder="AU" className={input}
                   onChange={e => setSeg(s => ({ ...s, country: e.target.value.toUpperCase() }))} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
            Away at least (days, blank = anyone)
            <input type="number" min="1" max="365" value={seg.inactiveDays} className={input}
                   onChange={e => setSeg(s => ({ ...s, inactiveDays: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
            KWIZ+
            <select value={seg.plus} className={input} onChange={e => setSeg(s => ({ ...s, plus: e.target.value }))}>
              <option value="any">Anyone</option>
              <option value="plus">KWIZ+ only</option>
              <option value="free">Without KWIZ+</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-gray-500">Never sent to bots, under-16 accounts, or suspended or banned players.</p>
        <div className="grid gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
            Title ({msg.title.length}/{TITLE_MAX})
            <input value={msg.title} maxLength={TITLE_MAX} className={input} onChange={e => setMsg(m => ({ ...m, title: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
            Message ({msg.body.length}/{BODY_MAX})
            <textarea rows={3} value={msg.body} maxLength={BODY_MAX} className={input} onChange={e => setMsg(m => ({ ...m, body: e.target.value }))} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Btn variant="primary" disabled={busy} onClick={doPreview}>Preview who gets it</Btn>
          <Btn variant="coral" disabled={busy || !canSend} onClick={send}>Send</Btn>
          {preview && (
            <span className={`text-sm ${overCap ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
              {n(preview.players)} players, {n(preview.devices)} devices ({segmentText(preview.segment)})
              {overCap && `: over the cap of ${n(preview.cap)}`}
            </span>
          )}
        </div>
        {preview?.sample.length > 0 && (
          <p className="text-xs text-gray-500">
            For example: {preview.sample.map((p, i) => (
              <span key={p.id}>{i > 0 && ', '}<button type="button" onClick={() => openPlayer(p.id)} className="hover:underline">{p.username}</button></span>
            ))}
          </p>
        )}
        {(msg.title || msg.body) && (
          <div className="max-w-sm rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm shadow-sm">
            <div className="text-[10px] uppercase tracking-wide text-gray-400">KWIZ · now</div>
            <div className="font-semibold text-gray-900">{msg.title || 'Title'}</div>
            <div className="text-gray-700">{msg.body || 'Message'}</div>
          </div>
        )}
      </section>

      <div>
        <SectionHeading right={<Btn variant="ghost" onClick={load}>Refresh</Btn>}>Campaigns</SectionHeading>
        <Table
          cols={['When', 'Message', 'Segment', 'Players', 'Devices sent / failed / stale', 'Status', 'By']}
          empty="No campaigns yet."
          rows={data.campaigns.map(c => (
            <tr key={c.id} className="border-b border-gray-100 align-top">
              <td className="px-4 py-2 text-xs text-gray-500" title={fmtWhen(c.created_at)}>{timeAgo(c.created_at)}</td>
              <td className="px-4 py-2 max-w-xs"><div className="font-semibold text-[#1A1A2E]">{c.title}</div><div className="text-xs text-gray-600">{c.body}</div></td>
              <td className="px-4 py-2 text-xs">{segmentText(c.segment)}</td>
              <td className="px-4 py-2 tabular-nums">{n(c.done)} / {n(c.recipients)}</td>
              <td className="px-4 py-2 tabular-nums">{n(c.sent)} / {n(c.failed)} / {n(c.stale)}</td>
              <td className="px-4 py-2">
                {c.status === 'sent' && <Badge color="bg-green-100 text-green-700">sent</Badge>}
                {c.status === 'failed' && <Badge color="bg-red-100 text-red-700">failed</Badge>}
                {c.status === 'sending' && (c.stalled
                  ? <Badge color="bg-amber-100 text-amber-800">stopped</Badge>
                  : <Badge color="bg-sky-100 text-sky-700">sending</Badge>)}
                {c.error && <p className="mt-1 text-xs text-red-700">{c.error}</p>}
              </td>
              <td className="px-4 py-2 text-xs text-gray-500">{c.created_by}</td>
            </tr>
          ))}
        />
        <p className="mt-1 text-xs text-gray-500">"Stopped": a restart cut the send off part-way; the players after that point didn't get it.</p>
      </div>
    </div>
  );
}

function Waitlist({ token }) {
  const { addToast } = useToastStore();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  async function load() {
    try { setData(await adminFetch('/admin/waitlist', {}, token)); setError(''); }
    catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, []);

  const pending = data?.signups.filter(s => !s.notified_at) ?? [];

  function download() {
    const rows = [['email', 'source', 'signed_up', 'notified'], ...data.signups.map(s => [s.email, s.source, s.created_at, s.notified_at ?? ''])];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `kwiz-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function copyPending() {
    await navigator.clipboard.writeText(pending.map(s => s.email).join(', '));
    addToast(`${pending.length} addresses copied (for Bcc)`, 'success');
  }

  async function markAll() {
    if (!window.confirm(`Mark all ${pending.length} addresses as sent the launch email?`)) return;
    try {
      const r = await adminFetch('/admin/waitlist/notified', { method: 'POST', body: { all: true } }, token);
      addToast(`${r.marked} marked`, 'success');
      load();
    } catch (err) { addToast(err.message, 'error'); }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <Spinner />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-700">{n(data.total)} signups, {n(data.notNotified)} not yet emailed.</span>
        <Btn variant="ghost" disabled={!data.total} onClick={download}>Download CSV</Btn>
        <Btn variant="ghost" disabled={!pending.length} onClick={copyPending}>Copy un-emailed addresses</Btn>
        <Btn variant="success" disabled={!pending.length} onClick={markAll}>Mark all as emailed</Btn>
      </div>
      <Table
        cols={['Email', 'Source', 'Signed up', 'Emailed']}
        empty="Nobody on the waitlist yet."
        rows={data.signups.slice(0, 200).map(s => (
          <tr key={s.id} className="border-b border-gray-100">
            <td className="px-4 py-2">{s.email}</td>
            <td className="px-4 py-2 text-xs">{s.source}</td>
            <td className="px-4 py-2 text-xs text-gray-500" title={fmtWhen(s.created_at)}>{timeAgo(s.created_at)}</td>
            <td className="px-4 py-2 text-xs">{s.notified_at ? fmtWhen(s.notified_at) : '—'}</td>
          </tr>
        ))}
      />
      {data.total > 200 && <p className="text-xs text-gray-500">Showing the newest 200; the CSV has all of them.</p>}
    </div>
  );
}

export default function CommsTab({ token }) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-bold text-[#1A1A2E]">Push campaigns</h2>
        <p className="mb-4 text-xs text-gray-500">A tap opens the app's Home. Every send is in the Audit log.</p>
        <Campaigns token={token} />
      </div>
      <div>
        <SectionHeading>Launch waitlist (kwiz.live)</SectionHeading>
        <Waitlist token={token} />
      </div>
      <SettingsSection token={token} tab="comms" />
    </div>
  );
}
