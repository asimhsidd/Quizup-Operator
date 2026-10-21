import { useEffect, useRef, useState } from 'react';
import { useToastStore } from '../lib/toastStore';
import { socket } from '../lib/socket';
import { RefreshCw, Trash2, Eye, EyeOff, Trash, Pencil } from 'lucide-react';
import { Zap } from 'lucide-react';
import { adminFetch, Badge, Btn, Spinner, healthBadge } from '../lib/adminUtils.jsx';

// ── Batch Topic Creator modal ─────────────────────────────────────────────────
const TOPIC_COLOURS = [
  '#E8453C','#9C6FE4','#3B82F6','#10B981','#F59E0B',
  '#EC4899','#06B6D4','#8B5CF6','#EF4444','#14B8A6',
  '#F97316','#6366F1','#22C55E','#A855F7','#0EA5E9',
];
function randomTopicColor() {
  return TOPIC_COLOURS[Math.floor(Math.random() * TOPIC_COLOURS.length)];
}

function BatchTopicCreator({ token, existingTopics, onClose }) {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState('input'); // 'input' | 'processing' | 'done'
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ created: 0, failed: 0, skipped: 0 });

  const delay = ms => new Promise(r => setTimeout(r, ms));

  const previewLines = [...new Set(
    text.split('\n').map(l => l.trim()).filter(Boolean)
  )];
  const existingNames = new Set(existingTopics.map(t => t.name.toLowerCase()));
  const annotated = previewLines.map(name => ({
    name,
    willSkip: existingNames.has(name.toLowerCase()),
  }));
  const validCount = annotated.filter(a => !a.willSkip).length;
  const skipCount  = annotated.filter(a =>  a.willSkip).length;

  async function startBatch() {
    const initialItems = annotated.map(a => ({
      name: a.name,
      status: a.willSkip ? 'skipped' : 'pending',
    }));
    setItems(initialItems);
    setPhase('processing');

    const pending = initialItems
      .map((item, idx) => ({ ...item, idx }))
      .filter(item => item.status === 'pending');

    const BATCH = 5;
    let created = 0;
    let failed  = 0;
    let skipped = annotated.filter(a => a.willSkip).length;

    for (let i = 0; i < pending.length; i += BATCH) {
      const batch = pending.slice(i, i + BATCH);

      setItems(prev => prev.map((item, idx) =>
        batch.find(b => b.idx === idx) ? { ...item, status: 'running' } : item
      ));

      await Promise.allSettled(batch.map(async batchItem => {
        async function tryCreate() {
          return adminFetch('/admin/topics', { method: 'POST', body: { name: batchItem.name, color: randomTopicColor() } }, token);
        }

        try {
          const created_topic = await tryCreate();
          await adminFetch(`/admin/topics/${created_topic.id}/generate`, { method: 'POST' }, token);
          setItems(prev => prev.map((item, idx) =>
            idx === batchItem.idx ? { ...item, status: 'done' } : item
          ));
          created++;
        } catch (err) {
          const msg = err.message || '';
          if (msg.toLowerCase().includes('already exists') || msg.includes('409')) {
            setItems(prev => prev.map((item, idx) =>
              idx === batchItem.idx ? { ...item, status: 'skipped' } : item
            ));
            skipped++;
          } else if (msg.includes('429')) {
            await delay(3000);
            try {
              const created_topic = await tryCreate();
              await adminFetch(`/admin/topics/${created_topic.id}/generate`, { method: 'POST' }, token);
              setItems(prev => prev.map((item, idx) =>
                idx === batchItem.idx ? { ...item, status: 'done' } : item
              ));
              created++;
            } catch (err2) {
              setItems(prev => prev.map((item, idx) =>
                idx === batchItem.idx ? { ...item, status: 'failed', error: err2.message } : item
              ));
              failed++;
            }
          } else {
            setItems(prev => prev.map((item, idx) =>
              idx === batchItem.idx ? { ...item, status: 'failed', error: msg } : item
            ));
            failed++;
          }
        }
      }));
    }

    setSummary({ created, failed, skipped });
    setPhase('done');
  }

  async function retryItem(idx, name) {
    setItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, status: 'running', error: undefined } : item
    ));
    try {
      const created_topic = await adminFetch('/admin/topics', { method: 'POST', body: { name } }, token);
      await adminFetch(`/admin/topics/${created_topic.id}/generate`, { method: 'POST' }, token);
      setItems(prev => prev.map((item, i) =>
        i === idx ? { ...item, status: 'done' } : item
      ));
      setSummary(s => ({ ...s, created: s.created + 1, failed: s.failed - 1 }));
    } catch (err) {
      setItems(prev => prev.map((item, i) =>
        i === idx ? { ...item, status: 'failed', error: err.message } : item
      ));
    }
  }

  const totalItems = items.length;
  const doneCount  = items.filter(it => ['done', 'skipped', 'failed'].includes(it.status)).length;
  const progress   = totalItems > 0 ? doneCount / totalItems : 0;

  const statusIcon = s => ({ pending: '⏳', running: '🔄', done: '✅', skipped: '⊘', failed: '❌' }[s] ?? '⏳');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={phase === 'processing' ? undefined : onClose}
    >
      <div
        className="bg-white border border-[#E0E0E0] shadow-lg rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg flex flex-col overflow-hidden"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E0E0E0] shrink-0">
          <h2 className="text-[#1A1A2E] font-bold text-base">Batch Create Topics</h2>
          {phase !== 'processing' && (
            <button onClick={onClose} className="text-gray-400 hover:text-[#1A1A2E] text-xl leading-none">×</button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {phase === 'input' && (
            <>
              <p className="text-gray-500 text-xs mb-3">One topic name per line. Duplicates and existing topics will be skipped.</p>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={"World History\nSpace Exploration\nJazz Music\n..."}
                rows={8}
                className="w-full bg-gray-50 border border-[#E0E0E0] text-[#1A1A2E] rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-[#E8453C] placeholder-gray-400"
              />
              {previewLines.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-2">
                    <span className="text-green-600 font-bold">{validCount} topic{validCount !== 1 ? 's' : ''} will be created</span>
                    {skipCount > 0 && <span className="text-gray-400"> · {skipCount} skipped (already exist)</span>}
                  </p>
                  <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                    {annotated.map((a, i) => (
                      <div key={i} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${a.willSkip ? 'text-gray-400' : 'text-gray-600'}`}>
                        <span className="shrink-0">{a.willSkip ? '⊘' : '+'}</span>
                        <span className={a.willSkip ? 'line-through flex-1 truncate' : 'flex-1 truncate'}>{a.name}</span>
                        {a.willSkip && <span className="text-gray-400 text-xs shrink-0">already exists</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {(phase === 'processing' || phase === 'done') && (
            <>
              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">
                    {phase === 'done' ? 'Complete' : `Processing… ${doneCount} / ${totalItems}`}
                  </span>
                  <span className="text-xs text-cyan-600 font-mono">{Math.round(progress * 100)}%</span>
                </div>
                <div className="bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>

              {/* Summary pills (done only) */}
              {phase === 'done' && (
                <div className="flex gap-2 mb-4 flex-wrap">
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                    {summary.created} created
                  </span>
                  {summary.failed > 0 && (
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-600">
                      {summary.failed} failed
                    </span>
                  )}
                  {summary.skipped > 0 && (
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500">
                      {summary.skipped} skipped
                    </span>
                  )}
                </div>
              )}

              {/* Items list */}
              <div className="flex flex-col gap-1">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      item.status === 'done'     ? 'bg-green-50' :
                      item.status === 'failed'   ? 'bg-red-50'   :
                      item.status === 'running'  ? 'bg-cyan-50'  :
                      item.status === 'skipped'  ? 'bg-gray-50 opacity-60' :
                      'bg-gray-50'
                    }`}
                  >
                    <span className="text-base shrink-0">{statusIcon(item.status)}</span>
                    <span className={`flex-1 min-w-0 truncate text-xs ${
                      item.status === 'done'    ? 'text-green-700' :
                      item.status === 'failed'  ? 'text-red-600'   :
                      item.status === 'skipped' ? 'text-gray-400'  :
                      item.status === 'running' ? 'text-cyan-700'  :
                      'text-gray-600'
                    }`}>
                      {item.name}
                    </span>
                    {item.error && (
                      <span className="text-red-500 text-xs truncate max-w-[6rem]" title={item.error}>
                        {item.error}
                      </span>
                    )}
                    {item.status === 'failed' && phase === 'done' && (
                      <button
                        onClick={() => retryItem(idx, item.name)}
                        className="shrink-0 text-xs px-2 py-0.5 rounded bg-cyan-100 text-cyan-700 hover:bg-cyan-200 transition-colors"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#E0E0E0] shrink-0 flex justify-end gap-2">
          {phase === 'input' && (
            <>
              <Btn onClick={onClose} variant="ghost">Cancel</Btn>
              <Btn onClick={startBatch} variant="coral" disabled={validCount === 0}>
                Create {validCount} Topic{validCount !== 1 ? 's' : ''}
              </Btn>
            </>
          )}
          {phase === 'processing' && (
            <span className="text-gray-400 text-xs self-center">Processing — please wait…</span>
          )}
          {phase === 'done' && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 text-sm font-bold transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add Topic Modal ───────────────────────────────────────────────────────────
function AddTopicModal({ token, onClose }) {
  const [form, setForm] = useState({ name: '', icon: '📚', color: '#6366f1' });
  const { addToast } = useToastStore();

  async function handleCreate() {
    if (!form.name.trim()) return;
    try {
      const result = await adminFetch('/admin/topics', { method: 'POST', body: form }, token);
      // Kick off generation immediately (responds instantly, runs in background)
      await adminFetch(`/admin/topics/${result.id}/generate`, { method: 'POST' }, token);
      addToast(`Topic "${form.name}" created — generating questions…`, 'success');
      onClose(true);
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white border border-[#E0E0E0] shadow-lg rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-6"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-[#1A1A2E] font-bold text-base mb-4">Add New Topic</h2>
        <div className="flex flex-col gap-3">
          <input
            placeholder="Topic name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            className="bg-gray-50 border border-[#E0E0E0] text-[#1A1A2E] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E8453C]"
            autoFocus
          />
          <div className="flex gap-2 items-center">
            <input
              placeholder="Icon"
              value={form.icon}
              onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
              className="bg-gray-50 border border-[#E0E0E0] text-[#1A1A2E] rounded-lg px-3 py-2 text-sm w-16 text-center focus:outline-none"
            />
            <input
              type="color"
              value={form.color}
              onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
              className="w-9 h-9 rounded cursor-pointer border-0"
            />
            <span className="text-xs text-gray-500">Color</span>
          </div>
          <div className="flex gap-2 justify-end mt-1">
            <Btn onClick={onClose} variant="ghost">Cancel</Btn>
            <Btn onClick={handleCreate} variant="success" disabled={!form.name.trim()}>Create</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TopicListRow ──────────────────────────────────────────────────────────────
function TopicListRow({ topic: t, selected, progress, onClick }) {
  const { color: healthColor, label: healthLabel } = healthBadge(t);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-l-[3px] transition-colors
        ${selected
          ? 'border-l-[#E8453C] bg-[#E8453C]/5'
          : 'border-l-transparent hover:bg-gray-50'}`}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-base shrink-0">{t.icon}</span>
        <span className={`text-sm font-semibold flex-1 min-w-0 truncate ${selected ? 'text-[#1A1A2E]' : 'text-gray-700'}`}>
          {t.name}
        </span>
        <Badge color={t.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
          {t.is_active ? 'On' : 'Off'}
        </Badge>
      </div>
      <div className="flex items-center gap-1.5 pl-7">
        <Badge color={healthColor}>{healthLabel}</Badge>
        <span className="text-xs text-gray-400">{t.question_count}q · {t.games_played}🎮</span>
      </div>
      {progress && (
        <div className="mt-1.5 pl-7">
          <div className="bg-gray-200 rounded-full h-1 overflow-hidden">
            <div
              className="h-full bg-cyan-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.round((progress.inserted / progress.total) * 100))}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}

// ── TopicDetail ───────────────────────────────────────────────────────────────
function TopicDetail({ topic, token, progressMap, onTopicDeleted }) {
  const [questions, setQuestions] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const { addToast } = useToastStore();
  const t = topic;

  async function loadQuestions() {
    try {
      const data = await adminFetch(`/admin/topics/${t.id}/questions`, {}, token);
      setQuestions(data);
    } catch (err) {
      addToast(err.message, 'error');
      setQuestions([]);
    }
  }

  useEffect(() => {
    setQuestions(null);
    loadQuestions();
    setEditing(false);
    setEditForm({});
  }, [t.id]);

  useEffect(() => {
    function onQuestionsUpdated({ topicId }) {
      if (topicId === t.id) loadQuestions();
    }
    function onTopicReady({ topicId }) {
      if (topicId === t.id) loadQuestions();
    }
    socket.on('admin_questions_updated', onQuestionsUpdated);
    socket.on('topic_ready', onTopicReady);
    return () => {
      socket.off('admin_questions_updated', onQuestionsUpdated);
      socket.off('topic_ready', onTopicReady);
    };
  }, [t.id]);

  async function saveEdit() {
    try {
      await adminFetch(`/admin/topics/${t.id}`, { method: 'PUT', body: editForm }, token);
      addToast('Topic updated', 'success');
      setEditing(false);
      setEditForm({});
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function toggleActive() {
    try {
      await adminFetch(`/admin/topics/${t.id}`, { method: 'PUT', body: { is_active: !t.is_active } }, token);
      addToast(t.is_active ? `"${t.name}" hidden` : `"${t.name}" restored`, t.is_active ? 'warn' : 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function generate() {
    try {
      await adminFetch(`/admin/topics/${t.id}/generate`, { method: 'POST' }, token);
      addToast(`Generation started for "${t.name}"`, 'info');
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function regenerate() {
    try {
      await adminFetch(`/admin/topics/${t.id}/regenerate`, { method: 'POST' }, token);
      addToast(`Regeneration started for "${t.name}"`, 'info');
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function clearQuestions() {
    try {
      const data = await adminFetch(`/admin/topics/${t.id}/questions`, { method: 'DELETE' }, token);
      addToast(`Deleted ${data.deleted} questions from "${t.name}"`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function deleteTopic() {
    try {
      await adminFetch(`/admin/topics/${t.id}`, { method: 'DELETE' }, token);
      addToast(`Deleted "${t.name}" and all its data`, 'success');
      onTopicDeleted(t.id);
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function toggleQuestion(q) {
    try {
      await adminFetch(`/admin/questions/${q.id}`, { method: 'PUT', body: { is_active: !q.is_active } }, token);
      setQuestions(qs => qs.map(x => x.id === q.id ? { ...x, is_active: !q.is_active } : x));
      addToast(q.is_active ? 'Question disabled' : 'Question enabled', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function deleteQuestion(q) {
    try {
      await adminFetch(`/admin/questions/${q.id}`, { method: 'DELETE' }, token);
      setQuestions(qs => qs.filter(x => x.id !== q.id));
      addToast('Question deleted', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  const { color: healthColor, label: healthLabel } = healthBadge(t);
  const progress = progressMap[t.id];
  const activeQs = questions ? questions.filter(q => q.is_active).length : 0;
  const inactiveQs = questions ? questions.length - activeQs : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top info / edit section */}
      <div className="bg-white border-b border-[#E0E0E0] p-4 shrink-0">
        {editing ? (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={editForm.name ?? t.name}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Name"
              className="bg-gray-50 border border-[#E0E0E0] text-[#1A1A2E] rounded-lg px-3 py-2 text-sm flex-1 min-w-32 focus:outline-none focus:border-[#E8453C]"
            />
            <input
              value={editForm.icon ?? t.icon}
              onChange={e => setEditForm(f => ({ ...f, icon: e.target.value }))}
              className="bg-gray-50 border border-[#E0E0E0] text-[#1A1A2E] rounded-lg px-2 py-2 text-sm w-12 text-center focus:outline-none"
            />
            <input
              type="color"
              value={editForm.color ?? t.color}
              onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))}
              className="w-8 h-8 rounded cursor-pointer border-0"
            />
            <Btn onClick={saveEdit} variant="success">Save</Btn>
            <Btn onClick={() => { setEditing(false); setEditForm({}); }} variant="ghost">Cancel</Btn>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ background: `${t.color}22`, border: `2px solid ${t.color}44` }}
            >
              {t.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[#1A1A2E] font-bold text-base leading-tight">{t.name}</h2>
                <button
                  onClick={() => { setEditing(true); setEditForm({}); }}
                  className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <Pencil size={13} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <Badge color={
                  t.source === 'seed' ? 'bg-purple-100 text-purple-700'
                  : t.source === 'admin' ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-100 text-gray-600'
                }>
                  {t.source}
                </Badge>
                <Badge color={t.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                  {t.is_active ? 'Active' : 'Hidden'}
                </Badge>
                <Badge color={healthColor}>{healthLabel}</Badge>
                <span className="text-xs text-gray-400">{t.question_count}q · {t.games_played} games</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                Created {new Date(t.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        )}

        {/* Generation progress bar */}
        {progress && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Generating questions…</span>
              <span className="text-xs text-cyan-600 font-mono">{progress.inserted}/{progress.total}</span>
            </div>
            <div className="bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((progress.inserted / progress.total) * 100))}%` }}
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          <Btn onClick={generate} variant="primary"><Zap size={12} /> Generate</Btn>
          <Btn onClick={regenerate} variant="ghost"><RefreshCw size={12} /> Regen</Btn>
          <Btn onClick={clearQuestions} variant="danger"><Trash size={12} /> Clear Qs</Btn>
          <Btn onClick={toggleActive} variant={t.is_active ? 'ghost' : 'success'}>
            {t.is_active ? <><EyeOff size={12} /> Deactivate</> : <><Eye size={12} /> Activate</>}
          </Btn>
          <Btn onClick={deleteTopic} variant="danger"><Trash2 size={12} /> Delete</Btn>
        </div>
      </div>

      {/* Questions header */}
      <div className="px-4 py-2 bg-gray-50 border-b border-[#E0E0E0] flex items-center justify-between shrink-0">
        <span className="text-xs font-bold text-gray-600">
          {questions === null ? 'Loading…' : `${questions.length} questions`}
        </span>
        {questions !== null && questions.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge color="bg-green-100 text-green-700">{activeQs} active</Badge>
            {inactiveQs > 0 && <Badge color="bg-red-100 text-red-700">{inactiveQs} disabled</Badge>}
          </div>
        )}
      </div>

      {/* Questions list */}
      <div className="flex-1 overflow-y-auto p-3">
        {questions === null ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : questions.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No questions yet.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {questions.map((q, i) => (
              <div
                key={q.id}
                className={`rounded-lg px-3 py-2 text-xs border ${
                  q.is_active
                    ? 'bg-white border-[#E0E0E0]'
                    : 'bg-gray-50 border-gray-100 opacity-50'
                }`}
              >
                <div className="flex items-start gap-2 mb-1">
                  <span className="text-gray-400 font-mono w-5 shrink-0 leading-snug">{i + 1}</span>
                  <p className="text-gray-700 leading-snug flex-1">{q.question_text}</p>
                </div>
                <div className="flex items-center gap-1.5 pl-7">
                  <p className="text-green-600 flex-1 min-w-0 truncate">✓ {q.correct_answer}</p>
                  <Badge color={
                    q.difficulty === 3 ? 'bg-red-100 text-red-700'
                    : q.difficulty === 2 ? 'bg-amber-100 text-amber-700'
                    : 'bg-green-100 text-green-700'
                  }>
                    {q.difficulty === 3 ? 'Hard' : q.difficulty === 2 ? 'Med' : 'Easy'}
                  </Badge>
                  <Btn onClick={() => toggleQuestion(q)} variant={q.is_active ? 'danger' : 'success'}>
                    {q.is_active ? 'Disable' : 'Enable'}
                  </Btn>
                  <Btn onClick={() => deleteQuestion(q)} variant="danger">Del</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Topics ───────────────────────────────────────────────────────────────
const TOPICS_PAGE_SIZE = 20;

export default function TopicsTab({ token }) {
  const [topics, setTopics] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');   // '' = all, 'custom', 'seed', 'admin', 'system'
  const [adding, setAdding] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [progressMap, setProgressMap] = useState({});
  const { addToast } = useToastStore();
  const searchTimerRef = useRef(null);

  const selected = topics.find(t => t.id === selectedId) ?? null;
  const totalPages = Math.max(1, Math.ceil(total / TOPICS_PAGE_SIZE));

  async function load(pageNum, searchTerm, sourceTerm) {
    setLoading(true);
    try {
      const offset = (pageNum - 1) * TOPICS_PAGE_SIZE;
      const qs = new URLSearchParams({ limit: TOPICS_PAGE_SIZE, offset });
      if (searchTerm) qs.set('search', searchTerm);
      if (sourceTerm) qs.set('source', sourceTerm);
      const data = await adminFetch(`/admin/topics?${qs}`, {}, token);
      setTopics(data.topics);
      setTotal(data.total);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setPage(1);
      load(1, val, source);
    }, 300);
  }

  function handleSourceChange(e) {
    const val = e.target.value;
    setSource(val);
    setPage(1);
    load(1, search, val);
  }

  function goToPage(p) {
    setPage(p);
    load(p, search, source);
  }

  useEffect(() => {
    load(1, '', '');

    function onProgress({ topicId, inserted, total: tot }) {
      setProgressMap(m => ({ ...m, [topicId]: { inserted, total: tot } }));
    }
    function onReady({ topicId }) {
      setProgressMap(m => { const n = { ...m }; delete n[topicId]; return n; });
      setTopics(ts => ts.map(t => t.id === topicId ? { ...t, questions_ready: true } : t));
    }
    function onTopicUpdated(data) {
      setTopics(prev => {
        const idx = prev.findIndex(t => t.id === data.id);
        if (idx < 0) return prev; // not on current page
        const next = [...prev];
        next[idx] = { ...next[idx], ...data };
        return next;
      });
    }
    function onTopicDeleted({ id }) {
      setTopics(prev => prev.filter(t => t.id !== id));
      setTotal(prev => prev - 1);
      setSelectedId(prev => prev === id ? null : prev);
    }

    socket.on('generation_progress', onProgress);
    socket.on('topic_ready', onReady);
    socket.on('admin_topic_updated', onTopicUpdated);
    socket.on('admin_topic_deleted', onTopicDeleted);
    return () => {
      socket.off('generation_progress', onProgress);
      socket.off('topic_ready', onReady);
      socket.off('admin_topic_updated', onTopicUpdated);
      socket.off('admin_topic_deleted', onTopicDeleted);
    };
  }, []);

  if (loading && topics.length === 0) return (
    <div className="flex items-center justify-center h-64">
      <Spinner />
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row" style={{ height: 'calc(100dvh - 72px)' }}>
      {/* Left panel — full width on mobile, 30% on desktop */}
      <div className={`border-r border-[#E0E0E0] flex flex-col bg-white
        md:w-[30%] md:min-w-[200px]
        ${selectedId ? 'hidden md:flex' : 'flex w-full'}`}>
        <div className="p-3 border-b border-[#E0E0E0] flex gap-2">
          <Btn variant="coral" onClick={() => setBatchOpen(true)}>Batch</Btn>
          <Btn variant="primary" onClick={() => setAdding(true)}>+ Topic</Btn>
        </div>
        <div className="px-3 py-2 border-b border-[#E0E0E0] flex gap-2">
          <input
            placeholder="Search topics…"
            value={search}
            onChange={handleSearchChange}
            className="flex-1 bg-gray-50 border border-[#E0E0E0] rounded-lg px-3 py-1.5 text-sm text-[#1A1A2E] placeholder-gray-400 focus:outline-none focus:border-[#E8453C]"
          />
          <select
            value={source}
            onChange={handleSourceChange}
            className="bg-gray-50 border border-[#E0E0E0] rounded-lg px-2 py-1.5 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#E8453C] cursor-pointer"
          >
            <option value="">All</option>
            <option value="custom">User</option>
            <option value="seed">Seed</option>
            <option value="admin">Admin</option>
            <option value="system">System</option>
          </select>
        </div>
        <div className="px-3 py-1.5 border-b border-[#E0E0E0] bg-gray-50">
          <span className="text-xs text-gray-400">{total} topic{total !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Spinner /></div>
          ) : (
            <>
              {topics.map(t => (
                <TopicListRow
                  key={t.id}
                  topic={t}
                  selected={t.id === selectedId}
                  progress={progressMap[t.id]}
                  onClick={() => setSelectedId(t.id)}
                />
              ))}
              {topics.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-8">No topics found.</p>
              )}
            </>
          )}
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-[#E0E0E0] px-3 py-2 flex items-center justify-between bg-white">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 1}
              className="text-sm px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-[#1A1A2E]"
            >
              ‹ Prev
            </button>
            <span className="text-xs text-gray-500">{page} / {totalPages}</span>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="text-sm px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-[#1A1A2E]"
            >
              Next ›
            </button>
          </div>
        )}
      </div>

      {/* Right panel — full width on mobile, 70% on desktop */}
      <div className={`flex-1 overflow-hidden flex flex-col bg-[#F8F9FA]
        ${!selectedId ? 'hidden md:flex' : 'flex'}`}>
        {selected ? (
          <>
            {/* Mobile back button */}
            <div className="md:hidden px-3 py-2 border-b border-[#E0E0E0] bg-white">
              <button
                onClick={() => setSelectedId(null)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1A1A2E] font-semibold"
              >
                ‹ All Topics
              </button>
            </div>
            <TopicDetail
              topic={selected}
              token={token}
              progressMap={progressMap}
              onTopicDeleted={id => {
                setTopics(prev => prev.filter(t => t.id !== id));
                setTotal(prev => prev - 1);
                setSelectedId(null);
              }}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Select a topic to view details
          </div>
        )}
      </div>

      {adding && <AddTopicModal token={token} onClose={(refresh) => { setAdding(false); if (refresh) load(page, search, source); }} />}
      {batchOpen && (
        <BatchTopicCreator
          token={token}
          existingTopics={topics}
          onClose={() => setBatchOpen(false)}
        />
      )}
    </div>
  );
}
