// Live → Reports: rounds players reported after an event. Players never see answers; you
// do here. Uphold or dismiss; a bad Word Rush puzzle can be rejected in the same step.
// Quizup routes/adminLive.js (live_reports).
import { useEffect, useState } from 'react';
import { adminFetch, Btn, Spinner, timeAgo } from '../../lib/adminUtils.jsx';
import { Pills } from '../Panels.jsx';

export default function LiveReports({ token }) {
  const [status, setStatus] = useState('open');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try { setRows(await adminFetch(`/admin/live/reports?status=${status}`, {}, token)); setError(''); }
    catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, [status]);

  async function settle(r, next, rejectPuzzle = false) {
    try {
      await adminFetch('/admin/live/reports', { method: 'PUT', body: { eventId: r.event_id, roundIndex: r.round_index, status: next, rejectPuzzle } }, token);
      load();
    } catch (err) { setError(err.message); }
  }

  if (!rows) return error ? <p className="text-sm text-red-600">{error}</p> : <Spinner />;
  return (
    <div className="flex flex-col gap-3">
      <Pills options={[['open', 'Open'], ['upheld', 'Upheld'], ['dismissed', 'Dismissed']]} value={status} onChange={setStatus} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {rows.length === 0 && <p className="text-sm text-gray-500">No {status} reports.</p>}
      {rows.map(r => {
        const c = r.content;
        const word = r.round?.kind === 'word';
        return (
          <div key={`${r.event_id}-${r.round_index}`} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex justify-between gap-2 text-xs text-gray-500">
              <span>{r.event_name ?? 'KWIZ Live'} · round {r.round_index + 1} · {timeAgo(r.starts_at)}</span>
              <span className="font-bold text-gray-800">{r.reports} {r.reports === 1 ? 'report' : 'reports'}</span>
            </div>
            {c ? (word
              ? <p className="text-sm"><b className="font-mono">{c.answer}</b> · {c.parts.map(p => p.picture ?? p.letters ?? p.op).join(' ')}{c.explain ? ` · ${c.explain}` : ''} <span className="text-xs text-gray-500">({c.status})</span></p>
              : <p className="text-sm">{c.question_text} <b>→ {c.correct_answer}</b></p>)
              : <p className="text-sm text-gray-500">The round's content is gone.</p>}
            {r.reasons?.length > 0 && <ul className="text-xs text-gray-600 list-disc pl-5">{r.reasons.slice(0, 5).map((x, i) => <li key={i}>{x}</li>)}</ul>}
            {status === 'open' && (
              <div className="flex gap-2">
                <Btn variant="success" onClick={() => settle(r, 'upheld')}>Uphold</Btn>
                {word && c?.status !== 'rejected' && <Btn variant="danger" onClick={() => settle(r, 'upheld', true)}>Uphold and reject the puzzle</Btn>}
                <Btn onClick={() => settle(r, 'dismissed')}>Dismiss</Btn>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
