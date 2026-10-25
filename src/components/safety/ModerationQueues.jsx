// Safety's moderation queues (Quizup routes/adminSafety.js): players' pictures by newest change,
// topics players made, and questions players reported that are still in play (under the
// auto-pull threshold). Clicking a player opens the player drawer.
import { useEffect, useState } from 'react';
import { adminFetch, Badge, Btn, Paginator, Spinner, timeAgo } from '../../lib/adminUtils.jsx';
import { useToastStore } from '../../lib/toastStore';
import { usePlayerStore } from '../../store/playerStore';

const LIMIT = 60;

function useQueue(path, token, version) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  async function load(p = page) {
    try {
      setData(await adminFetch(`${path}${path.includes('?') ? '&' : '?'}limit=${LIMIT}&offset=${p * LIMIT}`, {}, token));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { load(page); }, [page, version]);
  return { data, setData, error, page, setPage, reload: () => load(page) };
}

export function Pictures({ token }) {
  const { openPlayer, version, changed } = usePlayerStore();
  const { data, error, page, setPage, reload } = useQueue('/admin/moderation/avatars', token, version);
  const { addToast } = useToastStore();

  async function reset(a) {
    if (!confirm(`Remove ${a.username}'s picture?`)) return;
    try {
      await adminFetch(`/admin/users/${a.id}/avatar-reset`, { method: 'POST' }, token);
      addToast('Picture removed', 'success');
      changed();
      reload();
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <Spinner />;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
        {data.avatars.map(a => (
          <div key={a.id} className="group flex flex-col items-center gap-1 rounded-xl border border-gray-200 bg-white p-2">
            <button type="button" onClick={() => openPlayer(a.id)} className="w-full">
              <img src={a.avatar_url} alt="" loading="lazy" className="aspect-square w-full rounded-lg bg-gray-100 object-cover" />
            </button>
            <span className="w-full truncate text-center text-xs font-semibold text-[#1A1A2E]">{a.username}</span>
            <span className="text-[10px] text-gray-400">{timeAgo(a.changed_at)}</span>
            <button type="button" onClick={() => reset(a)} className="text-[11px] font-semibold text-red-600 hover:underline">Remove</button>
          </div>
        ))}
      </div>
      {data.avatars.length === 0 && <p className="py-8 text-center text-gray-400">No pictures.</p>}
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Newer</Btn>
        <Btn variant="ghost" disabled={data.avatars.length < LIMIT} onClick={() => setPage(p => p + 1)}>Older →</Btn>
      </div>
    </div>
  );
}

export function PlayerTopics({ token }) {
  const { openPlayer, version } = usePlayerStore();
  const { data, setData, error, page, setPage } = useQueue('/admin/moderation/topics', token, version);
  const { addToast } = useToastStore();

  async function toggle(t) {
    try {
      await adminFetch(`/admin/topics/${t.id}`, { method: 'PUT', body: { is_active: !t.is_active } }, token);
      setData(d => ({ ...d, topics: d.topics.map(x => (x.id === t.id ? { ...x, is_active: !t.is_active } : x)) }));
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <Spinner />;
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E0E0E0] bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#E0E0E0] bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
            {['Topic', 'Made by', 'When', 'Questions', 'Games', ''].map(h => <th key={h} className="px-4 py-3">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.topics.map(t => (
            <tr key={t.id} className="border-b border-gray-100">
              <td className={`px-4 py-2.5 font-semibold ${t.is_active ? 'text-[#1A1A2E]' : 'text-gray-400 line-through'}`}>{t.name}</td>
              <td className="px-4 py-2.5"><button type="button" onClick={() => openPlayer(t.created_by)} className="hover:underline">{t.created_by_username}</button></td>
              <td className="px-4 py-2.5 text-xs text-gray-500">{timeAgo(t.created_at)}</td>
              <td className="px-4 py-2.5 tabular-nums">{t.question_count}</td>
              <td className="px-4 py-2.5 tabular-nums">{t.games_played}</td>
              <td className="px-4 py-2.5 text-right"><Btn variant={t.is_active ? 'danger' : 'success'} onClick={() => toggle(t)}>{t.is_active ? 'Hide' : 'Show'}</Btn></td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.topics.length === 0 && <p className="py-8 text-center text-gray-400">No player-made topics.</p>}
      <Paginator page={page} total={data.total} limit={LIMIT} onPage={setPage} />
    </div>
  );
}

export function QuestionReports({ token }) {
  const { data, setData, error } = useQueue('/admin/moderation/question-reports', token, 0);
  const { addToast } = useToastStore();

  async function decide(q, action) {
    try {
      await adminFetch(`/admin/moderation/question-reports/${q.id}`, { method: 'POST', body: { action } }, token);
      setData(d => ({ ...d, questions: d.questions.filter(x => x.id !== q.id) }));
      addToast(action === 'pull' ? 'Pulled from play (now in Question quality)' : 'Kept in play', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <Spinner />;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-gray-500">Questions reported by fewer than {data.threshold} players (that many pull one automatically). Pull takes it out of play and into Question quality.</p>
      {data.questions.map(q => (
        <div key={q.id} className="rounded-xl border border-[#E0E0E0] bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color="bg-amber-100 text-amber-800">{q.reports} report{q.reports === 1 ? '' : 's'}: {q.reasons}</Badge>
            <span className="text-xs text-gray-500">{q.topic} · {timeAgo(q.last_at)}</span>
          </div>
          <p className="mt-2 font-semibold text-[#1A1A2E]">{q.question_text}</p>
          <p className="mt-1 text-sm"><span className="font-semibold text-green-700">✓ {q.correct_answer}</span>
            <span className="text-gray-500"> · {(Array.isArray(q.wrong_answers) ? q.wrong_answers : []).join(' · ')}</span></p>
          {q.notes?.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-gray-600">{q.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
          <div className="mt-3 flex gap-2">
            <Btn variant="danger" onClick={() => decide(q, 'pull')}>Pull from play</Btn>
            <Btn variant="ghost" onClick={() => decide(q, 'keep')}>It's fine, keep it</Btn>
          </div>
        </div>
      ))}
      {data.questions.length === 0 && <p className="py-8 text-center text-gray-400">No reported questions waiting.</p>}
    </div>
  );
}
