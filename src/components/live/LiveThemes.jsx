// Live → Themes: the colours, background picture and effect of the KWIZ Live arena
// (Quizup backend/lib/liveTheme.js, routes/adminLive.js). A theme must pass the readability
// check to save; the preview shows a Word Rush round in it. Events copy their theme when
// they start, so an edit never changes a running event.
import { useEffect, useState } from 'react';
import { adminFetch, adminUpload, Badge, Btn, Spinner } from '../../lib/adminUtils.jsx';

const KEYS = [
  ['ground', 'Ground'], ['surface', 'Surface'], ['line', 'Lines'], ['accent', 'Accent'],
  ['onAccent', 'Text on accent'], ['accent2', 'Second accent'], ['text', 'Text'], ['muted', 'Muted text'],
];
const EFFECTS = ['none', 'snow', 'embers', 'fog', 'confetti'];
const PAIRS = [['text', 'ground', 'Text on ground'], ['text', 'surface', 'Text on surface'], ['muted', 'surface', 'Muted text on surface'], ['onAccent', 'accent', 'Text on accent']];
const HEX = /^#[0-9a-fA-F]{6}$/;

function lum(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const BLANK = { name: '', effect: 'none', palette: { ground: '#0E1230', surface: '#1B2150', line: '#343C7A', accent: '#FF4D8D', onAccent: '#14142B', accent2: '#2EC4D6', text: '#F3F5FF', muted: '#B9C0EA' } };

function Preview({ t }) {
  const p = t.palette;
  const ok = KEYS.every(([k]) => HEX.test(p[k] ?? ''));
  if (!ok) return <div className="w-[210px] h-[400px] rounded-[24px] border-[6px] border-gray-900 bg-gray-100" />;
  return (
    <div className="w-[210px] h-[400px] rounded-[24px] border-[6px] border-gray-900 overflow-hidden relative"
         style={{ background: `linear-gradient(180deg, ${p.surface} 0%, ${p.ground} 55%, #000 160%)`, color: p.text }}>
      {t.bg_image && <div className="absolute inset-0 bg-cover bg-center opacity-60" style={{ backgroundImage: `url("${t.bg_image}")` }} />}
      <div className="relative h-full flex flex-col gap-2.5 p-3 text-[10px]">
        <div className="flex justify-between font-bold"><span>QUESTION 4 OF 12</span><span style={{ color: p.muted }}>168 still in</span></div>
        <div className="h-1.5 rounded-full" style={{ background: p.line }}><div className="h-full w-3/5 rounded-full" style={{ background: p.accent }} /></div>
        <div className="rounded-lg flex items-center justify-center gap-1.5 py-3" style={{ background: p.surface, border: `1px solid ${p.line}` }}>
          <span className="w-12 h-12 rounded-md bg-white" /><b style={{ color: p.accent }}>+</b><span className="w-12 h-12 rounded-md bg-white" />
        </div>
        <div className="flex justify-center gap-1">
          {'STAR'.split('').map((c, i) => <span key={i} className="w-5 h-6 rounded flex items-center justify-center font-bold" style={{ background: p.text, color: p.ground }}>{c}</span>)}
          {[0, 1, 2, 3].map(i => <span key={i} className="w-5 h-6 rounded" style={{ border: `1px dashed ${p.line}` }} />)}
        </div>
        <div className="grid grid-cols-6 gap-1">
          {'FOHLIES'.split('').map((c, i) => <span key={i} className="h-6 rounded flex items-center justify-center font-bold" style={{ background: p.surface, border: `1px solid ${p.line}` }}>{c}</span>)}
        </div>
        <p style={{ color: p.muted }}>Build the word from the tiles.</p>
        <div className="flex-1" />
        <div className="h-8 rounded-lg flex items-center justify-center font-black text-xs" style={{ background: p.accent, color: p.onAccent }}>LOCK IN</div>
      </div>
    </div>
  );
}

export default function LiveThemes({ token }) {
  const [themes, setThemes] = useState(null);
  const [sel, setSel] = useState(null);   // id, or 'new'
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load(keep) {
    try {
      const list = await adminFetch('/admin/live/themes', {}, token);
      setThemes(list);
      const pick = list.find(t => t.id === (keep ?? sel)) ?? list[0];
      if (pick) { setSel(pick.id); setDraft(structuredClone(pick)); }
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, []);

  if (!themes || !draft) return error ? <p className="text-sm text-red-600">{error}</p> : <Spinner />;
  const checks = PAIRS.map(([fg, bg, label]) => {
    const r = HEX.test(draft.palette[fg] ?? '') && HEX.test(draft.palette[bg] ?? '') ? ratio(draft.palette[fg], draft.palette[bg]) : 0;
    return { label, r: Math.round(r * 10) / 10, pass: r >= 4.5 };
  });
  const canSave = draft.name.trim() && checks.every(c => c.pass) && !busy;
  const isNew = sel === 'new';

  async function save() {
    setBusy(true); setError('');
    try {
      const body = { name: draft.name, palette: draft.palette, effect: draft.effect };
      const t = isNew
        ? await adminFetch('/admin/live/themes', { method: 'POST', body }, token)
        : await adminFetch(`/admin/live/themes/${sel}`, { method: 'PUT', body }, token);
      await load(t.id);
    } catch (err) { setError(err.message); }
    setBusy(false);
  }
  async function act(fn) {
    setBusy(true); setError('');
    try { await fn(); await load(); } catch (err) { setError(err.message); }
    setBusy(false);
  }
  async function upload(file) {
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    await act(() => adminUpload(`/admin/live/themes/${sel}/background`, fd, token));
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)_240px] items-start">
      <div className="bg-white border border-gray-200 rounded-xl p-2 flex flex-col gap-1 text-sm">
        {themes.map(t => (
          <button key={t.id} type="button" onClick={() => { setSel(t.id); setDraft(structuredClone(t)); setError(''); }}
                  className={`text-left px-3 py-2 rounded-lg flex items-center gap-2 ${sel === t.id ? 'bg-indigo-50 text-indigo-800 font-semibold' : 'hover:bg-gray-50'}`}>
            <span className="w-3.5 h-3.5 rounded" style={{ background: t.palette.accent }} />
            <span className="flex-1 truncate">{t.name}</span>
            {t.is_default && <Badge color="bg-gray-100 text-gray-600">default</Badge>}
          </button>
        ))}
        <button type="button" onClick={() => { setSel('new'); setDraft(structuredClone(BLANK)); }}
                className="mt-1 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-gray-600 text-xs">New theme</button>
      </div>

      <div className="flex flex-col gap-4">
        <section className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">Name
            <input value={draft.name} maxLength={60} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                   className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900" />
          </label>
          {!isNew && (
            <div className="flex items-center gap-3 text-sm">
              {draft.bg_image
                ? <img src={draft.bg_image} alt="" className="w-16 h-28 object-cover rounded-lg border border-gray-200" />
                : <span className="w-16 h-28 rounded-lg border border-dashed border-gray-300" />}
              <div className="flex flex-col gap-1.5 text-xs text-gray-600">
                <span className="font-semibold text-gray-800">Background picture</span>
                <span>Portrait, at least 1080 wide. Keep the middle calm: the round sits there.</span>
                <div className="flex gap-2">
                  <label className="px-3 py-1.5 rounded-lg border border-gray-300 cursor-pointer text-gray-800">
                    {draft.bg_image ? 'Replace' : 'Upload'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => upload(e.target.files?.[0])} />
                  </label>
                  {draft.bg_image && <Btn disabled={busy} onClick={() => act(() => adminFetch(`/admin/live/themes/${sel}/background`, { method: 'DELETE' }, token))}>Remove</Btn>}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-2 gap-3">
          <h4 className="col-span-2 text-sm font-bold">Colours</h4>
          {KEYS.map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-xs text-gray-700">
              <input type="color" value={HEX.test(draft.palette[k] ?? '') ? draft.palette[k] : '#000000'}
                     onChange={e => setDraft(d => ({ ...d, palette: { ...d.palette, [k]: e.target.value.toUpperCase() } }))}
                     className="w-8 h-8 rounded border border-gray-300 p-0" aria-label={label} />
              <span className="flex-1">{label}</span>
              <input value={draft.palette[k] ?? ''} onChange={e => setDraft(d => ({ ...d, palette: { ...d.palette, [k]: e.target.value } }))}
                     className="w-20 border border-gray-300 rounded px-1.5 py-1 font-mono text-[11px]" aria-label={`${label} hex`} />
            </label>
          ))}
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
          <h4 className="text-sm font-bold">Effect</h4>
          <div className="flex flex-wrap gap-2">
            {EFFECTS.map(fx => (
              <button key={fx} type="button" onClick={() => setDraft(d => ({ ...d, effect: fx }))}
                      className={`px-3 py-1.5 rounded-full text-xs capitalize ${draft.effect === fx ? 'bg-indigo-600 text-white font-semibold' : 'border border-gray-300'}`}>{fx}</button>
            ))}
          </div>
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Btn variant="primary" disabled={!canSave} onClick={save}>{isNew ? 'Create theme' : 'Save theme'}</Btn>
          {!isNew && !draft.is_default && (
            <>
              <Btn disabled={busy} onClick={() => act(() => adminFetch(`/admin/live/themes/${sel}`, { method: 'PUT', body: { name: draft.name, palette: draft.palette, effect: draft.effect, isDefault: true } }, token))}>Make default</Btn>
              <Btn variant="danger" disabled={busy} onClick={() => confirm(`Delete ${draft.name}?`) && act(() => adminFetch(`/admin/live/themes/${sel}`, { method: 'DELETE' }, token))}>Delete</Btn>
            </>
          )}
        </div>
      </div>

      <aside className="flex flex-col gap-3 items-center">
        <Preview t={draft} />
        <div className="w-full bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-1.5 text-xs">
          <span className="font-semibold text-gray-500">Readability</span>
          {checks.map(c => (
            <div key={c.label} className="flex justify-between gap-2">
              <span className="text-gray-700">{c.label}</span>
              <span className={`font-bold ${c.pass ? 'text-green-700' : 'text-red-700'}`}>{c.r} : 1 {c.pass ? 'pass' : 'fail'}</span>
            </div>
          ))}
          {!checks.every(c => c.pass) && <span className="text-red-700">Every pair needs 4.5 : 1 to save.</span>}
        </div>
      </aside>
    </div>
  );
}
