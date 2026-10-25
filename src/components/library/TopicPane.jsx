// The Library's right pane for one topic: its header and actions, then Questions (with
// their answers), Stats, and Generation history (its AI calls, from ai_api_logs).
import { useEffect, useState } from 'react';
import { Pencil, Zap, RefreshCw, ShieldCheck, Trash2, Eraser } from 'lucide-react';
import { adminFetch, Badge, Btn, Spinner, fmtWhen, timeAgo } from '../../lib/adminUtils.jsx';
import { useToastStore } from '../../lib/toastStore';
import { socket } from '../../lib/socket';
import { Pills, StatCard, Table } from '../Panels.jsx';
import { CategoryPicker, HealthBadge, SourceBadge } from './common.jsx';
import QuestionList from './QuestionList.jsx';
import { useValidation } from './useValidation.js';

const n = v => Number(v ?? 0).toLocaleString();

function Stats({ d }) {
  const s = d.stats, q = s.questions, t = d.topic;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Questions on" value={n(q.active)} sub={`${n(q.off)} off${q.pictures ? ` · ${n(q.pictures)} with pictures` : ''}`} />
        <StatCard label="Difficulty" value={`${n(q.easy)} / ${n(q.medium)} / ${n(q.hard)}`} sub="easy / medium / hard (on)" />
        <StatCard label="Fact-check" value={`${n(q.valid)} passed`} sub={`${n(q.flagged)} flagged · ${n(q.unvalidated)} not checked${q.last_validated_at ? ` · last ${timeAgo(q.last_validated_at)}` : ''}`} />
        <StatCard label="Reported" value={n(q.reported)} sub="questions with open player reports" />
        <StatCard label="Games played" value={n(t.games_played)} sub={`${n(s.games_30d)} in 30 days · ${n(s.games_7d)} in 7`} />
        <StatCard label="Players" value={n(s.players)} sub={`${n(s.solo_games)} solo games · ${n(s.favourites)} favourites`} />
        <StatCard label="Average score" value={`${Math.round(Number(t.avg_score_percent ?? 0))}%`} sub={`rated ${t.difficulty_level ?? 'unrated'}`} />
        <StatCard label="Last game" value={s.last_game_at ? timeAgo(s.last_game_at) : '—'} sub="multiplayer and challenges, last 90 days" />
      </div>
      <p className="text-xs text-gray-500">
        Added {fmtWhen(t.created_at)}{t.created_by_name ? ` by ${t.created_by_name}` : ''}. Players and solo games count real players only.
      </p>
    </div>
  );
}

function History({ rows }) {
  return (
    <Table
      cols={['When', 'Trigger', 'Model', 'Questions', 'Time', 'Cost', 'Result']}
      empty="No AI calls for this topic."
      rows={rows.map(r => (
        <tr key={r.id} className="border-b border-gray-100 align-top">
          <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap" title={fmtWhen(r.created_at)}>{timeAgo(r.created_at)}</td>
          <td className="px-4 py-2 text-xs">{r.triggered_by}</td>
          <td className="px-4 py-2 font-mono text-[11px] text-gray-500">{r.model}</td>
          <td className="px-4 py-2 tabular-nums">{r.questions_generated}</td>
          <td className="px-4 py-2 text-xs tabular-nums text-gray-500">{r.seconds != null ? `${r.seconds}s` : '—'}</td>
          <td className="px-4 py-2 text-xs tabular-nums text-gray-500">${(r.cost_usd ?? 0).toFixed(4)}</td>
          <td className="px-4 py-2 text-xs">{r.success
            ? <Badge color="bg-green-100 text-green-700">ok</Badge>
            : <span className="text-red-600" title={r.error_message ?? ''}>{(r.error_message ?? 'failed').slice(0, 90)}</span>}</td>
        </tr>
      ))}
    />
  );
}

