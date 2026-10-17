// Users → Wallet: one player's coins and KWIZ+. The ledger (every coin change and why),
// KWIZ+ rows (Play subscriptions and operator grants), Play purchases, and the
// operator's tools: give or take coins, grant or end KWIZ+. All need a note.
// API: GET /admin/users/:id/wallet, POST …/coins, POST/DELETE …/plus.
import { useEffect, useState } from 'react';
import { adminFetch, Badge, Btn, Spinner } from '../lib/adminUtils.jsx';
import { useToastStore } from '../lib/toastStore';

const fmt = d => (d ? new Date(d).toLocaleString() : '—');

export default function WalletPanel({ userId, token, onChanged }) {
  const [data, setData] = useState(null);
  const [delta, setDelta] = useState('');
  const [days, setDays] = useState('30');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const { addToast } = useToastStore();

  async function load() {
    try { setData(await adminFetch(`/admin/users/${userId}/wallet`, {}, token)); }
    catch (err) { addToast(err.message, 'error'); }
  }
  useEffect(() => { load(); }, [userId]);

  async function act(fn, ok) {
    if (!note.trim()) { addToast('Add a note: why?', 'error'); return; }
    setBusy(true);
    try { await fn(); addToast(ok, 'success'); setDelta(''); await load(); onChanged?.(); }
    catch (err) { addToast(err.message, 'error'); }
    setBusy(false);
  }

  if (!data) return <Spinner />;
  const plus = data.plus;
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-bold text-[#1A1A2E]">{data.user.coins.toLocaleString()} coins</span>
        {plus?.active
          ? <Badge color="bg-pink-100 text-pink-700">KWIZ+ ({plus.source}) until {fmt(plus.expiresAt)}</Badge>
          : <Badge color="bg-gray-100 text-gray-600">No KWIZ+</Badge>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (required): why"
               className="border border-[#E0E0E0] rounded px-2 py-1 flex-1 min-w-48" />
        <input type="number" value={delta} onChange={e => setDelta(e.target.value)} placeholder="± coins"
               className="border border-[#E0E0E0] rounded px-2 py-1 w-28" />
        <Btn variant="primary" disabled={busy || !parseInt(delta, 10)}
             onClick={() => act(() => adminFetch(`/admin/users/${userId}/coins`, { method: 'POST', body: { delta: parseInt(delta, 10), note } }, token),
               `${parseInt(delta, 10) > 0 ? 'Gave' : 'Took'} ${Math.abs(parseInt(delta, 10))} coins`)}>
          Apply coins
        </Btn>
        <input type="number" value={days} onChange={e => setDays(e.target.value)} min="1"
               className="border border-[#E0E0E0] rounded px-2 py-1 w-20" />
        <Btn variant="success" disabled={busy}
             onClick={() => act(() => adminFetch(`/admin/users/${userId}/plus`, { method: 'POST', body: { days: parseInt(days, 10), note } }, token), `KWIZ+ for ${days} days`)}>
          Grant KWIZ+ (days)
        </Btn>
        <Btn variant="danger" disabled={busy}
             onClick={() => act(() => adminFetch(`/admin/users/${userId}/plus`, { method: 'DELETE' }, token), 'Operator KWIZ+ ended')}>
          End operator KWIZ+
        </Btn>
      </div>
      <p className="text-xs text-gray-500">Taking coins never goes below 0. Ending KWIZ+ only ends operator grants: a Play subscription is cancelled or refunded in Play Console.</p>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold text-[#1A1A2E] mb-1">Coin ledger</h4>
          <div className="max-h-64 overflow-y-auto border border-gray-100 rounded">
            <table className="w-full text-xs">
              <tbody>
                {data.ledger.map(e => (
                  <tr key={e.id} className="border-b border-gray-50">
                    <td className="px-2 py-1 text-gray-400 whitespace-nowrap">{fmt(e.created_at)}</td>
                    <td className="px-2 py-1">{e.reason}{e.ref ? <span className="text-gray-400"> · {String(e.ref).slice(0, 40)}</span> : null}</td>
                    <td className={`px-2 py-1 text-right font-bold ${e.delta < 0 ? 'text-red-600' : 'text-green-600'}`}>{e.delta > 0 ? '+' : ''}{e.delta}</td>
                    <td className="px-2 py-1 text-right text-gray-500">{e.balance_after}</td>
                  </tr>
                ))}
                {!data.ledger.length && <tr><td className="px-2 py-2 text-gray-400">No coin changes yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <h4 className="font-semibold text-[#1A1A2E] mb-1">KWIZ+ history</h4>
            {data.subscriptions.map(s => (
              <p key={s.id} className="text-xs">
                <Badge color={s.source === 'play' ? 'bg-cyan-100 text-cyan-700' : 'bg-purple-100 text-purple-700'}>{s.source}</Badge>{' '}
                {s.state} · {s.base_plan_id ?? ''} · until {fmt(s.expires_at)}{s.note ? ` · ${s.note}` : ''}
              </p>
            ))}
            {!data.subscriptions.length && <p className="text-xs text-gray-400">Never had KWIZ+.</p>}
          </div>
          <div>
            <h4 className="font-semibold text-[#1A1A2E] mb-1">Play purchases</h4>
            {data.purchases.map(p => (
              <p key={p.order_id ?? p.created_at} className="text-xs">
                {fmt(p.created_at)} · {p.product_id} · {p.state}{p.coins_granted ? ` · ${p.coins_granted} coins` : ''}{p.order_id ? ` · ${p.order_id}` : ''}
              </p>
            ))}
            {!data.purchases.length && <p className="text-xs text-gray-400">No purchases.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
