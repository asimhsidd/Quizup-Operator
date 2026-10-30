// Live → Word Rush puzzles: import the JSONL (from GPT or anywhere), review what the import
// held back (sound-alikes, parts that don't spell the answer), approve or reject, and get
// every noun its picture (drawn by Together.AI, billed, or uploaded). Only approved puzzles
// whose pictures are all ready can be played. Quizup backend/lib/rebus.js, routes/adminLive.js.
import { useEffect, useState } from 'react';
import { adminFetch, adminUpload, Badge, Btn, Spinner } from '../../lib/adminUtils.jsx';
import { Pills, StatCard, n } from '../Panels.jsx';

const STATUS_COLOR = { pending: 'bg-amber-100 text-amber-800', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-600' };

function Parts({ parts, pictures }) {
  const url = new Map((pictures ?? []).map(p => [p.word, p]));
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {parts.map((p, i) => p.op
        ? <b key={i} className="text-indigo-600">{p.op}</b>
        : p.letters
          ? <span key={i} className="font-mono font-bold">{p.letters}</span>
          : (
            <span key={i} className="flex items-center gap-1 text-xs">
              {url.get(p.picture)?.url
                ? <img src={url.get(p.picture).url} alt="" className="w-9 h-9 rounded border border-gray-200 bg-white object-contain" />
                : <span className="w-9 h-9 rounded border border-dashed border-gray-300" title="no picture yet" />}
              {p.picture}
            </span>
          ))}
    </div>
  );
}

function Importer({ token, onDone }) {
  const [text, setText] = useState('');
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run() {
    setBusy(true); setError(''); setOut(null);
    try { setOut(await adminFetch('/admin/live/puzzles/import', { method: 'POST', body: { text, source: 'operator' } }, token)); setText(''); onDone(); }
    catch (err) { setError(err.message); }
    setBusy(false);
  }
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
      <h4 className="text-sm font-bold">Import puzzles</h4>
      <p className="text-xs text-gray-500">
        JSONL, one puzzle a line: {'{"answer":"RAINBOW","accept":["RAINBOW"],"parts":[{"picture":"rain"},{"op":"+"},{"picture":"bow"}],"kind":"literal","difficulty":1,"explain":"rain + bow"}'}.
        Literal puzzles whose parts spell the answer are approved straight away; the rest wait below.
      </p>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder="Paste JSONL here, or choose a file"
                className="border border-gray-300 rounded-lg p-2 font-mono text-xs" />
      <div className="flex items-center gap-2">
        <label className="px-3 py-1.5 rounded-lg border border-gray-300 cursor-pointer text-xs">
          Choose file
          <input type="file" accept=".jsonl,.json,.txt" className="hidden"
                 onChange={async e => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
        </label>
        <Btn variant="primary" disabled={busy || !text.trim()} onClick={run}>{busy ? 'Importing…' : 'Import'}</Btn>
        {text && <span className="text-xs text-gray-500">{text.split('\n').filter(Boolean).length} lines</span>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {out && (
        <div className="text-xs text-gray-700">
          {out.lines} lines: <b className="text-green-700">{out.approved} approved</b>, <b className="text-amber-700">{out.pending} to review</b>, {out.duplicate} duplicate, {out.invalid} invalid.
          {out.problems?.length > 0 && <ul className="mt-1 text-red-700">{out.problems.slice(0, 10).map(p => <li key={p.line}>line {p.line}: {p.error}</li>)}</ul>}
        </div>
      )}
    </section>
  );
}

function Pictures({ token, counts, onDone }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [list, setList] = useState(null);
  async function draw(retry = false) {
    setBusy(true); setMsg('');
    try {
      const r = await adminFetch('/admin/live/pictures/draw', { method: 'POST', body: { limit: 25, retry } }, token);
      setMsg(r.error ?? `${r.drawn} drawn, ${r.failed} failed, ${r.left} still to draw`);
      onDone();
      if (list) setList(await adminFetch('/admin/live/pictures?status=failed', {}, token));
    } catch (err) { setMsg(err.message); }
    setBusy(false);
  }
  async function replace(word, file) {
    const fd = new FormData();
    fd.append('image', file);
    try { await adminUpload(`/admin/live/pictures/${encodeURIComponent(word)}`, fd, token); onDone(); setList(await adminFetch('/admin/live/pictures', {}, token)); }
    catch (err) { setMsg(err.message); }
  }
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="text-sm font-bold">Pictures</h4>
        <div className="flex gap-2">
          <Btn disabled={busy} onClick={() => draw(false)}>{busy ? 'Drawing…' : 'Draw 25 missing'}</Btn>
          {counts.failed > 0 && <Btn disabled={busy} onClick={() => draw(true)}>Retry failed</Btn>}
          <Btn onClick={async () => setList(list ? null : await adminFetch('/admin/live/pictures', {}, token))}>{list ? 'Hide all' : 'Show all'}</Btn>
        </div>
      </div>
      <p className="text-xs text-gray-600">
        {n(counts.ready)} ready · {n(counts.missing)} to draw · {n(counts.failed)} failed. One picture per noun, shared by every puzzle that uses it.
        Drawing is billed per picture (AI models: Word Rush pictures).
      </p>
      {msg && <p className="text-xs text-gray-800">{msg}</p>}
      {list && (
        <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-8 gap-2 max-h-[420px] overflow-y-auto">
          {list.map(p => (
            <label key={p.word} className="flex flex-col items-center gap-1 text-[11px] cursor-pointer" title={p.error ?? 'Upload a picture of your own'}>
              {p.image_url ? <img src={p.image_url} alt="" className="w-16 h-16 rounded border border-gray-200 bg-white object-contain" />
                : <span className={`w-16 h-16 rounded border border-dashed ${p.status === 'failed' ? 'border-red-400' : 'border-gray-300'}`} />}
              <span className="truncate max-w-full">{p.word} · {p.puzzles}</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && replace(p.word, e.target.files[0])} />
            </label>
          ))}
        </div>
      )}
    </section>
  );
}

