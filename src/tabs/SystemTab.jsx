// System: how the KWIZ API's cron jobs have been running (Quizup lib/cronLock.js records
// every run in cron_runs, kept 14 days). A failing job also opens an Inbox item.
import { useEffect, useState } from 'react';
import { adminFetch, Badge, Btn, Spinner, fmtWhen, timeAgo } from '../lib/adminUtils.jsx';

export default function SystemTab({ token }) {
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
        <div>
          <h2 className="text-lg font-bold text-[#1A1A2E]">Cron jobs</h2>
          <p className="text-xs text-gray-500">
            {jobs ? `${jobs.length} jobs, ${failing ? `${failing} failing on their last run` : 'all fine on their last run'}.` : ' '}
            {' '}A job missing here hasn't run since the history started.
          </p>
        </div>
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
