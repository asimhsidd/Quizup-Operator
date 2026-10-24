// Audit log: every change made through the admin API, by a person or an agent
// (Quizup lib/adminAudit.js). Refused calls are listed too, with their status.
import { Fragment, useEffect, useState } from 'react';
import { adminFetch, Badge, Btn, Paginator, Spinner, fmtWhen, timeAgo } from '../lib/adminUtils.jsx';

const LIMIT = 50;

const ROLE_BADGE = {
  owner:     'bg-gray-900 text-white',
  moderator: 'bg-cyan-100 text-cyan-700',
  agent:     'bg-purple-100 text-purple-700',
};

function Json({ label, value }) {
  if (value == null) return null;
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</div>
      <pre className="max-h-56 overflow-auto rounded-lg bg-gray-50 p-2 text-xs text-gray-700 whitespace-pre-wrap break-words">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

export default function AuditTab({ token }) {
  const [filters, setFilters] = useState({ actor: '', action: '', target_id: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  async function load(f = applied, p = page) {
    try {
      const qs = new URLSearchParams({ limit: LIMIT, offset: p * LIMIT });
      for (const [k, v] of Object.entries(f)) if (v.trim()) qs.set(k, v.trim());
      setData(await adminFetch(`/admin/audit?${qs}`, {}, token));
      setError('');
    } catch (err) {
      setError(err.message || 'The audit log did not load');
    }
  }

  useEffect(() => { load(applied, page); }, [applied, page]);

  function apply(e) {
    e.preventDefault();
    setPage(0);
    setApplied({ ...filters });
  }

  const input = (key, placeholder) => (
    <input
      value={filters[key]}
      onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}
      placeholder={placeholder}
      className="w-44 rounded-lg border border-[#E0E0E0] bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#E8453C]"
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#1A1A2E]">
          Audit log{data && <span className="text-gray-400 font-semibold"> ({data.total.toLocaleString()})</span>}
        </h2>
        <form onSubmit={apply} className="flex flex-wrap items-center gap-2">
          {input('actor', 'Who (email, agent)')}
          {input('action', 'Action (e.g. config)')}
          {input('target_id', 'Target id')}
          <Btn type="submit" variant="primary">Filter</Btn>
          <Btn variant="ghost" onClick={() => load()}>Refresh</Btn>
        </form>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!data && !error && <Spinner />}

      {data && (
        <div className="overflow-x-auto rounded-xl border border-[#E0E0E0] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E0E0E0] bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                {['When', 'Who', 'Action', 'Target', 'Result', ''].map(h => <th key={h} className="px-4 py-3">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.entries.map(e => (
                <Fragment key={e.id}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500" title={fmtWhen(e.at)}>{timeAgo(e.at)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Badge color={ROLE_BADGE[e.actor_role] ?? 'bg-gray-100 text-gray-600'}>{e.actor_role}</Badge>
                        <span className="truncate text-[#1A1A2E]">{e.actor_label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[#1A1A2E]">{e.action}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{e.target_type ? `${e.target_type}: ` : ''}<span className="font-mono">{e.target_id ?? ''}</span></td>
                    <td className="px-4 py-2.5">
                      <Badge color={e.status < 400 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{e.status ?? '—'}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button type="button" onClick={() => setOpenId(id => (id === e.id ? null : e.id))} className="text-xs font-semibold text-gray-400 hover:text-gray-700">
                        {openId === e.id ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  {openId === e.id && (
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <td colSpan={6} className="px-4 py-3">
                        {e.reason && <p className="mb-2 text-sm text-gray-700">Reason: {e.reason}</p>}
                        <div className="grid gap-3 md:grid-cols-3">
                          <Json label="Before" value={e.before} />
                          <Json label="After" value={e.after} />
                          <Json label="Request" value={e.request} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {data.entries.length === 0 && <p className="py-8 text-center text-gray-400">No changes recorded.</p>}
          <Paginator page={page} total={data.total} limit={LIMIT} onPage={setPage} />
        </div>
      )}
    </div>
  );
}
