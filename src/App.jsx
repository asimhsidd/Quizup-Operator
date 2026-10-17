import { lazy, Suspense, useEffect, useState } from 'react';
import { useToastStore } from './lib/toastStore';
import { socket } from './lib/socket';
import { Users, BookOpen, Bot, Settings, Gamepad2, BarChart2, Flag, FolderTree, Radio, ShoppingBag } from 'lucide-react';
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
  { id: 'analytics',  label: 'Analytics',  Icon: BarChart2 },
  { id: 'users',      label: 'Users',      Icon: Users },
  { id: 'categories', label: 'Categories', Icon: FolderTree },
  { id: 'topics',     label: 'Topics',     Icon: BookOpen },
  { id: 'ai-logs',    label: 'Logs',       Icon: Bot },
  { id: 'config',     label: 'Config',     Icon: Settings },
  { id: 'reports',    label: 'Reports',    Icon: Flag },
  { id: 'bots',       label: 'Bots',       Icon: Gamepad2 },
  { id: 'live',       label: 'Live',       Icon: Radio },
  { id: 'store',      label: 'Store',      Icon: ShoppingBag },
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

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A2E]">
      {/* Fixed header + tab bar */}
      <div className="sticky top-0 z-20">
        {/* Admin header */}
        <div className="bg-white border-b border-[#E0E0E0] shadow-sm px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-[#E8453C] text-lg tracking-tight">⚡ KWIZ Operator</span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <span className={`w-2 h-2 rounded-full ${liveConnected ? 'bg-green-500 animate-pulse' : 'bg-amber-400'}`} />
              {liveConnected ? 'Live' : 'Reconnecting…'}
            </span>
          </div>
          <button
            onClick={logout}
            className="text-gray-500 hover:text-[#1A1A2E] text-sm font-semibold transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Horizontal tab bar */}
        <div className="bg-white border-b border-[#E0E0E0] px-2 flex overflow-x-auto">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap
                          transition-colors border-b-2 -mb-px
                          ${activeTab === id
                            ? 'border-[#E8453C] text-[#E8453C]'
                            : 'border-transparent text-gray-500 hover:text-[#1A1A2E] hover:border-gray-300'}`}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main content — lazy mount + keep-alive: each tab mounts on first visit and is never unmounted */}
      {visitedTabs.has('topics') && (
        <div style={{ display: activeTab === 'topics' ? '' : 'none' }}>
          <Suspense fallback={<Spinner />}>
            <TopicsTab token={token} />
          </Suspense>
        </div>
      )}
      <div className="max-w-6xl mx-auto p-4 sm:p-6" style={{ display: activeTab === 'topics' || activeTab === 'seed' ? 'none' : '' }}>
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
    </div>
  );
}
