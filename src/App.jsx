import { lazy, Suspense, useEffect, useState } from 'react';
import { useToastStore } from './lib/toastStore';
import { socket } from './lib/socket';
import {
  Users,
  BookOpen,
  Bot,
  Settings,
  Gamepad2,
  BarChart2,
  Flag,
  FolderTree,
  Radio,
  ShoppingBag,
  Menu,
  X,
  LogOut,
  Zap,
} from 'lucide-react';
import { adminFetch, Spinner } from './lib/adminUtils.jsx';

// ── Lazy tab imports ───────────────────────────────────────────────────────────
const AnalyticsTab  = lazy(() => import('./tabs/AnalyticsTab.jsx'));
const UsersTab      = lazy(() => import('./tabs/UsersTab.jsx'));
const CategoriesTab = lazy(() => import('./tabs/CategoriesTab.jsx'));
const TopicsTab     = lazy(() => import('./tabs/TopicsTab.jsx'));
const AILogsTab     = lazy(() => import('./tabs/AILogsTab.jsx'));
const ConfigTab     = lazy(() => import('./tabs/ConfigTab.jsx'));
const ReportsTab    = lazy(() => import('./tabs/ReportsTab.jsx'));
const BotsTab       = lazy(() => import('./tabs/BotsTab.jsx'));
const LiveTab       = lazy(() => import('./tabs/LiveTab.jsx'));
const StoreTab      = lazy(() => import('./tabs/StoreTab.jsx'));

// ── Tab definitions ────────────────────────────────────────────────────────────
const TABS = [
  { id: 'analytics',  label: 'Overview',   subtitle: 'Game health and player activity', Icon: BarChart2 },
  { id: 'users',      label: 'Users',      subtitle: 'Players, profiles and access', Icon: Users },
  { id: 'categories', label: 'Categories', subtitle: 'Taxonomy and question quality', Icon: FolderTree },
  { id: 'topics',     label: 'Topics',     subtitle: 'Question library and generation', Icon: BookOpen },
  { id: 'ai-logs',    label: 'AI Logs',    subtitle: 'Generation activity and automatic repair', Icon: Bot },
  { id: 'config',     label: 'Config',     subtitle: 'Runtime rules and AI models', Icon: Settings },
  { id: 'reports',    label: 'Reports',    subtitle: 'Player safety and moderation', Icon: Flag },
  { id: 'bots',       label: 'Bots',       subtitle: 'Synthetic players and behaviour', Icon: Gamepad2 },
  { id: 'live',       label: 'KWIZ Live',  subtitle: 'Events, schedules and prizes', Icon: Radio },
  { id: 'store',      label: 'Store',      subtitle: 'Products and entitlements', Icon: ShoppingBag },
];

const NAV_GROUPS = [
  { label: 'Command center', ids: ['analytics'] },
  { label: 'Content & players', ids: ['users', 'categories', 'topics'] },
  { label: 'Operations', ids: ['reports', 'ai-logs', 'live'] },
  { label: 'Automation', ids: ['bots'] },
  { label: 'Platform controls', ids: ['config', 'store'] },
];

// ── Login gate ─────────────────────────────────────────────────────────────────
function LoginGate({ onLogin }) {
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      // Exchange the raw ADMIN_TOKEN for a short-lived signed JWT
      const data = await adminFetch('/admin/login', { method: 'POST', body: { token: val } }, '');
      sessionStorage.setItem('admin_token', data.token);
      onLogin(data.token);
    } catch {
      setErr('Invalid admin token');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm space-y-4">
        <h1 className="text-xl font-extrabold text-[#1A1A2E]">KWIZ Operator</h1>
        <input
          type="password"
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder="Admin token"
          className="w-full border border-[#E0E0E0] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#E8453C]"
        />
        {err && <p className="text-red-500 text-sm">{err}</p>}
        <button
          type="submit"
          disabled={loading || !val}
          className="w-full bg-[#E8453C] text-white font-bold rounded-xl py-2.5 text-sm hover:bg-[#d03a32] transition-colors disabled:opacity-60"
        >
          {loading ? 'Checking…' : 'Login'}
        </button>
      </form>
    </div>
  );
}

