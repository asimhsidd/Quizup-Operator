import { BACKEND_URL } from './config';

export const API = `${BACKEND_URL}/api`;

// ── Low-level fetch helper ────────────────────────────────────────────────────
// A plain 403 "Forbidden" means the admin JWT expired (4 h) or the admin was switched off:
// App.jsx hears SESSION_EXPIRED and signs out. A role refusal has its own message.
export const SESSION_EXPIRED = 'kwiz-admin-session-expired';

async function readResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (res.status === 403 && data.error === 'Forbidden') window.dispatchEvent(new Event(SESSION_EXPIRED));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function adminFetch(path, options = {}, token) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'x-admin-token': token }),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return readResponse(res);
}

// Multipart upload helper (no Content-Type — browser sets it with boundary)
export async function adminUpload(path, formData, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'PUT',
    headers: { 'x-admin-token': token },
    body: formData,
  });
  return readResponse(res);
}

export const fmtWhen = d => (d ? new Date(d).toLocaleString() : '—');

/** "3 min ago", "2 h ago", "5 d ago" */
export function timeAgo(d) {
  if (!d) return '—';
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

// ── Small reusable helpers ────────────────────────────────────────────────────
export function Badge({ color, children }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>
      {children}
    </span>
  );
}

export function Btn({ onClick, children, variant = 'ghost', disabled, type }) {
  const base = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 flex items-center gap-1.5 shrink-0';
  const variants = {
    ghost:   'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200',
    danger:  'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200',
    primary: 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200',
    success: 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200',
    coral:   'bg-[#E8453C]/10 hover:bg-[#E8453C]/20 text-[#E8453C] border border-[#E8453C]/30',
  };
  return (
    <button type={type} className={`${base} ${variants[variant]}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function TableHeader({ columns }) {
  return (
    <thead>
      <tr className="border-b border-[#E0E0E0] bg-gray-50">
        {columns.map(col => (
          <th key={col} className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">
            {col}
          </th>
        ))}
      </tr>
    </thead>
  );
}

// Multi-column sortable header.
// sortKeys: [{ key, dir }] — index 0 = primary, index 1 = secondary (max 2)
// onSort(key): if new → add as secondary (or primary if none); if existing → toggle dir
export function SortableTableHeader({ columns, sortKeys, onSort }) {
  return (
    <thead>
      <tr className="border-b border-[#E0E0E0] bg-gray-50">
        {columns.map(col => {
          const idx = col.key ? sortKeys.findIndex(s => s.key === col.key) : -1;
          const active = idx !== -1;
          const dir = active ? sortKeys[idx].dir : null;
          const rank = active && sortKeys.length > 1 ? idx + 1 : null;
          return (
            <th
              key={col.label}
              onClick={col.key ? () => onSort(col.key) : undefined}
              className={`text-left px-4 py-3 text-xs font-bold uppercase tracking-wide select-none ${
                col.key ? 'cursor-pointer text-gray-500 hover:text-[#1A1A2E]' : 'text-gray-500'
              }`}
            >
              <span className="inline-flex items-center gap-1">
                {col.label}
                {col.key && (
                  <span className={`text-[10px] leading-none ${active ? 'text-[#1A1A2E]' : 'text-gray-300'}`}>
                    {active
                      ? <>{rank && <sup className="mr-px">{rank}</sup>}{dir === 'asc' ? '▲' : '▼'}</>
                      : '⇅'}
                  </span>
                )}
              </span>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

// Shared handler factory for multi-column sort
export function makeSortHandler(setSortKeys) {
  return function onSort(key) {
    setSortKeys(prev => {
      const idx = prev.findIndex(s => s.key === key);
      if (idx !== -1) {
        // Already active — toggle direction
        return prev.map((s, i) => i === idx ? { ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' } : s);
      }
      // New column: add as secondary if primary exists, else as primary; max 2
      if (prev.length === 0) return [{ key, dir: 'asc' }];
      return [prev[0], { key, dir: 'asc' }]; // replace/add secondary, keep primary
    });
  };
}

// Shared compare function for a single field
export function cmpField(a, b, key) {
  switch (key) {
    case 'username':         return (a.username ?? '').localeCompare(b.username ?? '');
    case 'email':            return (a.email ?? '').localeCompare(b.email ?? '');
    case 'total_xp':         return (a.total_xp ?? 0) - (b.total_xp ?? 0);
    case 'created_at':       return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    case 'location':         return (a.bot_location?.city ?? '').localeCompare(b.bot_location?.city ?? '');
    case 'bot_tier':         return (a.bot_tier ?? '').localeCompare(b.bot_tier ?? '');
    case 'real_user_matches': return (a.real_user_matches ?? 0) - (b.real_user_matches ?? 0);
    case 'last_game_at':     return new Date(a.last_game_at || 0) - new Date(b.last_game_at || 0);
    case 'bot_active':       return (a.bot_active ? 1 : 0) - (b.bot_active ? 1 : 0);
    default: return 0;
  }
}

export function multiSort(arr, sortKeys) {
  return [...arr].sort((a, b) => {
    for (const { key, dir } of sortKeys) {
      const cmp = cmpField(a, b, key);
      if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}

// ── Health badge helpers ──────────────────────────────────────────────────────
export function healthBadge(t) {
  if (!t.questions_ready) return { color: 'bg-amber-100 text-amber-700', label: 'Pending' };
  if (t.question_count < 7)  return { color: 'bg-red-100 text-red-700',    label: 'Critical' };
  if (t.question_count < 14) return { color: 'bg-orange-100 text-orange-700', label: 'Minimal' };
  if (t.question_count < 30) return { color: 'bg-yellow-100 text-yellow-700', label: 'Low' };
  return { color: 'bg-green-100 text-green-700', label: 'Healthy' };
}

// ── Paginator ─────────────────────────────────────────────────────────────────
export function Paginator({ page, total, limit, onPage }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-[#E0E0E0] text-xs text-gray-500">
      <span>{total} total · page {page + 1} of {totalPages}</span>
      <div className="flex gap-2">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 0}
          className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 font-bold"
        >← Prev</button>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages - 1}
          className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 font-bold"
        >Next →</button>
      </div>
    </div>
  );
}
