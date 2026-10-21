import { useEffect, useRef, useState } from 'react';
import { jsonrepair } from 'jsonrepair';
import { useToastStore } from '../lib/toastStore';
import { socket } from '../lib/socket';
import { adminFetch, Btn, Spinner, Paginator } from '../lib/adminUtils.jsx';

// ── Timeline panel for a single generation log ────────────────────────────────
function TimelinePanel({ log }) {
  const isUser = log.triggered_by === 'user';

  const ref = (isUser && log.topic_created_at)
    ? new Date(log.topic_created_at)
    : log.api_called_at ? new Date(log.api_called_at) : null;

  function fmt(ts) {
    if (!ts) return null;
    return new Date(ts).toISOString().replace('T', ' ').slice(0, 23);
  }
  function delta(ts) {
    if (!ts || !ref) return null;
    const ms = new Date(ts) - ref;
    if (ms < 0) return null;
    return ms >= 1000 ? `+${(ms / 1000).toFixed(1)}s` : `+${ms}ms`;
  }

  const events = [
    (isUser && log.topic_created_at) ? {
      label: 'Topic requested',
      ts: log.topic_created_at,
      note: 'Player submitted the custom topic name',
    } : null,
    {
      label: 'API call sent',
      ts: log.api_called_at,
      note: `DeepSeek request dispatched · ${log.model}`,
    },
    {
      label: 'Response received',
      ts: log.api_responded_at,
      note: log.api_responded_at
        ? `${log.input_tokens?.toLocaleString()} in / ${log.output_tokens?.toLocaleString()} out tokens · $${Number(log.estimated_cost_usd).toFixed(5)}`
        : 'Waiting for API response…',
    },
    log.triggered_by === 'user' ? {
      label: 'First batch ready',
      ts: log.first_batch_at,
      note: 'First 7 questions inserted · topic_ready emitted · player enters game',
    } : null,
    {
      label: 'Generation complete',
      ts: log.completed_at,
      note: log.completed_at
        ? `${log.questions_generated} total questions inserted into DB`
        : log.success === false ? 'Failed — see error below' : 'In progress…',
    },
  ].filter(Boolean);

  return (
    <div className="py-2">
      <div className="flex flex-col">
        {events.map((ev, i) => {
          const reached = !!ev.ts;
          const isLast = i === events.length - 1;
          return (
            <div key={i} className="flex items-stretch gap-3">
              <div className="flex flex-col items-center" style={{ minWidth: 16 }}>
                <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${reached ? 'bg-cyan-500' : 'bg-gray-300'}`} />
                {!isLast && <div className="w-px flex-1 bg-gray-200 mt-1" />}
              </div>
              <div className="pb-4 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className={`text-xs font-semibold ${reached ? 'text-[#1A1A2E]' : 'text-gray-400'}`}>
                    {ev.label}
                  </span>
                  {reached && delta(ev.ts) && (
                    <span className="text-cyan-600 text-xs font-mono">{delta(ev.ts)}</span>
                  )}
                </div>
                {reached
                  ? <div className="text-gray-500 font-mono text-xs mt-0.5">{fmt(ev.ts)}</div>
                  : <div className="text-red-500 text-xs mt-0.5">— not reached</div>
                }
                <div className="text-gray-400 text-xs mt-0.5">{ev.note}</div>
              </div>
            </div>
          );
        })}
      </div>

      {!log.success && log.error_message && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-600 text-xs font-semibold mb-1">Error</div>
          <div className="text-red-700 text-xs font-mono break-all">{log.error_message}</div>
        </div>
      )}

      {log.prompt && (
        <details className="mt-2">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
            Raw prompt ({log.prompt.length} chars)
          </summary>
          <pre className="mt-1 p-3 bg-gray-100 border border-[#E0E0E0] rounded-lg text-[11px] text-gray-700 font-mono whitespace-pre-wrap break-words overflow-x-auto max-h-64 overflow-y-auto">
            {log.prompt}
          </pre>
        </details>
      )}
    </div>
  );
}

// ── Raw Response Editor Modal ─────────────────────────────────────────────────
function RawResponseModal({ logId, topicName, initialRaw, token, onClose, onSuccess, onIgnore }) {
  const [raw, setRaw] = useState(initialRaw || '');
  const [saving, setSaving] = useState(false);
  const [parseError, setParseError] = useState('');
  const [lintError, setLintError] = useState('');
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const textareaRef = useRef(null);
  const gutterRef = useRef(null);
  const { addToast } = useToastStore();

  function clean(str) {
    return str.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '');
  }

  function runLint(str) {
    if (!str.trim()) { setLintError(''); return; }
    try {
      JSON.parse(clean(str));
      setLintError('');
    } catch (e) {
      // Chrome gives "at position N"; compute line+col from that offset
      let msg = e.message;
      const posMatch = msg.match(/at position (\d+)/);
      if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        const before = clean(str).slice(0, pos);
        const lines = before.split('\n');
        const line = lines.length;
        const col = lines[lines.length - 1].length + 1;
        msg = `Line ${line}, Col ${col}: ${msg}`;
      }
      setLintError(msg);
    }
  }

  function syncGutter() {
    if (gutterRef.current && textareaRef.current)
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
  }

  // Run lint on initial value so broken JSON isn't shown as valid on open
  useEffect(() => { runLint(raw); }, []);

  // Track cursor position via document.selectionchange — the only event that
  // fires reliably for every cursor move (click, arrow key, etc.) in a textarea.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    function track() {
      if (document.activeElement !== ta) return;
      const before = ta.value.slice(0, ta.selectionStart);
      const lines = before.split('\n');
      setCursorPos({ line: lines.length, col: lines[lines.length - 1].length + 1 });
    }
    document.addEventListener('selectionchange', track);
    return () => document.removeEventListener('selectionchange', track);
  }, []);

  // Client-side preview of how many valid questions would be inserted
  const preview = (() => {
    try {
      const arr = JSON.parse(clean(raw));
      if (!Array.isArray(arr)) return null;
      const valid = arr.filter(q => q.question && q.correct_answer && Array.isArray(q.wrong_answers) && q.wrong_answers.length === 3);
      return { total: arr.length, valid: valid.length };
    } catch {
      return null;
    }
  })();

  function handleAutoFix() {
    try {
      const repaired = jsonrepair(clean(raw));
      // Pretty-print so the admin can see the corrected structure
      const pretty = JSON.stringify(JSON.parse(repaired), null, 2);
      setRaw(pretty);
      setParseError('');
      runLint(pretty);
    } catch (e) {
      setParseError(`Auto-fix failed: ${e.message}`);
    }
  }

  async function handleRetry() {
    setParseError('');
    setSaving(true);
    try {
      const data = await adminFetch(`/admin/ai-logs/${logId}/retry`, { method: 'POST', body: { raw } }, token);
      addToast(`Inserted ${data.inserted} questions for "${topicName}"`, 'success');
      onSuccess(logId);
      onClose();
    } catch (err) {
      setParseError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E0E0E0]">
          <div>
            <h3 className="font-extrabold text-[#1A1A2E] text-base">Edit Raw Response</h3>
            <p className="text-xs text-gray-500 mt-0.5">{topicName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-4 flex flex-col gap-3">
          <p className="text-xs text-gray-500">
            This is the manual fallback for a response that automatic AI repair could not resolve.
            Edit the JSON below, then click <strong>Validate &amp; insert</strong>.
          </p>
          {/* Editor: gutter + textarea */}
          {(() => {
            const lineCount = (raw || '').split('\n').length;
            const gutterW = Math.max(2, String(lineCount).length) * 9 + 20;
            return (
              <div
                className={`flex rounded-xl border overflow-hidden transition-colors ${lintError ? 'border-red-400' : 'border-[#E0E0E0]'}`}
                style={{ minHeight: 320 }}
              >
                {/* Line number gutter */}
                <div
                  ref={gutterRef}
                  className="shrink-0 overflow-hidden select-none"
                  style={{ width: gutterW, background: '#f0f0f5', borderRight: '1px solid #e0e0e0', paddingTop: 12 }}
                >
                  {Array.from({ length: lineCount }, (_, i) => (
                    <div
                      key={i}
                      className="font-mono text-right pr-2"
                      style={{ fontSize: 11, lineHeight: '1.25rem', color: '#aaa' }}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
                {/* Editable area */}
                <textarea
                  ref={textareaRef}
                  value={raw}
                  onChange={e => { setRaw(e.target.value); setParseError(''); runLint(e.target.value); }}
                  onScroll={syncGutter}
                  spellCheck={false}
                  className="flex-1 font-mono bg-gray-50 p-3 resize-none focus:outline-none"
                  style={{ fontSize: 12, lineHeight: '1.25rem' }}
                />
              </div>
            );
          })()}
          {/* Status bar: cursor position + validity */}
          <div className="flex items-center justify-between text-xs" style={{ color: '#aaa' }}>
            <span className={lintError ? 'text-red-500 font-semibold' : 'text-green-600 font-semibold'}>
              {lintError ? '✕ Invalid JSON' : raw.trim() ? '✓ Valid JSON' : ''}
            </span>
            <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          </div>
          {/* jsonlint live error */}
          {lintError && (
            <pre className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap">{lintError}</pre>
          )}
          {/* Live preview */}
          {!lintError && preview !== null && (
            <p className={`text-xs font-semibold ${preview.valid > 0 ? 'text-green-600' : 'text-amber-600'}`}>
              Preview: {preview.valid} valid / {preview.total} total objects
            </p>
          )}
          {parseError && (
            <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{parseError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-[#E0E0E0]">
          <div className="flex items-center gap-2">
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            {onIgnore && (
              <Btn variant="ghost" onClick={() => { onIgnore(logId); onClose(); }}>
                Ignore
              </Btn>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Btn
              variant="ghost"
              onClick={handleAutoFix}
              disabled={saving || !raw.trim()}
              title="Attempt automatic JSON repair using jsonrepair"
            >
              Auto-fix JSON
            </Btn>
            <Btn
              variant="primary"
              onClick={handleRetry}
              disabled={saving || !raw.trim() || !!lintError || (preview !== null && preview.valid === 0)}
            >
              {saving ? 'Inserting…' : `Validate & insert${preview?.valid > 0 ? ` (${preview.valid}q)` : ''}`}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Failed Topics Widget ──────────────────────────────────────────────────────
function FailedTopicsWidget({ token, onLogFixed }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ignoring, setIgnoring] = useState(null); // logId being ignored
  const [repairing, setRepairing] = useState(null); // logId being repaired by AI
  const { addToast } = useToastStore();

  async function load() {
    try {
      const data = await adminFetch('/admin/ai-logs/failed-topics', {}, token);
      setItems(data);
    } catch (err) {
      addToast('Failed to load failed topics: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    function onLogUpdated(log) {
      if (log.success === true || !log.raw_response) {
        setItems(prev => prev.filter(item => item.id !== log.id));
      }
    }
    socket.on('admin_log_updated', onLogUpdated);
    return () => socket.off('admin_log_updated', onLogUpdated);
  }, []);

  function handleFixed(logId) {
    setItems(prev => prev.filter(i => i.id !== logId));
    onLogFixed?.(logId);
  }

  async function handleIgnore(logId) {
    setIgnoring(logId);
    try {
      await adminFetch(`/admin/ai-logs/${logId}/ignore`, { method: 'POST' }, token);
      setItems(prev => prev.filter(i => i.id !== logId));
    } catch (err) {
      addToast('Ignore failed: ' + err.message, 'error');
    } finally {
      setIgnoring(null);
    }
  }

  async function handleAiRepair(item) {
    setRepairing(item.id);
    try {
      const data = await adminFetch(`/admin/ai-logs/${item.id}/repair`, { method: 'POST' }, token);
      handleFixed(item.id);
      addToast(`AI repaired and inserted ${data.inserted} questions for "${item.topic_name}"`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setRepairing(null);
    }
  }

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <>
      <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-red-600 text-sm font-extrabold">⚠ Automatic Repair Queue</span>
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">{items.length}</span>
        </div>
        <p className="text-xs text-red-600 mb-3">
          The backend repairs, validates and applies these without approval. Retry AI is only an optional immediate re-run.
        </p>
        <div className="flex flex-col gap-2">
          {items.map(item => (
            <div key={item.id} className="bg-white border border-red-100 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-sm text-[#1A1A2E] flex-1 min-w-0 truncate">{item.topic_name}</span>
              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">{item.triggered_by}</span>
              <span className="text-xs text-red-500 font-mono flex-1 min-w-0 truncate">{item.error_message}</span>
              <span className="text-gray-400 text-xs shrink-0">{new Date(item.created_at).toLocaleString()}</span>
              <Btn
                variant="ghost"
                disabled={ignoring === item.id}
                onClick={() => handleIgnore(item.id)}
              >
                {ignoring === item.id ? 'Ignoring…' : 'Ignore'}
              </Btn>
              <Btn
                variant="primary"
                disabled={repairing === item.id}
                onClick={() => handleAiRepair(item)}
              >
                {repairing === item.id ? 'AI repairing…' : 'Retry AI'}
              </Btn>
            </div>
          ))}
        </div>
      </div>

    </>
  );
}

// ── Tab: Logs ─────────────────────────────────────────────────────────────────
export default function AILogsTab({ token }) {
  const [logs, setLogs] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [flushConfirm, setFlushConfirm] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [flushAllConfirm, setFlushAllConfirm] = useState(false);
  const [flushingAll, setFlushingAll] = useState(false);
  const [editing, setEditing] = useState(null); // { logId, topicName, raw }
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const { addToast } = useToastStore();
  const LIMIT = 100;

  async function load(p = page) {
    setLoading(true);
    try {
      const data = await adminFetch(`/admin/ai-logs?limit=${LIMIT}&offset=${p * LIMIT}`, {}, token);
      setLogs(data.logs);
      setTotals(data.totals);
      setTotal(data.total ?? data.logs.length);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleFlush() {
    if (!flushConfirm) { setFlushConfirm(true); return; }
    setFlushing(true);
    try {
      const data = await adminFetch('/admin/ai-logs/flush', { method: 'POST' }, token);
      addToast(`Deleted ${data.flushed} log rows older than 30 days.`, 'success');
      setFlushConfirm(false);
      await load(0);
      setPage(0);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setFlushing(false);
    }
  }

  async function handleFlushAll() {
    if (!flushAllConfirm) { setFlushAllConfirm(true); return; }
    setFlushingAll(true);
    try {
      const data = await adminFetch('/admin/ai-logs/flush?all=true', { method: 'POST' }, token);
      addToast(`Deleted ${data.flushed} log rows (all logs flushed).`, 'success');
      setFlushAllConfirm(false);
      await load(0);
      setPage(0);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setFlushingAll(false);
    }
  }

  useEffect(() => {
    load(0);

    function onLogCreated(log) { setLogs(prev => [log, ...prev]); }
    function onLogUpdated(log) { setLogs(prev => prev.map(l => l.id === log.id ? log : l)); }
    socket.on('admin_log_created', onLogCreated);
    socket.on('admin_log_updated', onLogUpdated);
    return () => {
      socket.off('admin_log_created', onLogCreated);
      socket.off('admin_log_updated', onLogUpdated);
    };
  }, []);

  useEffect(() => {
    load(page);
  }, [page]);

  function handleLogFixed(logId) {
    // Row stays — socket admin_log_updated will refresh it; also update locally
    setLogs(prev => prev.map(l => l.id === logId ? { ...l, success: true, error_message: null, raw_response: null } : l));
  }

  if (loading && logs.length === 0) return <Spinner />;

  return (
    <div>
      <FailedTopicsWidget token={token} onLogFixed={handleLogFixed} />

      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-[#1A1A2E] font-bold text-lg">Generation Logs</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {flushConfirm && !flushing && (
            <span className="text-xs text-red-600 font-semibold">Prompt text will be erased — costing data kept. Sure?</span>
          )}
          <Btn
            onClick={handleFlush}
            disabled={flushing}
            variant={flushConfirm ? 'danger' : 'ghost'}
            className={flushConfirm ? 'bg-red-500 text-white hover:bg-red-600' : 'text-red-500 border border-red-300 hover:bg-red-50'}
          >
            {flushing ? 'Flushing…' : flushConfirm ? 'Confirm Flush' : 'Flush Logs'}
          </Btn>
          {flushConfirm && !flushing && (
            <Btn variant="ghost" onClick={() => setFlushConfirm(false)}>Cancel</Btn>
          )}
          {flushAllConfirm && !flushingAll && (
            <span className="text-xs text-red-600 font-semibold">This deletes ALL logs, not just &gt;30 days. Sure?</span>
          )}
          <Btn
            onClick={handleFlushAll}
            disabled={flushingAll}
            variant={flushAllConfirm ? 'danger' : 'ghost'}
          >
            {flushingAll ? 'Flushing All…' : flushAllConfirm ? 'Confirm Flush All' : 'Flush All Logs'}
          </Btn>
          {flushAllConfirm && !flushingAll && (
            <Btn variant="ghost" onClick={() => setFlushAllConfirm(false)}>Cancel</Btn>
          )}
        </div>
      </div>

      {/* Totals */}
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total calls',     value: totals.total_calls },
            { label: 'OK / Running / Failed', value: `${totals.successful_calls ?? 0} / ${totals.in_progress_calls ?? 0} / ${totals.failed_calls ?? 0}` },
            { label: 'Questions gen.',  value: totals.total_questions ?? 0 },
            { label: 'Est. cost (USD)', value: `$${Number(totals.total_cost_usd || 0).toFixed(4)}` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white border border-[#E0E0E0] shadow-sm rounded-xl p-4">
              <div className="text-gray-500 text-xs mb-1">{label}</div>
              <div className="text-[#1A1A2E] font-extrabold text-xl">{value}</div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <RawResponseModal
          logId={editing.logId}
          topicName={editing.topicName}
          initialRaw={editing.raw}
          token={token}
          onClose={() => setEditing(null)}
          onSuccess={handleLogFixed}
        />
      )}

      {/* Log list */}
      {logs.length === 0
        ? <p className="text-center text-gray-400 py-8">No logs yet.</p>
        : (
          <div className="flex flex-col gap-1">
            {logs.map(l => (
              <div key={l.id} className="rounded-xl overflow-hidden border border-[#E0E0E0] bg-white shadow-sm">
                {/* Summary row */}
                <div className="flex items-center gap-2 px-4 py-3 text-sm flex-wrap">
                  <span className="text-[#1A1A2E] font-semibold flex-1 min-w-0 truncate">{l.topic_name}</span>
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">{l.triggered_by}</span>
                  <span className="text-gray-500 text-xs">{l.questions_generated}q</span>
                  <span className="text-gray-400 text-xs font-mono hidden sm:inline">
                    {l.input_tokens?.toLocaleString()} / {l.output_tokens?.toLocaleString()} tok
                  </span>
                  <span className="text-amber-600 text-xs font-mono">
                    ${Number(l.estimated_cost_usd).toFixed(5)}
                  </span>
                  {l.success === null || l.success === undefined
                    ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Running</span>
                    : l.success
                      ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">OK</span>
                      : <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Error</span>
                  }
                  <span className="text-gray-400 text-xs">
                    {new Date(l.created_at).toLocaleString()}
                  </span>
                  {l.success === false && (
                    <Btn
                      variant="danger"
                      onClick={() => setEditing({ logId: l.id, topicName: l.topic_name, raw: l.raw_response || '' })}
                    >
                      Fix
                    </Btn>
                  )}
                  <Btn
                    onClick={() => setExpandedLogId(expandedLogId === l.id ? null : l.id)}
                    variant="ghost"
                  >
                    {expandedLogId === l.id ? '▲ Timeline' : '▼ Timeline'}
                  </Btn>
                </div>

                {/* Timeline dropdown */}
                {expandedLogId === l.id && (
                  <div className="px-6 bg-gray-50 border-t border-[#E0E0E0]">
                    <TimelinePanel log={l} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }

      <Paginator page={page} total={total} limit={LIMIT} onPage={p => setPage(p)} />
    </div>
  );
}
