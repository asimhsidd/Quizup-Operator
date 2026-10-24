// Economy: coins, Play purchases, KWIZ+, rewarded ads and KWIZ Live over a window, the
// refunds list, and the fraud signals (Quizup lib/economy.js). Units only: Play sets and
// localises prices, so money is in Play Console. Bots and test purchases are left out.
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { adminFetch, Badge, Btn, Paginator, Spinner, fmtWhen, timeAgo } from '../lib/adminUtils.jsx';
import { usePlayerStore } from '../store/playerStore';

const CHART_TOOLTIP_STYLE = {
  contentStyle: { background: '#fff', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#1A1A2E', fontWeight: 600 },
};

const n = v => Number(v ?? 0).toLocaleString();
const day = d => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-[#E0E0E0] shadow-sm rounded-xl p-4">
      <div className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">{label}</div>
      <div className="font-extrabold text-2xl text-[#1A1A2E]">{value ?? '—'}</div>
      {sub && <div className="text-gray-400 text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

function SectionHeading({ children, right }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2 border-t border-[#E8E8E8] pt-2">
      <h3 className="text-[#1A1A2E] font-bold text-base">{children}</h3>
      {right}
    </div>
  );
}

function Table({ cols, rows, empty }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E0E0E0] bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#E0E0E0] bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
            {cols.map(c => <th key={c} className="px-4 py-2.5">{c}</th>)}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
      {(!rows || rows.length === 0) && <p className="py-6 text-center text-sm text-gray-400">{empty}</p>}
    </div>
  );
}

const SIGNALS = {
  referralFarms:    { title: 'Referral farms', hint: '3+ rewarded invites in 7 days whose invitees average under 5 games.',
                      line: r => `${r.invites} invites, invitees average ${r.invitee_avg_games} games (${r.invitees_barely_played} played ≤ 2)` },
  adFarming:        { title: 'Ad farming', hint: 'At the coin-ad cap on 5 or more of the last 7 days.',
                      line: r => `at the cap ${r.capped_days} of 7 days, ${r.ads} coin ads` },
  refundAfterSpend: { title: 'Refunds after spending', hint: 'Coin packs refunded in the last 30 days after some coins were spent.',
                      line: r => `${r.product_id}: ${r.shortfall} of ${r.coins_granted} coins couldn't be taken back` },
  fastCoins:        { title: 'Fast coins', hint: 'Earned (outside purchases and the operator) over 3× the 99th percentile in 7 days.',
                      line: r => `${n(r.coins)} coins in 7 days (99th percentile ${n(r.p99)})` },
};

function Signals({ token }) {
  const openPlayer = usePlayerStore(s => s.openPlayer);
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    adminFetch('/admin/economy/signals', {}, token).then(setS).catch(err => setError(err.message));
  }, []);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!s) return <Spinner />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Object.entries(SIGNALS).map(([key, meta]) => (
        <div key={key} className="rounded-xl border border-[#E0E0E0] bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-bold text-[#1A1A2E]">{meta.title}</h4>
            <Badge color={s[key].length ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'}>{s[key].length || 'none'}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">{meta.hint}</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {s[key].map(r => (
              <li key={`${r.user_id}${r.order_id ?? ''}`} className="flex flex-wrap gap-x-2">
                <button type="button" onClick={() => openPlayer(r.user_id)} className="font-semibold text-[#1A1A2E] hover:underline">{r.username}</button>
                <span className="text-gray-600">{meta.line(r)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Refunds({ token }) {
  const openPlayer = usePlayerStore(s => s.openPlayer);
  const [state, setState] = useState('refunded');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  useEffect(() => {
    adminFetch(`/admin/economy/purchases?state=${state}&limit=50&offset=${page * 50}`, {}, token).then(setData).catch(() => setData({ purchases: [], total: 0 }));
  }, [state, page]);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {[['refunded', 'Refunded'], ['all', 'All purchases']].map(([s, label]) => (
          <button key={s} type="button" onClick={() => { setState(s); setPage(0); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${state === s ? 'bg-[#E8453C] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{label}</button>
        ))}
      </div>
      {!data ? <Spinner /> : (
        <>
          <Table
            cols={['When', 'Player', 'Product', 'Order', 'State', 'Coins', 'Taken back']}
            empty={state === 'refunded' ? 'No refunds.' : 'No purchases yet.'}
            rows={data.purchases.map(p => (
              <tr key={`${p.order_id}${p.created_at}`} className="border-b border-gray-100">
                <td className="px-4 py-2 text-xs text-gray-500" title={fmtWhen(p.refunded_at ?? p.created_at)}>{timeAgo(p.refunded_at ?? p.created_at)}</td>
                <td className="px-4 py-2">{p.user_id ? <button type="button" onClick={() => openPlayer(p.user_id)} className="hover:underline">{p.username}</button> : '—'}</td>
                <td className="px-4 py-2 font-mono text-xs">{p.product_id}</td>
                <td className="px-4 py-2 font-mono text-xs text-gray-500">{p.order_id ?? '—'}</td>
                <td className="px-4 py-2">
                  <Badge color={p.state === 'refunded' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>{p.state}</Badge>
                  {p.test && <Badge color="bg-gray-100 text-gray-500">test</Badge>}
                </td>
                <td className="px-4 py-2 tabular-nums">{n(p.coins_granted)}</td>
                <td className={`px-4 py-2 tabular-nums ${p.state === 'refunded' && (p.taken_back ?? 0) < p.coins_granted ? 'font-bold text-red-600' : ''}`}>
                  {p.state === 'refunded' ? n(p.taken_back) : '—'}
                </td>
              </tr>
            ))}
          />
          <Paginator page={page} total={data.total} limit={50} onPage={setPage} />
        </>
      )}
    </div>
  );
}

export default function EconomyTab({ token }) {
  const [days, setDays] = useState(30);
  const [o, setO] = useState(null);
  const [error, setError] = useState('');

  async function load(d = days) {
    try { setO(await adminFetch(`/admin/economy/overview?days=${d}`, {}, token)); setError(''); }
    catch (err) { setError(err.message); }
  }
  useEffect(() => { load(days); }, [days]);

  const c = o?.coins.circulation;
  const minted = o?.coins.families.reduce((a, f) => a + f.minted, 0) ?? 0;
  const burned = o?.coins.families.reduce((a, f) => a + f.burned, 0) ?? 0;
  const activePlus = o?.subscriptions.active.reduce((a, s) => a + s.active, 0) ?? 0;
  const units = o?.purchases.products.reduce((a, p) => a + p.units, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[#1A1A2E] font-bold text-lg">Economy</h2>
          <p className="text-xs text-gray-500">Units, not money: Play sets and localises prices, so revenue in money is in Play Console. Bots and test purchases are left out.</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map(d => (
            <button key={d} type="button" onClick={() => setDays(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${days === d ? 'bg-[#E8453C] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{d} days</button>
          ))}
          <Btn variant="ghost" onClick={() => load()}>Refresh</Btn>
        </div>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!o && !error && <Spinner />}

      {o && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Coins held by players" value={n(c.total)} sub={`${n(c.holders)} holders · median ${n(c.median)} · top ${n(c.max)}`} />
            <StatCard label={`Coins in / out (${days}d)`} value={`${n(minted)} / ${n(burned)}`} sub={minted >= burned ? `${n(minted - burned)} more coins in play` : `${n(burned - minted)} fewer coins in play`} />
            <StatCard label={`Play purchases (${days}d)`} value={n(units)} sub={o.purchases.testPurchases ? `plus ${o.purchases.testPurchases} test purchases` : 'units sold'} />
            <StatCard label="KWIZ+ now" value={n(activePlus)} sub={`${o.subscriptions.flow.started} started, ${o.subscriptions.flow.ended} ended in ${days}d (Play)`} />
          </div>

          <div>
            <SectionHeading>Coins in and out each day</SectionHeading>
            <div className="h-56 rounded-xl border border-[#E0E0E0] bg-white p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={o.coins.daily.map(r => ({ ...r, day: day(r.day) }))} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6B7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} width={48} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="minted" name="Coins in" fill="#16A34A" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="burned" name="Coins out" fill="#E8453C" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div>
              <SectionHeading>Where coins come from and go</SectionHeading>
              <Table
                cols={['Family', 'In', 'Out', 'Players']}
                empty="No coin changes in this window."
                rows={o.coins.families.map(f => (
                  <tr key={f.family} className="border-b border-gray-100">
                    <td className="px-4 py-2 font-semibold text-[#1A1A2E]">{f.family}</td>
                    <td className="px-4 py-2 tabular-nums text-green-700">{f.minted ? n(f.minted) : ''}</td>
                    <td className="px-4 py-2 tabular-nums text-red-600">{f.burned ? n(f.burned) : ''}</td>
                    <td className="px-4 py-2 tabular-nums text-gray-500">{n(f.players)}</td>
                  </tr>
                ))}
              />
            </div>
            <div className="flex flex-col gap-6">
              <div>
                <SectionHeading>Play products</SectionHeading>
                <Table
                  cols={['SKU', 'Units', 'Buyers', 'Coins granted', 'Refunded']}
                  empty="No purchases in this window."
                  rows={o.purchases.products.map(p => (
                    <tr key={p.product_id} className="border-b border-gray-100">
                      <td className="px-4 py-2 font-mono text-xs">{p.product_id}</td>
                      <td className="px-4 py-2 tabular-nums font-semibold">{n(p.units)}</td>
                      <td className="px-4 py-2 tabular-nums">{n(p.buyers)}</td>
                      <td className="px-4 py-2 tabular-nums">{n(p.coins)}</td>
                      <td className={`px-4 py-2 tabular-nums ${p.refunded ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>{n(p.refunded)}</td>
                    </tr>
                  ))}
                />
              </div>
              <div>
                <SectionHeading>KWIZ+ in force</SectionHeading>
                <Table
                  cols={['Source', 'Plan', 'Active', 'Not renewing', 'In grace']}
                  empty="Nobody has KWIZ+."
                  rows={o.subscriptions.active.map(s => (
                    <tr key={`${s.source}${s.plan}`} className="border-b border-gray-100">
                      <td className="px-4 py-2">{s.source}</td>
                      <td className="px-4 py-2">{s.plan}</td>
                      <td className="px-4 py-2 tabular-nums font-semibold">{n(s.active)}</td>
                      <td className="px-4 py-2 tabular-nums">{n(s.not_renewing)}</td>
                      <td className="px-4 py-2 tabular-nums">{n(s.in_grace)}</td>
                    </tr>
                  ))}
                />
                {o.subscriptions.flow.revoked > 0 && <p className="mt-1 text-xs text-red-600">{o.subscriptions.flow.revoked} revoked by Play in this window.</p>}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div>
              <SectionHeading>Rewarded ads</SectionHeading>
              <Table
                cols={['Kind', 'Ads', 'Players', 'Coins paid']}
                empty="No ads watched in this window."
                rows={o.ads.kinds.map(a => (
                  <tr key={a.kind} className="border-b border-gray-100">
                    <td className="px-4 py-2">{a.kind}</td>
                    <td className="px-4 py-2 tabular-nums font-semibold">{n(a.ads)}</td>
                    <td className="px-4 py-2 tabular-nums">{n(a.players)}</td>
                    <td className="px-4 py-2 tabular-nums">{n(a.coins)}</td>
                  </tr>
                ))}
              />
              <p className="mt-1 text-xs text-gray-500">{n(o.ads.capHitPlayerDays)} times a player reached the daily coin-ad cap.</p>
            </div>
            <div>
              <SectionHeading>KWIZ Live</SectionHeading>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Events finished" value={n(o.live.events)} sub={`${n(o.live.entries)} entries`} />
                <StatCard label="Prize XP paid" value={n(o.live.prize_xp)} />
                <StatCard label="Lives bought with coins" value={n(o.live.bought_lives)} />
                <StatCard label="Lives from ads" value={n(o.live.ad_lives)} />
              </div>
            </div>
          </div>
        </>
      )}

      <div>
        <SectionHeading>Signals</SectionHeading>
        <p className="-mt-2 mb-3 text-xs text-gray-500">Worked out live here; a daily job also puts each one in the Inbox.</p>
        <Signals token={token} />
      </div>

      <div>
        <SectionHeading>Purchases and refunds</SectionHeading>
        <Refunds token={token} />
      </div>
    </div>
  );
}
