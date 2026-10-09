import { useEffect, useState } from 'react';
import { useToastStore } from '../lib/toastStore';
import { adminFetch, Btn, Spinner } from '../lib/adminUtils.jsx';

// ── Tab: Themes ───────────────────────────────────────────────────────────────
const THEME_COLOR_KEYS = [
  { key: 'brand',      label: 'Brand' },
  { key: 'brandDark',  label: 'Brand Dark' },
  { key: 'brandLight', label: 'Brand Light' },
  { key: 'bgApp',      label: 'BG App' },
  { key: 'surface',    label: 'Surface' },
  { key: 'xp',         label: 'XP' },
  { key: 'gold',       label: 'Gold' },
  { key: 'timer',      label: 'Timer' },
  { key: 'timerWarn',  label: 'Timer Warn' },
  { key: 'correct',    label: 'Correct' },
  { key: 'wrong',      label: 'Wrong' },
  { key: 'onDark',     label: 'On Dark' },
  { key: 'muted',      label: 'Muted' },
];

const EMPTY_COLORS = Object.fromEntries(THEME_COLOR_KEYS.map(({ key }) => [key, '#000000']));

function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function ThemeEditorPanel({ editingTheme, onClose, onSaved, token }) {
  const [name, setName]       = useState(editingTheme?.name ?? '');
  const [slug, setSlug]       = useState(editingTheme?.slug ?? '');
  const [slugManual, setSlugManual] = useState(!!editingTheme);
  const [colors, setColors]   = useState(editingTheme?.colors ?? { ...EMPTY_COLORS });
  const [preview, setPreview] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const isNew = !editingTheme;

  function handleNameChange(val) {
    setName(val);
    if (!slugManual) setSlug(slugify(val));
  }

  function handleColorChange(key, val) {
    setColors(c => ({ ...c, [key]: val }));
    if (preview) {
      // Live-preview: apply immediately to document root
      const varMap = {
        brand: '--color-brand', brandDark: '--color-brand-dark', brandLight: '--color-brand-light',
        bgApp: '--color-bg-app', surface: '--color-surface', xp: '--color-xp', gold: '--color-gold',
        timer: '--color-timer', timerWarn: '--color-timer-warn', correct: '--color-correct',
        wrong: '--color-wrong', onDark: '--color-on-dark', muted: '--color-muted',
      };
      if (varMap[key]) document.documentElement.style.setProperty(varMap[key], val);
    }
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      if (isNew) {
        await adminFetch('/themes', { method: 'POST', body: { name, slug, colors } }, token);
      } else {
        await adminFetch(`/themes/${editingTheme.id}`, { method: 'PATCH', body: { name, colors } }, token);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-extrabold text-[#1A1A2E] text-base">{isNew ? 'New Theme' : `Edit: ${editingTheme.name}`}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none">✕</button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Name</label>
          <input
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Dark Red"
            className="w-full border border-[#E0E0E0] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#E8453C]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Slug</label>
          <input
            value={slug}
            onChange={e => { setSlug(e.target.value); setSlugManual(true); }}
            placeholder="dark-red"
            disabled={!isNew}
            className="w-full border border-[#E0E0E0] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#E8453C] disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 font-medium select-none">
          <input
            type="checkbox"
            checked={preview}
            onChange={e => setPreview(e.target.checked)}
            className="accent-[#E8453C]"
          />
          Live preview (applies to app immediately)
        </label>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-5">
        {THEME_COLOR_KEYS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <input
              type="color"
              value={colors[key] || '#000000'}
              onChange={e => handleColorChange(key, e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0 p-0"
              style={{ minWidth: 32 }}
            />
            <input
              type="text"
              value={colors[key] || ''}
              onChange={e => handleColorChange(key, e.target.value)}
              className="flex-1 border border-[#E0E0E0] rounded px-2 py-1 text-xs font-mono text-[#1A1A2E] focus:outline-none focus:border-[#E8453C]"
              maxLength={7}
            />
            <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
          </div>
        ))}
      </div>

      {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

      <div className="flex gap-2 justify-end">
        <Btn onClick={onClose} variant="ghost">Cancel</Btn>
        <Btn onClick={handleSave} variant="primary" disabled={saving || !name || !slug}>
          {saving ? 'Saving…' : (isNew ? 'Create Theme' : 'Save Changes')}
        </Btn>
      </div>
    </div>
  );
}

export default function ThemesTab({ token }) {
  const [themes, setThemes]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState(null);
  const { addToast } = useToastStore();

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetch('/themes/all', {}, token);
      setThemes(data);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function setDefault(theme) {
    try {
      await adminFetch(`/themes/${theme.id}`, { method: 'PATCH', body: { is_default: true } }, token);
      addToast(`${theme.name} set as default`, 'success');
      load();
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function toggleActive(theme) {
    if (theme.is_active) {
      try {
        await adminFetch(`/themes/${theme.id}`, { method: 'DELETE' }, token);
        addToast(`${theme.name} deactivated`, 'success');
        load();
      } catch (err) {
        addToast(err.message, 'error');
      }
    } else {
      try {
        await adminFetch(`/themes/${theme.id}`, { method: 'PATCH', body: { is_active: true } }, token);
        addToast(`${theme.name} activated`, 'success');
        load();
      } catch (err) {
        addToast(err.message, 'error');
      }
    }
  }

  function openNew() {
    setEditingTheme(null);
    setEditorOpen(true);
  }

  function openEdit(theme) {
    setEditingTheme(theme);
    setEditorOpen(true);
  }

  function onSaved() {
    setEditorOpen(false);
    setEditingTheme(null);
    load();
    addToast('Theme saved', 'success');
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[#1A1A2E] font-bold text-lg">Themes ({themes.length})</h2>
        <div className="flex gap-2">
          <Btn onClick={load} variant="ghost">Refresh</Btn>
          <Btn onClick={openNew} variant="primary">+ New Theme</Btn>
        </div>
      </div>

      {editorOpen && (
        <ThemeEditorPanel
          editingTheme={editingTheme}
          onClose={() => { setEditorOpen(false); setEditingTheme(null); }}
          onSaved={onSaved}
          token={token}
        />
      )}

      <div className="grid gap-3">
        {themes.map(theme => (
          <div
            key={theme.id}
            className="bg-white border border-[#E0E0E0] rounded-xl p-4 flex items-center gap-4 shadow-sm"
          >
            {/* Colour swatch circle */}
            <div
              className="w-12 h-12 rounded-full shrink-0 border border-[#E0E0E0]"
              style={{ background: `linear-gradient(135deg, ${theme.colors.brand}, ${theme.colors.xp})` }}
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[#1A1A2E] text-sm">{theme.name}</span>
                <span className="text-xs text-gray-400 font-mono">{theme.slug}</span>
                {theme.is_default && (
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Default</span>
                )}
                {theme.is_active
                  ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Active</span>
                  : <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">Inactive</span>
                }
              </div>
              {/* Dot strip preview */}
              <div className="flex items-center gap-1.5 mt-1.5">
                {[theme.colors.brand, theme.colors.brandDark, theme.colors.xp, theme.colors.correct, theme.colors.wrong, theme.colors.timer].map((c, i) => (
                  <div key={i} className="rounded-full border border-black/10" style={{ width: 14, height: 14, background: c }} />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {!theme.is_default && (
                <Btn onClick={() => setDefault(theme)} variant="ghost">Set Default</Btn>
              )}
              <Btn onClick={() => openEdit(theme)} variant="primary">Edit</Btn>
              {!theme.is_default && (
                <Btn
                  onClick={() => toggleActive(theme)}
                  variant={theme.is_active ? 'danger' : 'success'}
                >
                  {theme.is_active ? 'Deactivate' : 'Activate'}
                </Btn>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
