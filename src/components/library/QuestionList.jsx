// A topic's questions in the Library. A row opens to its four answers (the correct one
// marked), its review state and its actions; Edit changes the text, the answers and the
// difficulty in place (PATCH /admin/library/questions/:id, which checks them).
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Flag, AlertTriangle } from 'lucide-react';
import { adminFetch, Badge, Btn, Spinner, timeAgo } from '../../lib/adminUtils.jsx';
import { useToastStore } from '../../lib/toastStore';
import { socket } from '../../lib/socket';
import { Pills } from '../Panels.jsx';

const DIFFICULTY = { 1: ['Easy', 'bg-green-100 text-green-700'], 2: ['Medium', 'bg-amber-100 text-amber-700'], 3: ['Hard', 'bg-red-100 text-red-700'] };
const REASONS = { wrong_answer: 'wrong answer', typo: 'typo', unclear: 'unclear', offensive: 'offensive', other: 'other' };
const field = 'font-normal text-[#1A1A2E] w-full rounded-lg border border-[#E0E0E0] bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#E8453C]';

function EditForm({ q, token, onDone }) {
  const [f, setF] = useState({
    question_text: q.question_text,
    correct_answer: q.correct_answer,
    wrong_answers: [...(q.wrong_answers ?? []), '', '', ''].slice(0, 3),
    difficulty: q.difficulty ?? 1,
  });
  const [busy, setBusy] = useState(false);
  const { addToast } = useToastStore();

  async function save() {
    setBusy(true);
    try {
      await adminFetch(`/admin/library/questions/${q.id}`, { method: 'PATCH', body: f }, token);
      addToast('Question saved', 'success');
      onDone(true);
    } catch (err) { addToast(err.message, 'error'); }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea rows={2} value={f.question_text} onChange={e => setF(x => ({ ...x, question_text: e.target.value }))} className={`${field} resize-y`} />
      <label className="flex items-center gap-2 text-xs font-semibold text-green-700">✓
        <input value={f.correct_answer} onChange={e => setF(x => ({ ...x, correct_answer: e.target.value }))} className={`${field} border-green-300 font-semibold text-green-800`} />
      </label>
      {f.wrong_answers.map((w, i) => (
        <label key={i} className="flex items-center gap-2 text-xs font-semibold text-gray-400">✗
          <input value={w} onChange={e => setF(x => ({ ...x, wrong_answers: x.wrong_answers.map((a, j) => j === i ? e.target.value : a) }))} className={field} />
        </label>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Pills options={[[1, 'Easy'], [2, 'Medium'], [3, 'Hard']]} value={f.difficulty} onChange={d => setF(x => ({ ...x, difficulty: d }))} />
        <span className="ml-auto flex gap-2">
          <Btn variant="success" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</Btn>
          <Btn variant="ghost" onClick={() => onDone(false)}>Cancel</Btn>
        </span>
      </div>
    </div>
  );
}

function QuestionRow({ q, i, token, open, onToggle, onChanged }) {
  const [editing, setEditing] = useState(false);
  const { addToast } = useToastStore();
  const [label, color] = DIFFICULTY[q.difficulty] ?? DIFFICULTY[1];
  const flagged = q.validation_status === 'flagged';

  async function act(fn, msg) {
    try { await fn(); addToast(msg, 'success'); onChanged(); }
    catch (err) { addToast(err.message, 'error'); }
  }
  const review = action => act(() => adminFetch(`/admin/questions/${q.id}/validation`, { method: 'PATCH', body: { action } }, token),
    { approve: 'Marked correct and switched on', dismiss: 'Marked correct', deactivate: 'Kept off' }[action]);
  const report = action => act(() => adminFetch(`/admin/moderation/question-reports/${q.id}`, { method: 'POST', body: { action } }, token),
    action === 'pull' ? 'Pulled from play' : 'Reports cleared, kept in play');

  return (
    <div className={`rounded-lg border bg-white ${flagged ? 'border-amber-300' : q.open_reports ? 'border-red-200' : 'border-[#E0E0E0]'} ${q.is_active ? '' : 'bg-gray-50'}`}>
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-2 px-3 py-2 text-left">
        <span className="mt-0.5 text-gray-400">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        <span className="w-6 shrink-0 font-mono text-xs leading-5 text-gray-400">{i + 1}</span>
        <span className={`flex-1 text-sm leading-5 ${q.is_active ? 'text-[#1A1A2E]' : 'text-gray-400 line-through decoration-gray-300'}`}>{q.question_text}</span>
        <span className="flex shrink-0 items-center gap-1">
          {flagged && <Badge color="bg-amber-100 text-amber-800">flagged</Badge>}
          {q.open_reports > 0 && <Badge color="bg-red-100 text-red-700">{q.open_reports} report{q.open_reports === 1 ? '' : 's'}</Badge>}
          {q.image_url && <Badge color="bg-teal-100 text-teal-700">picture</Badge>}
          {!q.is_active && <Badge color="bg-gray-200 text-gray-600">off</Badge>}
          <Badge color={color}>{label}</Badge>
        </span>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-3 pb-3 pt-2 pl-[52px]">
          {editing ? <EditForm q={q} token={token} onDone={saved => { setEditing(false); if (saved) onChanged(); }} /> : (
            <div className="flex flex-col gap-2">
              {q.image_url && <img src={q.image_url} alt={q.image_alt ?? ''} className="max-h-32 w-auto self-start rounded border border-gray-200" />}
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                <li className="rounded-md border border-green-200 bg-green-50 px-2.5 py-1.5 font-semibold text-green-800">✓ {q.correct_answer}</li>
                {(q.wrong_answers ?? []).map((w, j) => <li key={j} className="rounded-md border border-gray-200 px-2.5 py-1.5 text-gray-600">✗ {w}</li>)}
              </ul>
              {flagged && (
                <p className="flex items-start gap-1.5 text-xs text-amber-800"><AlertTriangle size={13} className="mt-px shrink-0" />
                  {q.validation_note ?? 'Flagged by the fact-check.'}{q.validated_at && <span className="text-amber-600"> · {timeAgo(q.validated_at)}</span>}</p>
              )}
              {q.open_reports > 0 && (
                <p className="flex items-start gap-1.5 text-xs text-red-700"><Flag size={13} className="mt-px shrink-0" />
                  Reported by players: {(q.reasons ?? []).map(r => REASONS[r] ?? r).join(', ')}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Btn variant="ghost" onClick={() => setEditing(true)}>Edit</Btn>
                {flagged && <>
                  <Btn variant="success" onClick={() => review('approve')}>It's right, switch on</Btn>
                  <Btn variant="ghost" onClick={() => review('deactivate')}>Keep it off</Btn>
                </>}
                {q.open_reports > 0 && <>
                  <Btn variant="ghost" onClick={() => report('keep')}>Reports are wrong, keep it</Btn>
                  <Btn variant="danger" onClick={() => report('pull')}>Pull from play</Btn>
                </>}
                {!flagged && (
                  <Btn variant={q.is_active ? 'ghost' : 'success'}
                       onClick={() => act(() => adminFetch(`/admin/questions/${q.id}`, { method: 'PUT', body: { is_active: !q.is_active } }, token), q.is_active ? 'Switched off' : 'Switched on')}>
                    {q.is_active ? 'Switch off' : 'Switch on'}
                  </Btn>
                )}
                <Btn variant="danger" onClick={() => confirm('Delete this question for good?') && act(() => adminFetch(`/admin/questions/${q.id}`, { method: 'DELETE' }, token), 'Question deleted')}>Delete</Btn>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function QuestionList({ token, topicId, onChanged }) {
  const [questions, setQuestions] = useState(null);
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(() => new Set());
  const [q, setQ] = useState('');

  async function load() {
    try { setQuestions((await adminFetch(`/admin/library/topics/${topicId}/questions`, {}, token)).questions); }
    catch { setQuestions([]); }
  }
  useEffect(() => {
    setQuestions(null); setOpen(new Set()); setFilter('all'); load();
    function onUpdated(e) { if (e.topicId === topicId) load(); }
    socket.on('admin_questions_updated', onUpdated);
    socket.on('topic_ready', onUpdated);
    return () => { socket.off('admin_questions_updated', onUpdated); socket.off('topic_ready', onUpdated); };
  }, [topicId]);

  if (!questions) return <Spinner />;
  const counts = {
    all: questions.length,
    on: questions.filter(x => x.is_active).length,
    off: questions.filter(x => !x.is_active).length,
    review: questions.filter(x => x.validation_status === 'flagged' || x.open_reports > 0).length,
  };
  const term = q.trim().toLowerCase();
  const shown = questions.filter(x =>
    (filter === 'all' || (filter === 'on' && x.is_active) || (filter === 'off' && !x.is_active)
      || (filter === 'review' && (x.validation_status === 'flagged' || x.open_reports > 0)))
    && (!term || `${x.question_text} ${x.correct_answer} ${(x.wrong_answers ?? []).join(' ')}`.toLowerCase().includes(term)));
  const allOpen = shown.length > 0 && shown.every(x => open.has(x.id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pills options={[['all', `All ${counts.all}`], ['on', `On ${counts.on}`], ['off', `Off ${counts.off}`], ['review', `To review ${counts.review}`]]} value={filter} onChange={setFilter} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search questions and answers…"
               className="w-60 rounded-lg border border-[#E0E0E0] bg-white px-3 py-1.5 text-sm focus:outline-none focus:border-[#E8453C]" />
        <button type="button" className="ml-auto text-xs font-semibold text-gray-500 hover:text-gray-800"
                onClick={() => setOpen(allOpen ? new Set() : new Set(shown.map(x => x.id)))}>
          {allOpen ? 'Close all' : 'Show all answers'}
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {shown.map((x, i) => (
          <QuestionRow key={x.id} q={x} i={i} token={token} open={open.has(x.id)}
                       onToggle={() => setOpen(prev => { const next = new Set(prev); if (next.has(x.id)) next.delete(x.id); else next.add(x.id); return next; })}
                       onChanged={() => { load(); onChanged?.(); }} />
        ))}
        {!shown.length && <p className="py-8 text-center text-sm text-gray-400">{questions.length ? 'No questions match.' : 'No questions yet.'}</p>}
      </div>
    </div>
  );
}
