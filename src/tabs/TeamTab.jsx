// Team (owners only): who can use the Operator. People sign in with Google by the email
// listed here; agents (the operating agent) use an API key made here, shown once.
// Switching someone off or revoking a key takes effect within 30 seconds.
// API: /admin/admins, /admin/admins/:id/keys, /admin/admin-keys/:id (Quizup lib/adminAuth.js).
import { useEffect, useState } from 'react';
import { adminFetch, Badge, Btn, Spinner, fmtWhen, timeAgo } from '../lib/adminUtils.jsx';
import { useToastStore } from '../lib/toastStore';

const ROLE_BADGE = {
  owner:     'bg-gray-900 text-white',
  moderator: 'bg-cyan-100 text-cyan-700',
  agent:     'bg-purple-100 text-purple-700',
};

function NewKey({ created, onDone }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">New key for {created.name}. Copy it now: it won't be shown again.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-xs text-gray-800 border border-amber-200">{created.key}</code>
        <Btn variant="primary" onClick={async () => { await navigator.clipboard.writeText(created.key); setCopied(true); }}>{copied ? 'Copied' : 'Copy'}</Btn>
        <Btn variant="ghost" onClick={onDone}>Done</Btn>
      </div>
      <p className="mt-2 text-xs text-amber-800">The agent sends it as the <code>x-admin-key</code> header (or <code>auth.adminKey</code> on the socket).</p>
    </div>
  );
}

export default function TeamTab({ token, me }) {
  const [admins, setAdmins] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ role: 'owner', email: '', name: '' });
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const { addToast } = useToastStore();

  async function load() {
    try {
      setAdmins((await adminFetch('/admin/admins', {}, token)).admins);
      setError('');
    } catch (err) {
      setError(err.message || 'The team did not load');
    }
  }
  useEffect(() => { load(); }, []);

  async function act(fn, ok) {
    setBusy(true);
    try {
      const out = await fn();
      if (ok) addToast(ok, 'success');
      await load();
      return out;
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function add(e) {
    e.preventDefault();
    const body = form.role === 'agent' ? { role: 'agent', name: form.name } : { role: form.role, email: form.email, name: form.name || undefined };
    const out = await act(() => adminFetch('/admin/admins', { method: 'POST', body }, token), `${form.role === 'agent' ? form.name : form.email} added`);
    if (out) setForm(f => ({ ...f, email: '', name: '' }));
  }

  async function makeKey(a) {
    const out = await act(() => adminFetch(`/admin/admins/${a.id}/keys`, { method: 'POST' }, token));
    if (out?.key) setNewKey({ ...out, name: a.name });
  }

  function revoke(k) {
    if (!confirm(`Revoke key ${k.prefix}…? Anything using it stops working within 30 seconds.`)) return;
    act(() => adminFetch(`/admin/admin-keys/${k.id}`, { method: 'DELETE' }, token), 'Key revoked');
  }

  function toggle(a) {
    if (a.active && !confirm(`Switch off ${a.email ?? a.name}? They're signed out within 30 seconds.`)) return;
    act(() => adminFetch(`/admin/admins/${a.id}`, { method: 'PATCH', body: { active: !a.active } }, token), a.active ? 'Switched off' : 'Switched on');
  }

  if (me?.role !== 'owner') return <p className="py-12 text-center text-gray-400">Only owners manage the team.</p>;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5">
        <div>
          <h2 className="text-lg font-bold text-[#1A1A2E]">Team</h2>
          <p className="text-sm text-gray-600">
            People sign in with Google using the email listed here. Agents use an API key.
            Everything either does is in the Audit log. The admin token always signs in as an owner, so nobody gets locked out.
          </p>
        </div>
        <form onSubmit={add} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
            Role
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900">
              <option value="owner">Owner (everything)</option>
              <option value="moderator">Moderator</option>
              <option value="agent">Agent (API key)</option>
            </select>
          </label>
          {form.role !== 'agent' && (
            <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
              Google email
              <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                     className="w-64 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900" />
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
            Name{form.role !== 'agent' && ' (optional)'}
            <input required={form.role === 'agent'} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                   placeholder={form.role === 'agent' ? 'Operating agent' : ''}
                   className="w-52 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900" />
          </label>
          <Btn type="submit" variant="primary" disabled={busy}>Add</Btn>
        </form>
        <p className="text-xs text-gray-500">Moderators can do everything except manage the team for now; their narrower rights come with player safety (Phase 2).</p>
      </section>

      {newKey && <NewKey created={newKey} onDone={() => setNewKey(null)} />}
      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!admins && !error && <Spinner />}

      {admins && (
        <div className="overflow-x-auto rounded-xl border border-[#E0E0E0] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E0E0E0] bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                {['Who', 'Role', 'Last seen', 'Keys', ''].map(h => <th key={h} className="px-4 py-3">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {admins.map(a => (
                <tr key={a.id} className={`border-b border-gray-100 align-top ${a.active ? '' : 'opacity-50'}`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#1A1A2E]">{a.name}</div>
                    {a.email && a.email !== a.name && <div className="text-xs text-gray-500">{a.email}</div>}
                    {!a.active && <div className="text-xs font-semibold text-red-600">switched off</div>}
                  </td>
                  <td className="px-4 py-3"><Badge color={ROLE_BADGE[a.role]}>{a.role}</Badge></td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500" title={fmtWhen(a.last_seen_at)}>{a.last_seen_at ? timeAgo(a.last_seen_at) : 'never'}</td>
                  <td className="px-4 py-3">
                    {a.role === 'agent' ? (
                      <div className="flex flex-col gap-1.5">
                        {a.keys.map(k => (
                          <div key={k.id} className="flex items-center gap-2 text-xs">
                            <code className={k.revoked_at ? 'text-gray-400 line-through' : 'text-gray-700'}>{k.prefix}…</code>
                            <span className="text-gray-400">{k.revoked_at ? 'revoked' : k.last_used_at ? `used ${timeAgo(k.last_used_at)}` : 'never used'}</span>
                            {!k.revoked_at && <button type="button" onClick={() => revoke(k)} className="font-semibold text-red-600 hover:underline">Revoke</button>}
                          </div>
                        ))}
                        <div><Btn variant="primary" disabled={busy || !a.active} onClick={() => makeKey(a)}>New key</Btn></div>
                      </div>
                    ) : <span className="text-xs text-gray-400">Google sign-in</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {a.id !== me?.id && (
                      <Btn variant={a.active ? 'danger' : 'success'} disabled={busy} onClick={() => toggle(a)}>{a.active ? 'Switch off' : 'Switch on'}</Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {admins.length === 0 && <p className="py-8 text-center text-gray-400">Nobody yet. Add your own Google email first, then sign in with it.</p>}
        </div>
      )}
    </div>
  );
}