export default function LivePuzzles({ token }) {
  const [status, setStatus] = useState('pending');
  const [q, setQ] = useState('');
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);

  async function load() {
    try {
      const qs = new URLSearchParams({ limit: '50', offset: String(offset), q, ...(status === 'reported' ? { reported: '1' } : status !== 'all' ? { status } : {}) });
      setD(await adminFetch(`/admin/live/puzzles?${qs}`, {}, token)); setError('');
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, [status, offset]);

  async function setPuzzle(id, body) {
    try { await adminFetch(`/admin/live/puzzles/${id}`, { method: 'PUT', body }, token); load(); }
    catch (err) { setError(err.message); }
  }
  async function bulk(s) {
    try { await adminFetch('/admin/live/puzzles/bulk', { method: 'POST', body: { ids: d.puzzles.map(p => p.id), status: s } }, token); load(); }
    catch (err) { setError(err.message); }
  }

  if (!d) return error ? <p className="text-sm text-red-600">{error}</p> : <Spinner />;
  const playable = Object.values(d.playable ?? {}).reduce((a, b) => a + b, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Playable now" value={n(playable)} sub={[1, 2, 3, 4, 5].map(k => `${k}: ${n(d.playable?.[k])}`).join(' · ')} />
        <StatCard label="Approved" value={n(d.counts.approved)} sub="pictures may still be missing" />
        <StatCard label="To review" value={n(d.counts.pending)} sub="held back by the import" />
        <StatCard label="Rejected" value={n(d.counts.rejected)} />
      </div>
      <Importer token={token} onDone={load} />
      <Pictures token={token} counts={{ ready: d.pictures.ready ?? 0, missing: d.pictures.missing ?? 0, failed: d.pictures.failed ?? 0 }} onDone={load} />

      <section className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="flex items-center gap-3 p-3 flex-wrap">
          <Pills options={[['pending', 'To review'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['reported', 'Reported'], ['all', 'All']]}
                 value={status} onChange={v => { setOffset(0); setStatus(v); }} />
          <form onSubmit={e => { e.preventDefault(); setOffset(0); load(); }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search answers" className="border border-gray-300 rounded-lg px-2 py-1 text-sm" />
          </form>
          {status === 'pending' && d.puzzles.length > 0 && (
            <div className="ml-auto flex gap-2">
              <Btn variant="success" onClick={() => bulk('approved')}>Approve these {d.puzzles.length}</Btn>
              <Btn variant="danger" onClick={() => bulk('rejected')}>Reject these {d.puzzles.length}</Btn>
            </div>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>{['Answer', 'Puzzle', 'Kind', 'Diff', 'Why held / explain', 'Seen', 'Reports', 'Status', ''].map(h => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr>
          </thead>
          <tbody>
            {d.puzzles.length === 0 && <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-500">Nothing here.</td></tr>}
            {d.puzzles.map(p => (
              <tr key={p.id} className="border-t border-gray-100 align-top">
                <td className="px-3 py-2 font-mono font-bold">{p.answer}{p.accept.length > 1 && <div className="text-[10px] text-gray-500 font-normal">also {p.accept.filter(a => a !== p.answer).join(', ')}</div>}</td>
                <td className="px-3 py-2"><Parts parts={p.parts} pictures={p.pictures} /></td>
                <td className="px-3 py-2 text-xs">{p.kind}</td>
                <td className="px-3 py-2 tabular-nums">{p.difficulty}</td>
                <td className="px-3 py-2 text-xs text-gray-600 max-w-[260px]">{p.review_note && <div className="text-amber-700">{p.review_note}</div>}{p.explain}</td>
                <td className="px-3 py-2 tabular-nums text-xs">{n(p.seen)}</td>
                <td className="px-3 py-2 tabular-nums text-xs">{p.report_count || ''}</td>
                <td className="px-3 py-2"><Badge color={STATUS_COLOR[p.status]}>{p.status}</Badge></td>
                <td className="px-3 py-2">
                  <div className="flex gap-1.5">
                    {p.status !== 'approved' && <Btn variant="success" onClick={() => setPuzzle(p.id, { status: 'approved', clearReports: true })}>Approve</Btn>}
                    {p.status !== 'rejected' && <Btn variant="danger" onClick={() => setPuzzle(p.id, { status: 'rejected' })}>Reject</Btn>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between p-3 text-xs text-gray-600">
          <span>{n(d.total)} puzzles</span>
          <div className="flex gap-2">
            <Btn disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - 50))}>Previous</Btn>
            <Btn disabled={offset + 50 >= d.total} onClick={() => setOffset(o => o + 50)}>Next</Btn>
          </div>
        </div>
        {error && <p className="text-sm text-red-600 px-3 pb-3">{error}</p>}
      </section>
    </div>
  );
}