export default function TopicPane({ token, topicId, tree, onSelect, onChanged }) {
  const [d, setD] = useState(null);
  const [view, setView] = useState('questions');
  const [edit, setEdit] = useState(null);
  const [progress, setProgress] = useState(null);
  const { addToast } = useToastStore();
  const v = useValidation(token, 'topic', topicId, () => load());

  async function load() {
    try { setD(await adminFetch(`/admin/library/topics/${topicId}`, {}, token)); }
    catch (err) { addToast(err.message, 'error'); }
  }

  useEffect(() => {
    setD(null); setEdit(null); setProgress(null); load();
    function onProgress(e) { if (e.topicId === topicId) setProgress({ inserted: e.inserted, total: e.total }); }
    function onReady(e) { if (e.topicId === topicId) { setProgress(null); load(); } }
    function onTopic(e) { if (e.id === topicId) load(); }
    function onLibrary(e) { if (e.ids?.includes(topicId)) load(); }
    socket.on('generation_progress', onProgress);
    socket.on('topic_ready', onReady);
    socket.on('admin_topic_updated', onTopic);
    socket.on('admin_library_changed', onLibrary);
    return () => {
      socket.off('generation_progress', onProgress);
      socket.off('topic_ready', onReady);
      socket.off('admin_topic_updated', onTopic);
      socket.off('admin_library_changed', onLibrary);
    };
  }, [topicId]);

  if (!d) return <Spinner />;
  const t = d.topic;

  async function act(fn, msg, { refresh = true } = {}) {
    try { await fn(); addToast(msg, 'success'); if (refresh) { await load(); onChanged(); } }
    catch (err) { addToast(err.message, 'error'); }
  }
  const put = body => adminFetch(`/admin/topics/${t.id}`, { method: 'PUT', body }, token);
  const post = path => adminFetch(`/admin/topics/${t.id}/${path}`, { method: 'POST' }, token);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
        <button type="button" className="hover:text-[#1A1A2E] hover:underline" onClick={() => onSelect({})}>Library</button>
        {t.parent_id && <>›<button type="button" className="hover:text-[#1A1A2E] hover:underline" onClick={() => onSelect({ cat: t.parent_id })}>{t.parent_name}</button></>}
        {t.category_id
          ? <>›<button type="button" className="hover:text-[#1A1A2E] hover:underline" onClick={() => onSelect({ cat: t.category_id })}>{t.category_name}</button></>
          : <>›<button type="button" className="text-amber-600 hover:underline" onClick={() => onSelect({ cat: 'none' })}>Uncategorised</button></>}
      </div>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ background: `${t.color}22`, border: `2px solid ${t.color}44` }}>{t.icon}</div>
        <div className="min-w-0 flex-1">
          {edit ? (
            <div className="flex flex-wrap items-center gap-2">
              <input value={edit.icon} onChange={e => setEdit(x => ({ ...x, icon: e.target.value }))} className="w-12 rounded-lg border border-[#E0E0E0] px-2 py-1 text-center text-sm" />
              <input value={edit.name} onChange={e => setEdit(x => ({ ...x, name: e.target.value }))} autoFocus className="w-64 rounded-lg border border-[#E0E0E0] px-2 py-1 text-sm focus:outline-none focus:border-[#E8453C]" />
              <input type="color" value={edit.color} onChange={e => setEdit(x => ({ ...x, color: e.target.value }))} className="h-8 w-8 cursor-pointer rounded border-0" />
              <Btn variant="success" disabled={!edit.name.trim()} onClick={() => { act(() => put({ ...edit, name: edit.name.trim() }), 'Topic saved'); setEdit(null); }}>Save</Btn>
              <Btn variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold leading-tight text-[#1A1A2E]">{t.name}</h2>
              <button type="button" title="Rename" onClick={() => setEdit({ name: t.name, icon: t.icon ?? '', color: t.color ?? '#6366f1' })}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Pencil size={14} /></button>
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <SourceBadge source={t.source} />
            <HealthBadge health={t.health} />
            <Badge color={t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}>{t.is_active ? 'On' : 'Off'}</Badge>
            <span className="text-xs text-gray-400">{n(t.question_count)} questions · {n(t.games_played)} games</span>
          </div>
        </div>
      </div>

      {t.is_assorted && (
        <p className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          An assorted topic: it has no questions of its own and plays questions from every topic in {t.category_name}.
        </p>
      )}

      {progress && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-gray-500"><span>Generating questions…</span><span className="font-mono text-cyan-600">{progress.inserted}/{progress.total}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${Math.min(100, Math.round(progress.inserted / progress.total * 100))}%` }} /></div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {!t.is_assorted && t.source !== 'image' && <>
          <Btn variant="primary" onClick={() => act(() => post('generate'), `Topping up ${t.name}`, { refresh: false })}><Zap size={12} /> Top up</Btn>
          <Btn variant="ghost" onClick={() => confirm(`Regenerate ${t.name}? Its ${t.question_count} questions are deleted and a fresh set is made.`) && act(() => post('regenerate'), `Regenerating ${t.name}`)}><RefreshCw size={12} /> Regenerate</Btn>
        </>}
        {!t.is_assorted && <Btn variant="ghost" disabled={v.running} onClick={v.start}><ShieldCheck size={12} /> Fact-check</Btn>}
        {v.label && <span className="font-mono text-xs text-blue-600">{v.label}</span>}
        <Btn variant={t.is_active ? 'ghost' : 'success'} onClick={() => act(() => put({ is_active: !t.is_active }), t.is_active ? `${t.name} is off` : `${t.name} is on`)}>
          {t.is_active ? 'Switch off' : 'Switch on'}
        </Btn>
        {!t.is_assorted && (
          <CategoryPicker roots={tree.roots} value="" allowNone
                          onChange={id => act(() => adminFetch(`/admin/topics/${t.id}/category`, { method: 'PATCH', body: { categoryId: id === 'none' ? null : id } }, token)
                            .then(() => onSelect({ cat: id, topic: t.id })), 'Moved')} />
        )}
        <span className="ml-auto flex gap-2">
          {!t.is_assorted && t.question_count > 0 && (
            <Btn variant="danger" onClick={() => confirm(`Delete all ${t.question_count} questions in ${t.name}?`) && act(() => adminFetch(`/admin/topics/${t.id}/questions`, { method: 'DELETE' }, token), 'Questions deleted')}><Eraser size={12} /> Clear questions</Btn>
          )}
          <Btn variant="danger" onClick={() => confirm(`Delete ${t.name} and everything in it for good?`) && act(async () => {
            await adminFetch(`/admin/topics/${t.id}`, { method: 'DELETE' }, token);
            onSelect(t.category_id ? { cat: t.category_id } : {});
          }, `Deleted ${t.name}`, { refresh: false }).then(onChanged)}><Trash2 size={12} /> Delete</Btn>
        </span>
      </div>

      <Pills options={[['questions', 'Questions'], ['stats', 'Stats'], ['history', `Generation history${d.history.length ? ` · ${d.history.length}` : ''}`]]} value={view} onChange={setView} />
      {view === 'questions' && (t.is_assorted
        ? <p className="py-6 text-center text-sm text-gray-400">Assorted topics have no questions of their own.</p>
        : <QuestionList token={token} topicId={t.id} onChanged={() => { load(); onChanged(); }} />)}
      {view === 'stats' && <Stats d={d} />}
      {view === 'history' && <History rows={d.history} />}
    </div>
  );
}
