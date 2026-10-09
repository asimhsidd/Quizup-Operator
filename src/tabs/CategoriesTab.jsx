import { Fragment, useEffect, useState } from 'react';
import { Trash2, Pencil } from 'lucide-react';
import { adminFetch, Paginator, API } from '../lib/adminUtils.jsx';
import { BatchSeedTab } from './BotsTab.jsx';
import { socket } from '../lib/socket';

const FLAGGED_LIMIT = 20;

export default function CategoriesTab({ token }) {
  const [categories, setCategories]         = useState([]);
  const [uncategorised, setUncategorised]   = useState([]);
  const [loading, setLoading]               = useState(true);
  const [editId, setEditId]                 = useState(null);
  const [editFields, setEditFields]         = useState({});
  const [createForm, setCreateForm]         = useState({ name: '', parent_id: '', sort_order: 0 });
  const [creating, setCreating]             = useState(false);
  const [error, setError]                   = useState('');
  const [expandedRoots, setExpandedRoots]   = useState({});   // rootId → bool
  const [expandedSubs, setExpandedSubs]     = useState({});   // subId → bool
  const [subTopics, setSubTopics]           = useState({});   // subId → topic[]
  const [subLoading, setSubLoading]         = useState({});   // subId → bool
  // Validation state
  const [flagged, setFlagged]               = useState([]);   // flagged questions
  const [flaggedLoading, setFlaggedLoading] = useState(true);
  const [flaggedPage, setFlaggedPage]       = useState(0);
  const [flaggedTotal, setFlaggedTotal]     = useState(0);
  const [validating, setValidating]         = useState({});   // scopeId → { checked, total, flagged }
  const [validatedTopics, setValidatedTopics] = useState({}); // topicId → { ts, checked, flagged }
  const [validatedSubs, setValidatedSubs]     = useState({}); // subId → { ts, checked, flagged }
  const [dismissing, setDismissing]         = useState({});   // questionId → bool
  const [editingAnswer, setEditingAnswer]   = useState({});   // questionId → draft string

  async function load() {
    setLoading(true);
    try {
      const [cats, uncat] = await Promise.all([
        adminFetch('/admin/categories', {}, token),
        adminFetch('/admin/topics/uncategorised', {}, token),
      ]);
      setCategories(cats);
      setUncategorised(uncat);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function loadFlagged(p = flaggedPage) {
    setFlaggedLoading(true);
    try {
      const data = await adminFetch(`/admin/validation/flagged?limit=${FLAGGED_LIMIT}&offset=${p * FLAGGED_LIMIT}`, {}, token);
      setFlagged(data.rows ?? data);
      setFlaggedTotal(data.total ?? (Array.isArray(data) ? data.length : 0));
    } catch { /* non-fatal */ }
    setFlaggedLoading(false);
  }

  async function handleValidate(scopeType, scopeId) {
    const endpoint = scopeType === 'topic'
      ? `/admin/topics/${scopeId}/validate`
      : `/admin/categories/${scopeId}/validate`;
    try {
      await adminFetch(endpoint, { method: 'POST' }, token);
      setValidating(v => ({ ...v, [scopeId]: { checked: 0, total: null, flagged: 0 } }));
    } catch (e) { setError(e.message); }
  }

  async function handleValidationAction(questionId, action) {
    setDismissing(d => ({ ...d, [questionId]: true }));
    try {
      await adminFetch(`/admin/questions/${questionId}/validation`, { method: 'PATCH', body: { action } }, token);
      setFlagged(prev => prev.filter(q => q.id !== questionId));
      setFlaggedTotal(t => Math.max(0, t - 1));
    } catch (e) { setError(e.message); }
    setDismissing(d => ({ ...d, [questionId]: false }));
  }

  async function handleSaveAnswer(questionId) {
    const draft = editingAnswer[questionId]?.trim();
    if (!draft) return;
    setDismissing(d => ({ ...d, [questionId]: true }));
    try {
      await adminFetch(`/admin/questions/${questionId}/answer`, { method: 'PATCH', body: { correct_answer: draft } }, token);
      setFlagged(prev => prev.filter(q => q.id !== questionId));
      setFlaggedTotal(t => Math.max(0, t - 1));
      setEditingAnswer(e => { const n = { ...e }; delete n[questionId]; return n; });
    } catch (e) { setError(e.message); }
    setDismissing(d => ({ ...d, [questionId]: false }));
  }

  useEffect(() => {
    load();
    loadFlagged(0);

    function onProgress({ scope, checked, total, flagged: f }) {
      setValidating(v => ({ ...v, [scope]: { checked, total, flagged: f } }));
    }
    function onComplete({ scope, type, checked, flagged: f }) {
      setValidating(v => { const next = { ...v }; delete next[scope]; return next; });
      const result = { ts: new Date(), checked, flagged: f };
      if (type === 'topic') setValidatedTopics(v => ({ ...v, [scope]: result }));
      else                  setValidatedSubs(v => ({ ...v, [scope]: result }));
      if (f > 0) loadFlagged(0);
    }
    function onError({ scope, message }) {
      setValidating(v => {
        const next = { ...v };
        delete next[scope];
        return next;
      });
      setError(`Validation error: ${message}`);
    }

    socket.on('validation_progress', onProgress);
    socket.on('validation_complete', onComplete);
    socket.on('validation_error',    onError);
    return () => {
      socket.off('validation_progress', onProgress);
      socket.off('validation_complete', onComplete);
      socket.off('validation_error',    onError);
    };
  }, []);

  useEffect(() => {
    loadFlagged(flaggedPage);
  }, [flaggedPage]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await adminFetch('/admin/categories', { method: 'POST', body: createForm }, token);
      setCreateForm({ name: '', parent_id: '', sort_order: 0 });
      await load();
    } catch (e) { setError(e.message); }
    setCreating(false);
  }

  async function handleEdit(id) {
    setError('');
    try {
      await adminFetch(`/admin/categories/${id}`, { method: 'PATCH', body: editFields }, token);
      setEditId(null);
      setEditFields({});
      await load();
    } catch (e) { setError(e.message); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this category?')) return;
    setError('');
    try {
      await adminFetch(`/admin/categories/${id}`, { method: 'DELETE' }, token);
      await load();
    } catch (e) { setError(e.message); }
  }

  async function handleAssign(topicId, categoryId) {
    setError('');
    try {
      await adminFetch(`/admin/topics/${topicId}/category`, { method: 'PATCH', body: { categoryId } }, token);
      setUncategorised(prev => prev.filter(t => t.id !== topicId));
      adminFetch('/admin/categories', {}, token).then(cats => setCategories(cats)).catch(() => {});
    } catch (e) { setError(e.message); }
  }

  async function handleToggle(id, enabled) {
    // Optimistic update
    setCategories(prev => prev.map(c => c.id === id ? { ...c, is_active: enabled } : c));
    try {
      await adminFetch(`/admin/categories/${id}`, { method: 'PATCH', body: { is_active: enabled } }, token);
    } catch (e) {
      setError(e.message);
      setCategories(prev => prev.map(c => c.id === id ? { ...c, is_active: !enabled } : c));
    }
  }

  async function toggleSub(subId) {
    const opening = !expandedSubs[subId];
    setExpandedSubs(x => ({ ...x, [subId]: opening }));
    if (opening && !subTopics[subId]) {
      setSubLoading(x => ({ ...x, [subId]: true }));
      try {
        const res = await fetch(`${API}/categories/${subId}/topics`);
        const data = await res.json();
        setSubTopics(x => ({ ...x, [subId]: Array.isArray(data) ? data : [] }));
      } catch { setSubTopics(x => ({ ...x, [subId]: [] })); }
      setSubLoading(x => ({ ...x, [subId]: false }));
    }
  }

  function fmtValidated(ts) {
    if (!ts) return null;
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000)   return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  const roots  = categories.filter(c => !c.parent_id);
  const subsOf = (id) => categories.filter(c => c.parent_id === id);
  // Root total = sum of its sub-category topic counts (or own count if no subs)
  const rootTotal = (root) => {
    const subs = subsOf(root.id);
    return subs.length > 0 ? subs.reduce((s, c) => s + (c.topic_count || 0), 0) : (root.topic_count || 0);
  };
  const rootOptions = roots.filter(r => r.name !== 'Others');

  if (loading) return <p className="text-gray-500 py-8 text-center">Loading...</p>;

  return (
    <div className="space-y-6">
      {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {/* Flagged questions */}
      {(flaggedLoading || flagged.length > 0 || flaggedTotal > 0) && (
        <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-100 bg-amber-50 flex items-center justify-between">
            <h3 className="font-bold text-sm text-amber-800">
              Flagged Questions {!flaggedLoading && `(${flaggedTotal})`}
            </h3>
            <span className="text-xs text-amber-600">Review and dismiss false positives or deactivate bad questions</span>
          </div>
          {flaggedLoading ? (
            <p className="text-xs text-gray-400 px-4 py-3">Loading…</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-[#E0E0E0]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 w-[30%]">Question</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 w-[18%]">Correct Answer</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 w-[22%]">Gemini Answer</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 w-[14%]">Topic</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 w-[16%]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F5F5]">
                    {flagged.map(q => (
                      <tr key={q.id} className="hover:bg-amber-50/30">
                        <td className="px-3 py-2 text-gray-700 leading-snug">{q.question_text}</td>
                        <td className="px-3 py-2">
                          {editingAnswer[q.id] !== undefined ? (
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus
                                value={editingAnswer[q.id]}
                                onChange={e => setEditingAnswer(v => ({ ...v, [q.id]: e.target.value }))}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveAnswer(q.id);
                                  if (e.key === 'Escape') setEditingAnswer(v => { const n = { ...v }; delete n[q.id]; return n; });
                                }}
                                className="border border-blue-300 rounded px-1.5 py-0.5 text-xs w-36 focus:outline-none focus:border-blue-500"
                              />
                              <button
                                disabled={dismissing[q.id]}
                                onClick={() => handleSaveAnswer(q.id)}
                                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 disabled:opacity-40"
                              >Save</button>
                              <button
                                onClick={() => setEditingAnswer(v => { const n = { ...v }; delete n[q.id]; return n; })}
                                className="text-[10px] text-gray-400 hover:text-gray-600"
                              >✕</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 group">
                              <span className="font-medium text-[#1A1A2E]">{q.correct_answer}</span>
                              <button
                                onClick={() => setEditingAnswer(v => ({ ...v, [q.id]: q.validation_note ?? q.correct_answer }))}
                                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity"
                                title="Edit answer"
                              ><Pencil size={10} /></button>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-amber-700 italic">{q.validation_note ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{q.topic_name}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1.5">
                            <button
                              disabled={dismissing[q.id]}
                              onClick={() => handleValidationAction(q.id, 'dismiss')}
                              className="px-2 py-1 rounded text-[10px] font-semibold bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-40"
                            >
                              ✓ Valid
                            </button>
                            <button
                              disabled={dismissing[q.id]}
                              onClick={() => handleValidationAction(q.id, 'deactivate')}
                              className="px-2 py-1 rounded text-[10px] font-semibold bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-40"
                            >
                              Deactivate
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginator
                page={flaggedPage}
                total={flaggedTotal}
                limit={FLAGGED_LIMIT}
                onPage={p => setFlaggedPage(p)}
              />
            </>
          )}
        </div>
      )}

      {/* Create form */}
      <div className="bg-white rounded-xl border border-[#E0E0E0] p-4">
        <h3 className="font-bold text-sm mb-3">Add Category</h3>
        <form onSubmit={handleCreate} className="flex flex-wrap gap-2 items-end">
          <input
            placeholder="Name"
            value={createForm.name}
            onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-40 focus:outline-none focus:border-[#E8453C]"
            required
          />
          <select
            value={createForm.parent_id}
            onChange={e => setCreateForm(f => ({ ...f, parent_id: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#E8453C]"
          >
            <option value="">None — root category</option>
            {rootOptions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input
            type="number"
            placeholder="Order"
            value={createForm.sort_order}
            onChange={e => setCreateForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-20 focus:outline-none focus:border-[#E8453C]"
          />
          <button type="submit" disabled={creating} className="bg-[#E8453C] text-white font-bold text-sm px-4 py-1.5 rounded-lg disabled:opacity-50">
            {creating ? '...' : 'Add'}
          </button>
        </form>
      </div>

      {/* Batch seed topics */}
      <BatchSeedTab token={token} />

      {/* Category tree */}
      <div className="bg-white rounded-xl border border-[#E0E0E0] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E0E0E0]">
          <h3 className="font-bold text-sm">Categories ({roots.length} roots · {categories.filter(c => c.parent_id).length} subs)</h3>
        </div>
        <div className="divide-y divide-[#F0F0F0]">
          {roots.map(root => (
            <Fragment key={root.id}>
              {/* ── Root row ── */}
              <div
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${!root.is_active ? 'opacity-50' : ''}`}
                onClick={() => editId !== root.id && setExpandedRoots(x => ({ ...x, [root.id]: !x[root.id] }))}
              >
                <span className="text-gray-400 text-xs w-3">{expandedRoots[root.id] ? '▼' : '▶'}</span>
                {editId === root.id ? (
                  <div className="flex items-center gap-2 flex-1 flex-wrap" onClick={e => e.stopPropagation()}>
                    <input defaultValue={root.name} onChange={e => setEditFields(f => ({ ...f, name: e.target.value }))} className="border border-gray-200 rounded px-2 py-1 text-sm w-32 focus:outline-none" />
                    <input type="number" defaultValue={root.sort_order} onChange={e => setEditFields(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} className="border border-gray-200 rounded px-2 py-1 text-sm w-16 focus:outline-none" />
                    <button onClick={() => handleEdit(root.id)} className="text-xs font-bold text-green-600 hover:text-green-700">Save</button>
                    <button onClick={() => { setEditId(null); setEditFields({}); }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                  </div>
                ) : (
                  <span className="flex-1 font-semibold text-sm">{root.name}</span>
                )}
                <span className="text-xs text-gray-400">{rootTotal(root)} topics</span>
                {editId !== root.id && (
                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <label className="flex items-center gap-1 cursor-pointer select-none" title="Enabled in game">
                      <input
                        type="checkbox"
                        checked={root.is_active}
                        onChange={e => handleToggle(root.id, e.target.checked)}
                        className="accent-[#E8453C] w-3.5 h-3.5"
                      />
                      <span className="text-[10px] text-gray-400">Enabled</span>
                    </label>
                    <button onClick={() => { setEditId(root.id); setEditFields({}); }} className="text-gray-400 hover:text-gray-700"><Pencil size={13} /></button>
                    {rootTotal(root) === 0 && subsOf(root.id).length === 0 && (
                      <button onClick={() => handleDelete(root.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                    )}
                  </div>
                )}
              </div>

              {/* ── Sub-category rows (shown when root is expanded) ── */}
              {expandedRoots[root.id] && subsOf(root.id).map(sub => (
                <Fragment key={sub.id}>
                  <div
                    className={`flex items-center gap-3 pl-9 pr-4 py-2 bg-gray-50/70 cursor-pointer hover:bg-gray-100/70 transition-colors ${!sub.is_active ? 'opacity-50' : ''}`}
                    onClick={() => editId !== sub.id && toggleSub(sub.id)}
                  >
                    <span className="text-gray-400 text-[10px] w-3">{expandedSubs[sub.id] ? '▼' : '▶'}</span>
                    {editId === sub.id ? (
                      <div className="flex items-center gap-2 flex-1 flex-wrap" onClick={e => e.stopPropagation()}>
                        <input defaultValue={sub.name} onChange={e => setEditFields(f => ({ ...f, name: e.target.value }))} className="border border-gray-200 rounded px-2 py-1 text-xs w-32 focus:outline-none" />
                        <button onClick={() => handleEdit(sub.id)} className="text-xs font-bold text-green-600">Save</button>
                        <button onClick={() => { setEditId(null); setEditFields({}); }} className="text-xs text-gray-400">Cancel</button>
                      </div>
                    ) : (
                      <span className="flex-1 text-xs text-gray-700">{sub.name}</span>
                    )}
                    <span className="text-[10px] text-gray-500 font-medium">{sub.topic_count} topics</span>
                    {editId !== sub.id && (
                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        {validating[sub.id] ? (
                          <span className="text-[10px] text-blue-600 font-mono whitespace-nowrap">
                            {validating[sub.id].total != null
                              ? `${validating[sub.id].checked}/${validating[sub.id].total}`
                              : 'starting…'}
                          </span>
                        ) : (() => {
                          const done = validatedSubs[sub.id];
                          return (
                            <span className="flex items-center gap-1">
                              {done && (
                                <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                  {fmtValidated(done.ts)} · {done.flagged > 0 ? <span className="text-amber-600">{done.flagged} flagged</span> : '✓'}
                                </span>
                              )}
                              <button
                                onClick={() => handleValidate('category', sub.id)}
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 whitespace-nowrap"
                              >
                                {done ? 'Re-validate' : 'Validate'}
                              </button>
                            </span>
                          );
                        })()}
                        <label className="flex items-center gap-1 cursor-pointer select-none" title="Enabled in game">
                          <input
                            type="checkbox"
                            checked={sub.is_active}
                            onChange={e => handleToggle(sub.id, e.target.checked)}
                            className="accent-[#E8453C] w-3 h-3"
                          />
                          <span className="text-[10px] text-gray-400">Enabled</span>
                        </label>
                        <button onClick={() => { setEditId(sub.id); setEditFields({}); }} className="text-gray-400 hover:text-gray-700"><Pencil size={12} /></button>
                        {sub.topic_count === 0 && (
                          <button onClick={() => handleDelete(sub.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={12} /></button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Topics drawer ── */}
                  {expandedSubs[sub.id] && (
                    <div className="bg-white border-l-2 border-[#E8453C]/20 ml-12 divide-y divide-[#F5F5F5]">
                      {subLoading[sub.id] ? (
                        <p className="text-xs text-gray-400 px-4 py-2">Loading…</p>
                      ) : subTopics[sub.id]?.length === 0 ? (
                        <p className="text-xs text-gray-400 px-4 py-2 italic">No topics yet</p>
                      ) : subTopics[sub.id]?.map(topic => {
                        // In-session result takes precedence over DB value
                        const done     = validatedTopics[topic.id];
                        const lastTs   = done?.ts ?? topic.last_validated_at ?? null;
                        const inFlight = validating[topic.id];
                        return (
                          <div key={topic.id} className="flex items-center gap-2 px-4 py-1.5">
                            <span className="flex-1 text-xs text-gray-600">{topic.name}</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${topic.questions_ready ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                              {topic.question_count}q {topic.questions_ready ? '✓' : '⏳'}
                            </span>
                            {lastTs && !inFlight && (
                              <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                {fmtValidated(lastTs)}
                                {done?.flagged > 0 && <span className="text-amber-600 ml-1">{done.flagged} flagged</span>}
                              </span>
                            )}
                            {inFlight ? (
                              <span className="text-[10px] text-blue-600 font-mono whitespace-nowrap">
                                {inFlight.total != null
                                  ? `${inFlight.checked}/${inFlight.total}`
                                  : 'starting…'}
                              </span>
                            ) : (
                              <button
                                onClick={() => handleValidate('topic', topic.id)}
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 whitespace-nowrap"
                              >
                                {lastTs ? 'Re-validate' : 'Validate'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Fragment>
              ))}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Uncategorised topics */}
      {uncategorised.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E0E0E0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E0E0E0]">
            <h3 className="font-bold text-sm">Uncategorised Topics ({uncategorised.length})</h3>
          </div>
          <div className="divide-y divide-[#F0F0F0]">
            {uncategorised.map(topic => (
              <div key={topic.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex-1 text-sm font-medium">{topic.name}</span>
                <select
                  value=""
                  onChange={e => { if (e.target.value) handleAssign(topic.id, e.target.value); }}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#E8453C] max-w-[200px]"
                >
                  <option value="" disabled>Assign category…</option>
                  {roots.map(root => (
                    <optgroup key={root.id} label={root.name}>
                      {subsOf(root.id).length > 0
                        ? subsOf(root.id).map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)
                        : <option value={root.id}>{root.name}</option>
                      }
                    </optgroup>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
