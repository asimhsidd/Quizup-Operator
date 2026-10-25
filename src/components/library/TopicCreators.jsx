// Library: add one topic, or many at once (one name per line). Each is created, filed
// under the selected category when there is one, and its questions start generating.
import { useState } from 'react';
import { adminFetch, Btn } from '../../lib/adminUtils.jsx';
import { useToastStore } from '../../lib/toastStore';

/** POST /admin/topics, then file it under categoryId (when given). Returns { id }. */
async function createTopic(token, body, categoryId) {
  const created = await adminFetch('/admin/topics', { method: 'POST', body }, token);
  if (categoryId && categoryId !== 'none') {
    await adminFetch(`/admin/topics/${created.id}/category`, { method: 'PATCH', body: { categoryId } }, token);
  }
  return created;
}

// ── Batch Topic Creator modal ─────────────────────────────────────────────────
const TOPIC_COLOURS = [
  '#E8453C','#9C6FE4','#3B82F6','#10B981','#F59E0B',
  '#EC4899','#06B6D4','#8B5CF6','#EF4444','#14B8A6',
  '#F97316','#6366F1','#22C55E','#A855F7','#0EA5E9',
];
function randomTopicColor() {
  return TOPIC_COLOURS[Math.floor(Math.random() * TOPIC_COLOURS.length)];
}

export function BatchTopicCreator({ token, categoryId, onClose }) {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState('input'); // 'input' | 'processing' | 'done'
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ created: 0, failed: 0, skipped: 0 });

  const delay = ms => new Promise(r => setTimeout(r, ms));

  const previewLines = [...new Set(
    text.split('\n').map(l => l.trim()).filter(Boolean)
  )];
  // The API refuses a name that already exists (409), which counts as skipped
  const annotated = previewLines.map(name => ({ name, willSkip: false }));
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
          return createTopic(token, { name: batchItem.name, color: randomTopicColor() }, categoryId);
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
      const created_topic = await createTopic(token, { name, color: randomTopicColor() }, categoryId);
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
                    <span className="text-gray-400"> · names that already exist are skipped</span>
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
export function AddTopicModal({ token, categoryId, onClose }) {
  const [form, setForm] = useState({ name: '', icon: '📚', color: '#6366f1' });
  const { addToast } = useToastStore();

  async function handleCreate() {
    if (!form.name.trim()) return;
    try {
      const result = await createTopic(token, form, categoryId);
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
