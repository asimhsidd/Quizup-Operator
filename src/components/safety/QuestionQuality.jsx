// Safety → Question quality: questions flagged for review, by the Gemini fact-check, by an
// operator pulling a reported one, or as migration 036's conflicting duplicates (the same
// question in a topic with different answers, every copy switched off). Copies of one
// question come as a group: pick the right one and the rest stay off. Every action takes
// the question out of the queue (PATCH /admin/questions/:id/validation).
import { useEffect, useState } from 'react';
import { adminFetch, Badge, Btn, Paginator, Spinner } from '../../lib/adminUtils.jsx';
import { useToastStore } from '../../lib/toastStore';
import { useNavStore } from '../../store/navStore';

const LIMIT = 60;
const key = q => `${q.topic_id}|${q.question_text.trim().toLowerCase()}`;

export default function QuestionQuality({ token }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(null);
  const go = useNavStore(s => s.go);
  const { addToast } = useToastStore();

  async function load(p = page) {
    try { setData(await adminFetch(`/admin/validation/flagged?limit=${LIMIT}&offset=${p * LIMIT}`, {}, token)); }
    catch (err) { addToast(err.message, 'error'); setData({ rows: [], total: 0 }); }
  }
  useEffect(() => { load(0); }, []);

  const review = (id, action) => adminFetch(`/admin/questions/${id}/validation`, { method: 'PATCH', body: { action } }, token);

  async function decide(group, q, action) {
    setBusy(group.key);
    try {
      if (action === 'pick') {
        await review(q.id, 'approve');
        for (const other of group.rows) if (other.id !== q.id) await review(other.id, 'deactivate');
        addToast(`Kept "${q.correct_answer}" and switched it on`, 'success');
      } else if (action === 'all-off') {
        for (const other of group.rows) await review(other.id, 'deactivate');
        addToast(group.rows.length > 1 ? 'All copies kept off' : 'Kept off', 'success');
      } else {
        await review(q.id, action);
        addToast(action === 'approve' ? 'Switched on' : 'Kept off', 'success');
      }
      await load();
    } catch (err) { addToast(err.message, 'error'); }
    setBusy(null);
  }

  if (!data) return <Spinner />;
  const groups = [];
  for (const q of data.rows) {
    const k = key(q);
    if (groups.at(-1)?.key === k) groups.at(-1).rows.push(q);
    else groups.push({ key: k, rows: [q] });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-gray-500">
        {data.total.toLocaleString()} flagged question{data.total === 1 ? '' : 's'}. Copies of the same question with different answers are grouped: pick
        the right one and the others stay off. To change the wording or an answer, open the topic in the Library.
      </p>
      {groups.map(g => {
        const q0 = g.rows[0];
        const sharedNote = g.rows.every(q => q.validation_note === q0.validation_note) ? q0.validation_note : null;
        return (
          <div key={g.key} className="rounded-xl border border-amber-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <button type="button" className="font-semibold text-[#1A1A2E] hover:underline"
                      onClick={() => go('library', { path: [q0.category_id ?? 'none', q0.topic_id] })}>{q0.topic_name}</button>
              {q0.category_name && <span>· {q0.category_name}</span>}
              {g.rows.length > 1 && <Badge color="bg-amber-100 text-amber-800">{g.rows.length} copies</Badge>}
            </div>
            <p className="mt-1.5 font-semibold text-[#1A1A2E]">{q0.question_text}</p>
            {sharedNote && <p className="mt-0.5 text-xs text-amber-700">{sharedNote}</p>}
            <div className="mt-2 flex flex-col gap-2">
              {g.rows.map(q => (
                <div key={q.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-green-700">✓ {q.correct_answer}</span>
                  <span className="text-gray-500">· {(q.wrong_answers ?? []).join(' · ')}</span>
                  {q.is_active ? <Badge color="bg-green-100 text-green-700">on</Badge> : <Badge color="bg-gray-200 text-gray-600">off</Badge>}
                  {q.validation_note && !sharedNote && <span className="w-full text-xs text-amber-700">{q.validation_note}</span>}
                  <span className="ml-auto flex gap-2">
                    {g.rows.length > 1
                      ? <Btn variant="success" disabled={busy === g.key} onClick={() => decide(g, q, 'pick')}>This one's right</Btn>
                      : <>
                          <Btn variant="success" disabled={busy === g.key} onClick={() => decide(g, q, 'approve')}>It's right, switch on</Btn>
                          <Btn variant="ghost" disabled={busy === g.key} onClick={() => decide(g, q, 'deactivate')}>Keep it off</Btn>
                        </>}
                  </span>
                </div>
              ))}
            </div>
            {g.rows.length > 1 && (
              <div className="mt-2 flex justify-end">
                <Btn variant="ghost" disabled={busy === g.key} onClick={() => decide(g, null, 'all-off')}>None is right, keep all off</Btn>
              </div>
            )}
          </div>
        );
      })}
      {!groups.length && <p className="py-8 text-center text-gray-400">No flagged questions.</p>}
      <div className="rounded-xl border border-[#E0E0E0] bg-white">
        <Paginator page={page} total={data.total} limit={LIMIT} onPage={p => { setPage(p); load(p); }} />
      </div>
    </div>
  );
}
