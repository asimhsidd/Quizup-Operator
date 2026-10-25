// Library → Import: seed many topics at once from a JSON category tree
// (POST /admin/seed-topics/preview, then /start and the progress stream).
import { useRef, useState } from 'react';
import { Database } from 'lucide-react';
import { API } from '../../lib/adminUtils.jsx';

export default function ImportTopics({ token }) {
  const [state, setState]           = useState('upload'); // 'upload' | 'preview' | 'running' | 'complete'
  const [parsedTree, setParsedTree] = useState(null);
  const [preview, setPreview]       = useState(null);
  const [progress, setProgress]     = useState(null);
  const [complete, setComplete]     = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [dragOver, setDragOver]     = useState(false);
  const [expanded, setExpanded]     = useState({});
  const esRef  = useRef(null);
  const fileInputRef = useRef(null);

  async function handleFile(file) {
    setUploadError(null);
    if (!file?.name.endsWith('.json')) { setUploadError('Please upload a .json file'); return; }
    let tree;
    try { tree = JSON.parse(await file.text()); }
    catch { setUploadError('Invalid JSON — could not parse file'); return; }

    let data, res;
    try {
      res = await fetch(`${API}/admin/seed-topics/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify(tree),
      });
      data = await res.json();
    } catch { setUploadError('Network error — could not reach server'); return; }

    if (!res.ok) { setUploadError(data.errors?.join('\n') ?? 'Validation failed'); return; }
    setParsedTree(tree);
    setPreview(data);
    setExpanded({});
    setState('preview');
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function startSeeding() {
    setState('running');
    setProgress(null);
    // Step 1: POST the tree to get a jobId (avoids 414 from long SSE URLs)
    let jobId;
    try {
      const res = await fetch(`${API}/admin/seed-topics/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify(parsedTree),
      });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error ?? 'Failed to start job'); setState('upload'); return; }
      jobId = data.jobId;
    } catch { setUploadError('Network error — could not reach server'); setState('upload'); return; }

    // Step 2: open SSE stream by jobId — token sent in Authorization header (not query string)
    const url = `${API}/admin/seed-topics/stream?jobId=${encodeURIComponent(jobId)}`;
    const abortCtrl = new AbortController();
    esRef.current = abortCtrl;
    try {
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: abortCtrl.signal,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setUploadError(err.error ?? 'Stream connection failed');
        setState('upload');
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // retain any incomplete trailing line
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const data = JSON.parse(line.slice(5).trim());
            if (data.type === 'start' || data.type === 'progress') setProgress(data);
            if (data.type === 'complete') { setComplete(data); setState('complete'); reader.cancel(); return; }
            if (data.type === 'error')    { setUploadError(data.message); setState('upload'); reader.cancel(); return; }
          } catch {}
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') { /* silent — keep progress visible */ }
    }
  }

  function stopSeeding() {
    esRef.current?.abort();
    setState('upload');
    setProgress(null);
  }

  function reset() {
    esRef.current?.abort();
    setState('upload');
    setParsedTree(null);
    setPreview(null);
    setProgress(null);
    setComplete(null);
    setUploadError(null);
  }

  function fmtTime(totalTopics) {
    const mins = Math.ceil(totalTopics * 5.5 / 3 / 60);
    const h = Math.floor(mins / 60), m = mins % 60;
    if (h === 0) return `~${m} min${m !== 1 ? 's' : ''}`;
    return `~${h} hr${h !== 1 ? 's' : ''} ${m > 0 ? `${m} min${m !== 1 ? 's' : ''}` : ''}`.trim();
  }

  const cardCls = 'bg-white border border-[#E0E0E0] rounded-xl shadow-sm overflow-hidden';
  const hdrCls  = 'px-5 py-4 border-b border-[#E0E0E0] font-bold text-[#1A1A2E]';

  // ── STATE: upload ──
  if (state === 'upload') return (
    <div className={cardCls}>
      <div className={hdrCls}>Batch Seed Topics</div>
      <div className="p-5 space-y-4">
        <p className="text-sm text-gray-500">
          Upload a JSON file to mass-generate topics and questions. 14 questions per topic, 3 in parallel. Missing categories are auto-created.
        </p>

        {/* Drop zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className="border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors select-none"
          style={{ borderColor: dragOver ? '#E8453C' : '#D1D5DB', background: dragOver ? '#FFF5F5' : '#FAFAFA' }}
        >
          <Database size={28} className="text-gray-400" />
          <p className="text-sm font-semibold text-gray-600">Drag & drop a .json file</p>
          <p className="text-xs text-gray-400">or click to browse</p>
        </div>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ''; }} />

        {uploadError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 whitespace-pre-wrap">{uploadError}</div>
        )}

        <p className="text-xs text-gray-400">
          Expected format: <code className="bg-gray-100 px-1 rounded">{'{ "Category": { "Sub": ["Topic 1", ...] } }'}</code>
        </p>
      </div>
    </div>
  );

  // ── STATE: preview ──
  if (state === 'preview') return (
    <div className={cardCls}>
      <div className={hdrCls}>Preview — ready to seed</div>
      <div className="p-5 space-y-3">
        <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
          {preview.summary.map(root => (
            <div key={root.name} className="border border-[#E0E0E0] rounded-lg overflow-hidden">
              <button
                onClick={() => setExpanded(x => ({ ...x, [root.name]: !x[root.name] }))}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="text-gray-400">{expanded[root.name] ? '▼' : '▶'}</span>
                  {root.name}
                </span>
                <span className="text-gray-500 font-normal">{root.topicCount.toLocaleString()} topics</span>
              </button>
              {expanded[root.name] && (
                <div className="divide-y divide-[#F0F0F0]">
                  {root.subs.map(sub => (
                    <div key={sub.name} className="flex items-center justify-between px-6 py-2 text-sm bg-white">
                      <span className="text-gray-600">{sub.name}</span>
                      <span className="text-gray-400">{sub.topicCount} topics</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-[#E0E0E0] pt-3 text-sm text-gray-600 flex items-center justify-between">
          <span><strong>{preview.totalTopics.toLocaleString()}</strong> topics total</span>
          <span className="text-gray-400">{fmtTime(preview.totalTopics)} estimated</span>
        </div>

        <p className="text-xs text-gray-400">Topics already in DB with questions will be skipped automatically.</p>

        <div className="flex items-center gap-3 pt-1">
          <button onClick={reset} className="flex-1 py-2.5 rounded-lg border border-[#E0E0E0] text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            ← Upload Different File
          </button>
          <button onClick={startSeeding} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white transition-colors" style={{ background: '#E8453C' }}>
            🚀 Start Seeding
          </button>
        </div>
      </div>
    </div>
  );

  // ── STATE: running ──
  if (state === 'running') {
    const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <div className={cardCls}>
        <div className={hdrCls}>⚡ Seeding in progress…</div>
        <div className="p-5 space-y-5">
          {progress?.inFlight?.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">In progress ({progress.inFlight.length})</p>
              {progress.inFlight.map(name => (
                <p key={name} className="text-sm text-gray-700">⚙ {name}</p>
              ))}
            </div>
          )}

          {/* Progress bar */}
          <div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div className="h-3 rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: '#E8453C' }} />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{progress ? `${progress.done.toLocaleString()} / ${progress.total.toLocaleString()}` : '—'}</span>
              <span>{pct}%</span>
            </div>
          </div>

          {/* Counters */}
          {progress && (
            <div className="flex items-center justify-center gap-6 text-sm">
              <span>✅ Generated: <strong>{(progress.done - progress.skipped - progress.failed).toLocaleString()}</strong></span>
              <span>⏭ Skipped: <strong>{progress.skipped.toLocaleString()}</strong></span>
              <span>❌ Failed: <strong>{progress.failed.toLocaleString()}</strong></span>
            </div>
          )}

          <div className="flex justify-center">
            <button onClick={stopSeeding} className="px-8 py-2.5 rounded-lg border border-red-300 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
              ⏹ Stop
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STATE: complete ──
  return (
    <div className={cardCls}>
      <div className={hdrCls}>✅ Seeding complete</div>
      <div className="p-5 space-y-4 text-center">
        <div className="flex items-center justify-center gap-6 text-sm py-2">
          <span>✅ Generated: <strong>{complete ? (complete.done - complete.skipped - complete.failed).toLocaleString() : '—'}</strong></span>
          <span>⏭ Skipped: <strong>{complete?.skipped.toLocaleString() ?? '—'}</strong></span>
          <span>❌ Failed: <strong>{complete?.failed.toLocaleString() ?? '—'}</strong></span>
        </div>
        {complete?.failed > 0 && (
          <p className="text-xs text-gray-400">Failed topics were kept in the database without questions — you can regenerate them from the Library.</p>
        )}
        <button onClick={reset} className="px-8 py-2.5 rounded-lg text-sm font-bold text-white transition-colors" style={{ background: '#E8453C' }}>
          Upload Another File
        </button>
      </div>
    </div>
  );
}
