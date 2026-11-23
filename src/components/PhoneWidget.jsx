// Team → Phone widget: pair an owner's phone with KWIZ Glance (the home-screen widget app,
// repo /home/asim/kwiz-glance). A pairing code lasts 10 minutes and works once; the phone then
// has its own key, which only reads the widget's numbers. Unpairing stops it within 30 s.
// API: /admin/glance/* (Quizup routes/glance.js, lib/glance.js).
import { useEffect, useState } from 'react';
import { adminFetch, Btn, fmtWhen, timeAgo } from '../lib/adminUtils.jsx';
import { useToastStore } from '../lib/toastStore';

export default function PhoneWidget({ token }) {
  const [devices, setDevices] = useState(null);
  const [code, setCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const { addToast } = useToastStore();

  async function load() {
    try {
      setDevices((await adminFetch('/admin/glance/devices', {}, token)).devices);
    } catch (err) {
      addToast(err.message, 'error');
    }
  }
  useEffect(() => { load(); }, []);

  // Count the code down, and pick up the phone as soon as it pairs
  useEffect(() => {
    if (!code) return undefined;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(load, 4000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [code]);
  useEffect(() => {
    if (code && devices?.some(d => new Date(d.created_at) > new Date(code.madeAt))) {
      setCode(null);
      addToast('Phone paired', 'success');
    }
  }, [devices]);

  async function act(fn, ok) {
    setBusy(true);
    try {
      const out = await fn();
      if (ok) addToast(ok, 'success');
      return out;
    } catch (err) {
      addToast(err.message, 'error');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function pair() {
    const out = await act(() => adminFetch('/admin/glance/pair', { method: 'POST' }, token));
    if (out) setCode({ ...out, madeAt: new Date().toISOString() });
  }

  async function unpair(d) {
    if (!window.confirm(`Unpair ${d.label}? Its widget stops updating.`)) return;
    await act(() => adminFetch(`/admin/glance/devices/${d.id}`, { method: 'DELETE' }, token), 'Unpaired');
    load();
  }

  async function test() {
    const out = await act(() => adminFetch('/admin/glance/push', { method: 'POST' }, token));
    if (out) addToast(out.pushed ? `Sent to ${out.pushed} phone${out.pushed === 1 ? '' : 's'}` : 'No phone took it (none paired with push on)', out.pushed ? 'success' : 'error');
  }

  const left = code ? Math.max(0, Math.round((new Date(code.expiresAt) - now) / 1000)) : 0;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5">
      <div>
        <h2 className="text-lg font-bold text-[#1A1A2E]">Phone widget</h2>
        <p className="text-sm text-gray-600">
          KWIZ Glance puts players, games, the Inbox, errors, AI spend, the agent and the server on your phone's home screen.
          It updates when the numbers change and buzzes when something gets worse. A paired phone can only read those numbers.
        </p>
      </div>

      {code && left > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-center">
          <p className="text-sm text-amber-900">Type this into KWIZ Glance on the phone</p>
          <p className="my-2 font-mono text-4xl font-bold tracking-[0.2em] text-[#1A1A2E]">{code.code}</p>
          <p className="text-xs text-amber-800">Works once · runs out in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</p>
          <div className="mt-2"><Btn variant="ghost" onClick={() => setCode(null)}>Cancel</Btn></div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Btn variant="primary" disabled={busy} onClick={pair}>Pair a phone</Btn>
          {devices?.some(d => d.push) && <Btn variant="ghost" disabled={busy} onClick={test}>Send the numbers now</Btn>}
        </div>
      )}

      {devices?.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
          {devices.map(d => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[#1A1A2E]">{d.label}</div>
                <div className="text-xs text-gray-500">
                  {d.admin} · paired {timeAgo(d.created_at)} · <span title={fmtWhen(d.last_seen_at)}>read {d.last_seen_at ? timeAgo(d.last_seen_at) : 'never'}</span>
                  {!d.push && <span className="font-semibold text-amber-700"> · push not on yet</span>}
                </div>
              </div>
              <button type="button" onClick={() => unpair(d)} className="text-xs font-semibold text-red-600 hover:underline">Unpair</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
