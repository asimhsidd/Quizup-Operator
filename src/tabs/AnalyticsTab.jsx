import { useEffect, useState } from 'react';
import { useToastStore } from '../lib/toastStore';
import { RefreshCw } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { adminFetch, Btn, Spinner } from '../lib/adminUtils.jsx';

// ── Analytics helpers ─────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, dot }) {
  return (
    <div className="bg-white border border-[#E0E0E0] shadow-sm rounded-xl p-4">
      <div className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1 flex items-center gap-1.5">
        {dot && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />}
        {label}
      </div>
      <div className={`font-extrabold text-2xl ${accent || 'text-[#1A1A2E]'}`}>{value ?? '—'}</div>
      {sub && <div className="text-gray-400 text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <h3 className="text-[#1A1A2E] font-bold text-base mb-3 pt-2 border-t border-[#E8E8E8]">{children}</h3>
  );
}

const CHART_TOOLTIP_STYLE = {
  contentStyle: { background: '#fff', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#1A1A2E', fontWeight: 600 },
};

function RetentionBadge({ label, value, thresholdGood, thresholdOk }) {
  const v = parseFloat(value ?? 0);
  const color = v >= thresholdGood ? 'text-green-600' : v >= thresholdOk ? 'text-amber-500' : 'text-red-500';
  return (
    <div className="bg-white border border-[#E0E0E0] shadow-sm rounded-xl p-4 text-center">
      <div className={`font-extrabold text-3xl ${color}`}>{v.toFixed(1)}%</div>
      <div className="text-gray-500 text-xs font-semibold mt-1">{label}</div>
    </div>
  );
}

// ── Tab: Analytics (includes Live Sessions) ───────────────────────────────────
export default function AnalyticsTab({ token }) {
  const [data, setData] = useState({
    overview: null, retention: null, engagement: null, growth: null, costs: null, sessions: [], systemStats: null,
  });
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [elapsed, setElapsed] = useState('');
  const [flushing, setFlushing] = useState(false);
  const [flushConfirm, setFlushConfirm] = useState(false);
  const { addToast } = useToastStore();

  async function handleFlush() {
    if (!flushConfirm) { setFlushConfirm(true); setTimeout(() => setFlushConfirm(false), 4000); return; }
    setFlushing(true);
    setFlushConfirm(false);
    try {
      await adminFetch('/admin/analytics/flush', { method: 'DELETE' }, token);
      addToast('Analytics flushed', 'success');
      fetchAll();
    } catch (err) {
      addToast('Flush failed: ' + err.message, 'error');
    } finally {
      setFlushing(false);
    }
  }

  async function fetchAll() {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        adminFetch('/admin/analytics/overview',     {}, token),
        adminFetch('/admin/analytics/retention',    {}, token),
        adminFetch('/admin/analytics/engagement',   {}, token),
        adminFetch('/admin/analytics/growth',       {}, token),
        adminFetch('/admin/analytics/costs',        {}, token),
        adminFetch('/admin/active-sessions',        {}, token),
        adminFetch('/admin/analytics/system-stats', {}, token),
      ]);
      setData({
        overview:    results[0].status === 'fulfilled' ? results[0].value : null,
        retention:   results[1].status === 'fulfilled' ? results[1].value : null,
        engagement:  results[2].status === 'fulfilled' ? results[2].value : null,
        growth:      results[3].status === 'fulfilled' ? results[3].value : null,
        costs:       results[4].status === 'fulfilled' ? results[4].value : null,
        sessions:    results[5].status === 'fulfilled' ? results[5].value : [],
        systemStats: results[6].status === 'fulfilled' ? results[6].value : null,
      });
      setLastRefreshed(new Date());
    } catch (err) {
      addToast('Analytics fetch failed: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (!lastRefreshed) return;
    function tick() {
      const s = Math.round((Date.now() - lastRefreshed.getTime()) / 1000);
      if (s < 60)   setElapsed(`${s}s ago`);
      else if (s < 3600) setElapsed(`${Math.floor(s / 60)}m ago`);
      else          setElapsed(`${Math.floor(s / 3600)}h ago`);
    }
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [lastRefreshed]);

  const { overview: ov, retention: ret, engagement: eng, growth, costs, sessions, systemStats: sys } = data;

  const PIE_COLORS = ['#E8453C', '#07A2AA'];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[#1A1A2E] font-bold text-lg">Analytics</h2>
          {lastRefreshed && (
            <p className="text-gray-400 text-xs mt-0.5">Last updated: {elapsed}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Btn
            onClick={handleFlush}
            disabled={flushing}
            variant="ghost"
            style={{ color: flushConfirm ? '#DC2626' : undefined, borderColor: flushConfirm ? '#DC2626' : undefined }}
          >
            {flushing ? 'Flushing…' : flushConfirm ? '⚠ Confirm flush?' : 'Flush All'}
          </Btn>
          <Btn onClick={fetchAll} variant="primary" disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Loading…' : 'Refresh'}
          </Btn>
        </div>
      </div>

      {loading && !lastRefreshed ? (
        <Spinner />
      ) : (
        <>
          {/* ── Section 1: Overview ─────────────────────────────────────────── */}
          <SectionHeading>Overview</SectionHeading>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard label="Currently Online" value={ov?.currently_online ?? 0}
              accent="text-green-600" dot />
            <StatCard label="Active Today"     value={ov?.active_today ?? 0} />
            <StatCard label="Active This Week" value={ov?.active_this_week ?? 0} />
            <StatCard label="Active This Month" value={ov?.active_this_month ?? 0} />
            <StatCard label="New Users Today"  value={ov?.new_users_today ?? 0} accent="text-[#E8453C]" />
            <StatCard label="New This Week"    value={ov?.new_users_this_week ?? 0} />
            <StatCard label="Matches Today"    value={ov?.matches_today ?? 0} accent="text-cyan-600" />
            <StatCard label="Total Matches"    value={ov?.total_matches ?? 0}
              sub={`${ov?.total_users ?? 0} users`} />
          </div>

          {/* ── Section 2: Growth Charts ────────────────────────────────────── */}
          <SectionHeading>Growth (last 30 days)</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Registrations */}
            <div className="bg-white border border-[#E0E0E0] shadow-sm rounded-xl p-4">
              <div className="text-[#1A1A2E] font-semibold text-sm mb-3">Registrations / Day</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={growth?.registrations_by_day ?? []}
                  margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    tickFormatter={d => d?.slice(5)} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} allowDecimals={false} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="count" stroke="#E8453C" strokeWidth={2}
                    dot={false} name="Registrations" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Matches */}
            <div className="bg-white border border-[#E0E0E0] shadow-sm rounded-xl p-4">
              <div className="text-[#1A1A2E] font-semibold text-sm mb-3">Matches / Day</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={growth?.matches_by_day ?? []}
                  margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    tickFormatter={d => d?.slice(5)} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} allowDecimals={false} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="count" stroke="#07A2AA" strokeWidth={2}
                    dot={false} name="Matches" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Section 3: Retention & Engagement ──────────────────────────── */}
          <SectionHeading>Retention & Engagement</SectionHeading>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Left: retention rates + churn */}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-3">
                <RetentionBadge label="Day 1" value={ret?.day1_retention}  thresholdGood={40} thresholdOk={20} />
                <RetentionBadge label="Day 7" value={ret?.day7_retention}  thresholdGood={20} thresholdOk={10} />
                <RetentionBadge label="Day 30" value={ret?.day30_retention} thresholdGood={10} thresholdOk={5} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-[#E0E0E0] shadow-sm rounded-xl p-4">
                  <div className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">7-day Churn</div>
                  <div className="font-extrabold text-2xl text-amber-500">{ret?.churn_7d ?? 0}%</div>
                </div>
                <div className="bg-white border border-[#E0E0E0] shadow-sm rounded-xl p-4">
                  <div className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">14-day Churn</div>
                  <div className="font-extrabold text-2xl text-amber-500">{ret?.churn_14d ?? 0}%</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Avg Sessions / User / Day" value={ret?.avg_sessions_per_user_per_day ?? 0} />
                <StatCard label="Avg Matches / Session"     value={ret?.avg_matches_per_session ?? 0} />
              </div>
            </div>

            {/* Right: solo vs pvp pie */}
            <div className="bg-white border border-[#E0E0E0] shadow-sm rounded-xl p-4">
              <div className="text-[#1A1A2E] font-semibold text-sm mb-3">Solo vs PvP (all time)</div>
              {(eng?.solo_vs_pvp?.solo_count ?? 0) + (eng?.solo_vs_pvp?.pvp_count ?? 0) === 0 ? (
                <div className="text-center text-gray-400 text-sm py-8">No matches yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: `Solo (${eng?.solo_vs_pvp?.solo_pct ?? 0}%)`, value: eng?.solo_vs_pvp?.solo_count ?? 0 },
                        { name: `PvP (${eng?.solo_vs_pvp?.pvp_pct ?? 0}%)`,  value: eng?.solo_vs_pvp?.pvp_count  ?? 0 },
                      ]}
                      cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      dataKey="value" label={false}
                    >
                      {PIE_COLORS.map((color, i) => <Cell key={i} fill={color} />)}
                    </Pie>
                    <Tooltip {...CHART_TOOLTIP_STYLE} />
                    <Legend iconType="circle" iconSize={8}
                      formatter={v => <span style={{ fontSize: 12, color: '#6B7280' }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top Topics horizontal bar */}
          {(eng?.top_topics?.length ?? 0) > 0 && (
            <div className="bg-white border border-[#E0E0E0] shadow-sm rounded-xl p-4 mb-6">
              <div className="text-[#1A1A2E] font-semibold text-sm mb-3">Top 10 Topics by Matches</div>
              <ResponsiveContainer width="100%" height={Math.max(180, (eng.top_topics.length) * 28)}>
                <BarChart data={[...eng.top_topics].reverse()} layout="vertical"
                  margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#9CA3AF' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="topic_name" width={110}
                    tick={{ fontSize: 11, fill: '#374151' }} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} />
                  <Bar dataKey="match_count" fill="#07A2AA" radius={[0, 4, 4, 0]} name="Matches" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Section 4: Costs ─────────────────────────────────────────────── */}
          <SectionHeading>AI Costs</SectionHeading>
          <div className="bg-white border border-[#E0E0E0] shadow-sm rounded-xl overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E0E0E0] bg-gray-50">
                    {['Period', 'Cost (USD)', 'Questions', 'Custom Requests'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      period: 'Today',
                      cost: costs?.ai_cost_today,
                      q: costs?.questions_generated_today,
                      req: costs?.custom_topic_requests_today,
                      warn: (costs?.ai_cost_today ?? 0) >= 1,
                    },
                    { period: 'This Week',  cost: costs?.ai_cost_this_week,  q: null, req: costs?.custom_topic_requests_this_week },
                    { period: 'This Month', cost: costs?.ai_cost_this_month, q: null, req: null },
                    { period: 'All Time',   cost: costs?.ai_cost_total,      q: costs?.questions_generated_total, req: null },
                  ].map(({ period, cost, q, req, warn }) => (
                    <tr key={period} className={`border-b border-gray-100 ${warn ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3 font-semibold text-[#1A1A2E]">{period}</td>
                      <td className={`px-4 py-3 font-mono ${warn ? 'text-red-600 font-bold' : 'text-amber-600'}`}>
                        ${(cost ?? 0).toFixed(4)}
                        {warn && <span className="ml-1 text-xs">⚠</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{q != null ? q : '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{req != null ? req : '—'}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs" colSpan={2}>
                      Cost per question: <span className="font-mono font-semibold text-[#1A1A2E]">
                        ${(costs?.cost_per_question ?? 0).toFixed(5)}
                      </span>
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Section 5: Live Sessions ─────────────────────────────────────── */}
          <SectionHeading>Live Sessions ({sessions.length})</SectionHeading>
          {sessions.length === 0 ? (
            <div className="text-center text-gray-400 py-8 bg-white border border-[#E0E0E0] rounded-xl">
              <div className="text-3xl mb-2">🎮</div>
              <div className="text-sm">No active games right now.</div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {sessions.map(s => (
                <div key={s.gameId} className="bg-white border border-[#E0E0E0] shadow-sm rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[#1A1A2E] font-bold truncate mr-2">{s.topicName}</span>
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-100 text-cyan-700">Round {s.currentRound + 1}</span>
                  </div>
                  <div className="flex gap-3">
                    {s.players.map(p => (
                      <div key={p.userId} className="flex-1 bg-gray-50 border border-[#E0E0E0] rounded-lg p-3">
                        <div className="text-[#1A1A2E] text-sm font-semibold truncate">{p.username}</div>
                        <div className="text-cyan-600 font-extrabold text-lg">{p.score}</div>
                        <div className="text-gray-400 text-xs">pts</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-gray-400 text-xs font-mono truncate">{s.gameId}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Section 6: System Stats ──────────────────────────────────────── */}
          <SectionHeading className="mt-6">System</SectionHeading>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

            {/* PostgreSQL */}
            <div className="bg-white border border-[#E0E0E0] shadow-sm rounded-xl overflow-hidden">
              <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                <span className="text-[#1A1A2E] font-semibold text-sm">PostgreSQL</span>
                {sys?.postgres?.total_size && (
                  <span className="ml-auto text-xs font-mono bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                    {sys.postgres.total_size} total
                  </span>
                )}
              </div>
              {sys?.postgres?.tables?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-t border-b border-[#E0E0E0] bg-gray-50">
                        <th className="text-left px-4 py-2 text-gray-500 font-semibold uppercase tracking-wide">Table</th>
                        <th className="text-right px-4 py-2 text-gray-500 font-semibold uppercase tracking-wide">Size</th>
                        <th className="text-right px-4 py-2 text-gray-500 font-semibold uppercase tracking-wide">~Rows</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sys.postgres.tables.map((t, i) => (
                        <tr key={t.table_name} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                          <td className="px-4 py-1.5 font-mono text-[#1A1A2E]">{t.table_name}</td>
                          <td className="px-4 py-1.5 text-right font-mono text-amber-600">{t.total_size}</td>
                          <td className="px-4 py-1.5 text-right text-gray-500">
                            {t.estimated_rows > 0 ? t.estimated_rows.toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-gray-400 text-sm py-6">No data</div>
              )}
            </div>

            {/* Redis */}
            <div className="bg-white border border-[#E0E0E0] shadow-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[#1A1A2E] font-semibold text-sm">Redis</span>
                {sys?.redis?.version && (
                  <span className="text-xs text-gray-400">v{sys.redis.version}</span>
                )}
              </div>
              {sys?.redis ? (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Memory Used',    value: sys.redis.used_memory_human  ?? '—' },
                    { label: 'Peak Memory',    value: sys.redis.peak_memory_human  ?? '—' },
                    { label: 'Total Keys',     value: sys.redis.total_keys != null ? sys.redis.total_keys.toLocaleString() : '—' },
                    { label: 'Clients',        value: sys.redis.connected_clients  ?? '—' },
                    { label: 'Uptime',         value: sys.redis.uptime_days != null ? `${sys.redis.uptime_days}d` : '—' },
                    {
                      label: 'Hit Rate',
                      value: (() => {
                        const h = sys.redis.keyspace_hits ?? 0;
                        const m = sys.redis.keyspace_misses ?? 0;
                        return h + m > 0 ? `${Math.round(100 * h / (h + m))}%` : '—';
                      })(),
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 border border-[#E0E0E0] rounded-lg px-3 py-2">
                      <div className="text-gray-500 text-xs uppercase tracking-wide">{label}</div>
                      <div className="font-mono font-semibold text-[#1A1A2E] text-sm mt-0.5">{value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-400 text-sm py-6">No data</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