// ── Admin shell ────────────────────────────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('admin_token') || '');
  const [activeTab, setActiveTab] = useState('analytics');
  // Tracks which tabs have been visited — once mounted, tabs are never unmounted
  const [visitedTabs, setVisitedTabs] = useState(() => new Set(['analytics']));
  const [liveConnected, setLiveConnected] = useState(socket.connected);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { addToast } = useToastStore();

  useEffect(() => {
    // The admin token puts this socket in the server's admin room, the only place the
    // admin_* live updates are sent. Reconnect whenever the token changes.
    if (!token) return;
    socket.auth = { adminToken: token };
    socket.connect();

    function onConnect() { setLiveConnected(true); }
    function onDisconnect() { setLiveConnected(false); }
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    setVisitedTabs(prev => {
      if (prev.has(activeTab)) return prev;
      return new Set([...prev, activeTab]);
    });
  }, [activeTab]);

  function logout() {
    sessionStorage.removeItem('admin_token');
    setToken('');
    addToast('Logged out', 'info');
  }

  if (!token) {
    return <LoginGate onLogin={t => setToken(t)} />;
  }

  const active = TABS.find(tab => tab.id === activeTab) ?? TABS[0];
  const ActiveIcon = active.Icon;

  function selectTab(id) {
    setActiveTab(id);
    setSidebarOpen(false);
  }

  return (
    <div className="min-h-[100dvh] bg-[#F4F6F8] text-[#172033]">
      {/* Mobile scrim */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[1px] lg:hidden"
        />
      )}

      {/* Primary navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-[#071126] text-slate-200 shadow-2xl transition-transform duration-200 lg:translate-x-0 lg:shadow-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-[72px] shrink-0 border-b border-white/10 px-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8453C] text-white shadow-lg shadow-red-950/30">
              <Zap size={19} fill="currentColor" />
            </span>
            <div>
              <div className="font-extrabold tracking-tight text-white">KWIZ Operator</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Command console</div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="mb-5 last:mb-0">
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.ids.map(id => {
                  const tab = TABS.find(item => item.id === id);
                  const Icon = tab.Icon;
                  const selected = activeTab === id;
                  return (
                    <button
                      type="button"
                      key={id}
                      onClick={() => selectTab(id)}
                      className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors
                        ${selected
                          ? 'bg-white/10 text-white'
                          : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'}`}
                    >
                      {selected && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#FF5A50]" />}
                      <Icon size={17} className={selected ? 'text-[#FF6B62]' : 'text-slate-500 group-hover:text-slate-300'} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2.5 text-xs text-slate-400">
            <span className={`h-2 w-2 rounded-full ${liveConnected ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.65)]' : 'bg-amber-400'}`} />
            <span>{liveConnected ? 'Live updates connected' : 'Reconnecting live updates…'}</span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-[100dvh] min-w-0 flex-col lg:pl-[264px]">
        {/* Context header */}
        <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
            >
              <Menu size={19} />
            </button>
            <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 sm:flex">
              <ActiveIcon size={17} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-[#172033] sm:text-base">{active.label}</h1>
              <p className="hidden truncate text-xs text-slate-400 sm:block">{active.subtitle}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold sm:flex
              ${liveConnected
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${liveConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {liveConnected ? 'Live' : 'Connecting'}
            </span>
            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-slate-200 p-2 text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 lg:hidden"
              title="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        {/* Lazy mount + keep-alive: each tab mounts on first visit and is never unmounted */}
        <main className={`min-w-0 flex-1 ${activeTab === 'topics' ? 'overflow-hidden' : 'p-4 sm:p-6 xl:p-8'}`}>
          {visitedTabs.has('topics') && (
            <div style={{ display: activeTab === 'topics' ? '' : 'none' }}>
              <Suspense fallback={<Spinner />}>
                <TopicsTab token={token} />
              </Suspense>
            </div>
          )}
          <div className="w-full" style={{ display: activeTab === 'topics' ? 'none' : '' }}>
            {visitedTabs.has('analytics')  && <div style={{ display: activeTab === 'analytics'  ? '' : 'none' }}><Suspense fallback={<Spinner />}><AnalyticsTab  token={token} /></Suspense></div>}
            {visitedTabs.has('users')      && <div style={{ display: activeTab === 'users'      ? '' : 'none' }}><Suspense fallback={<Spinner />}><UsersTab      token={token} /></Suspense></div>}
            {visitedTabs.has('ai-logs')    && <div style={{ display: activeTab === 'ai-logs'    ? '' : 'none' }}><Suspense fallback={<Spinner />}><AILogsTab     token={token} /></Suspense></div>}
            {visitedTabs.has('config')     && <div style={{ display: activeTab === 'config'     ? '' : 'none' }}><Suspense fallback={<Spinner />}><ConfigTab     token={token} /></Suspense></div>}
            {visitedTabs.has('reports')    && <div style={{ display: activeTab === 'reports'    ? '' : 'none' }}><Suspense fallback={<Spinner />}><ReportsTab    token={token} /></Suspense></div>}
            {visitedTabs.has('bots')       && <div style={{ display: activeTab === 'bots'       ? '' : 'none' }}><Suspense fallback={<Spinner />}><BotsTab       token={token} /></Suspense></div>}
            {visitedTabs.has('live')       && <div style={{ display: activeTab === 'live'       ? '' : 'none' }}><Suspense fallback={<Spinner />}><LiveTab       token={token} /></Suspense></div>}
            {visitedTabs.has('store')      && <div style={{ display: activeTab === 'store'      ? '' : 'none' }}><Suspense fallback={<Spinner />}><StoreTab      token={token} /></Suspense></div>}
            {visitedTabs.has('categories') && <div style={{ display: activeTab === 'categories' ? '' : 'none' }}><Suspense fallback={<Spinner />}><CategoriesTab token={token} /></Suspense></div>}
          </div>
        </main>
      </div>
    </div>
  );
}
