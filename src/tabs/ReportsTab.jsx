import { useEffect, useState } from 'react';
import { adminFetch, Paginator } from '../lib/adminUtils.jsx';
import { useToastStore } from '../lib/toastStore';

const LIMIT = 50;

export default function ReportsTab({ token }) {
  const [reports, setReports] = useState([]);
  const [total, setTotal]     = useState(0);
  const [status, setStatus]   = useState('pending');
  const [page, setPage]       = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [busyId, setBusyId]   = useState(null);
  const { addToast } = useToastStore();

  async function load(s = status, p = page) {
    setLoading(true);
    try {
      const data = await adminFetch(`/admin/reports?status=${s}&limit=${LIMIT}&offset=${p * LIMIT}`, {}, token);
      setReports(data.reports ?? []);
      setTotal(data.total ?? 0);
      setError('');
    } catch (err) {
      setError(err.message || 'Reports did not load');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id, newStatus) {
    setBusyId(id);
    try {
      await adminFetch(`/admin/reports/${id}`, { method: 'PUT', body: { status: newStatus } }, token);
      setReports(prev => prev.filter(r => r.id !== id));
      setTotal(t => Math.max(0, t - 1));
    } catch (err) {
      addToast(`Report not updated: ${err.message}`, 'error');
    }
    setBusyId(null);
  }

  function switchStatus(s) {
    setStatus(s);
    setPage(0);
    load(s, 0);
  }

  function goToPage(p) {
    setPage(p);
    load(status, p);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[#1A1A2E]">User Reports{total > 0 && <span className="text-gray-400 font-semibold"> ({total})</span>}</h2>
        <div className="flex gap-2">
          {['pending', 'reviewed', 'dismissed'].map(s => (
            <button
              key={s}
              onClick={() => switchStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors capitalize
                ${status === s ? 'bg-[#E8453C] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => load()} className="font-bold underline">Retry</button>
        </div>
      )}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No {status} reports.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-[#E0E0E0] p-4">
              <div className="flex items-start gap-3">
                {/* Reporter */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                    style={{ background: '#E8453C' }}
                  >
                    {r.reporter_avatar
                      ? <img src={r.reporter_avatar} alt="" className="w-full h-full object-cover" />
                      : r.reporter_username?.[0]?.toUpperCase()
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Reporter</p>
                    <p className="text-sm font-semibold text-[#1A1A2E] truncate">{r.reporter_username}</p>
                  </div>
                </div>
                <div className="text-gray-400 text-base shrink-0">→</div>
                {/* Reported */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                    style={{ background: '#9C6FE4' }}
                  >
                    {r.reported_avatar
                      ? <img src={r.reported_avatar} alt="" className="w-full h-full object-cover" />
                      : r.reported_username?.[0]?.toUpperCase()
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Reported</p>
                    <p className="text-sm font-semibold text-[#1A1A2E] truncate">{r.reported_username}</p>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-xs font-bold mb-1"
                  style={{ background: '#FEF2F2', color: '#E8453C' }}
                >
                  {r.reason}
                </span>
                {r.context && (
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{r.context}</p>
                )}
                <p className="text-[11px] text-gray-400 mt-1">
                  {new Date(r.created_at).toLocaleString()}
                </p>
              </div>

              {status === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => updateStatus(r.id, 'reviewed')}
                    disabled={busyId === r.id}
                    className="disabled:opacity-50 flex-1 py-2 rounded-lg text-xs font-bold text-white transition-colors"
                    style={{ background: '#22C55E' }}
                  >
                    Mark Reviewed
                  </button>
                  <button
                    onClick={() => updateStatus(r.id, 'dismissed')}
                    disabled={busyId === r.id}
                    className="disabled:opacity-50 flex-1 py-2 rounded-lg text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
          {total > LIMIT && (
            <div className="bg-white rounded-xl border border-[#E0E0E0]">
              <Paginator page={page} total={total} limit={LIMIT} onPage={goToPage} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
