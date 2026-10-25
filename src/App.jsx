import { lazy, Suspense, useEffect, useState } from 'react';
import { useToastStore } from './lib/toastStore';
import { socket } from './lib/socket';
import {
  Users,
  Library,
  Bot,
  SlidersHorizontal,
  Gamepad2,
  BarChart2,
  Radio,
  Menu,
  X,
  LogOut,
  Zap,
  Inbox,
  ScrollText,
  Server,
  UserCog,
  ShieldAlert,
  Coins,
  Globe2,
  Megaphone,
  ChevronDown,
} from 'lucide-react';
import { adminFetch, Spinner, SESSION_EXPIRED } from './lib/adminUtils.jsx';
import LoginGate from './components/LoginGate.jsx';
import PlayerDrawer from './components/PlayerDrawer.jsx';
import SettingsSearch from './components/SettingsSearch.jsx';
import { useNavStore } from './store/navStore';

// ── Lazy tab imports ───────────────────────────────────────────────────────────
const AnalyticsTab  = lazy(() => import('./tabs/AnalyticsTab.jsx'));
const UsersTab      = lazy(() => import('./tabs/UsersTab.jsx'));
const LibraryTab    = lazy(() => import('./tabs/LibraryTab.jsx'));
const AILogsTab     = lazy(() => import('./tabs/AILogsTab.jsx'));
const GameRulesTab  = lazy(() => import('./tabs/GameRulesTab.jsx'));
const BotsTab       = lazy(() => import('./tabs/BotsTab.jsx'));
const LiveTab       = lazy(() => import('./tabs/LiveTab.jsx'));
const InboxTab      = lazy(() => import('./tabs/InboxTab.jsx'));
const AuditTab      = lazy(() => import('./tabs/AuditTab.jsx'));
const SystemTab     = lazy(() => import('./tabs/SystemTab.jsx'));
const TeamTab       = lazy(() => import('./tabs/TeamTab.jsx'));
const SafetyTab     = lazy(() => import('./tabs/SafetyTab.jsx'));
const EconomyTab    = lazy(() => import('./tabs/EconomyTab.jsx'));
const GameWorldTab  = lazy(() => import('./tabs/GameWorldTab.jsx'));
const CommsTab      = lazy(() => import('./tabs/CommsTab.jsx'));

// ── Tab definitions ────────────────────────────────────────────────────────────
const TABS = [
  { id: 'inbox',      label: 'Inbox',      subtitle: 'What needs attention, live', Icon: Inbox },
  { id: 'analytics',  label: 'Overview',   subtitle: 'Game health and player activity', Icon: BarChart2 },
  { id: 'users',      label: 'Users',      subtitle: 'Players, profiles and access', Icon: Users },
  { id: 'library',    label: 'Library',    subtitle: 'Categories, topics, questions and answers', Icon: Library },
  { id: 'ai-logs',    label: 'AI',         subtitle: 'Models, budget, generation activity and automatic repair', Icon: Bot },
  { id: 'rules',      label: 'Game rules', subtitle: 'Rounds, scoring, XP, ranks and lifelines', Icon: SlidersHorizontal },
  { id: 'safety',     label: 'Safety',     subtitle: 'Reports, moderation queues and question quality', Icon: ShieldAlert },
  { id: 'bots',       label: 'Bots',       subtitle: 'Synthetic players and behaviour', Icon: Gamepad2 },
  { id: 'live',       label: 'KWIZ Live',  subtitle: 'Events, schedules and prizes', Icon: Radio },
  { id: 'world',      label: 'Game world', subtitle: 'Clans, missions, crowns, rivals and Discover', Icon: Globe2 },
  { id: 'comms',      label: 'Comms',      subtitle: 'Push campaigns and the launch waitlist', Icon: Megaphone },
  { id: 'economy',    label: 'Economy',    subtitle: 'Coins, purchases, KWIZ+, ads, the store and its pricing', Icon: Coins },
  { id: 'audit',      label: 'Audit log',  subtitle: 'Every change, by whom', Icon: ScrollText },
  { id: 'system',     label: 'System',     subtitle: 'Health, errors, the daily digest and cron jobs', Icon: Server },
  { id: 'team',       label: 'Team',       subtitle: 'Admins, agents and keys', Icon: UserCog, ownerOnly: true },
];

// View names for the settings search ("Game world · Missions")
const VIEW_LABELS = { store: 'Store & pricing', clans: 'Clans', missions: 'Missions', crowns: 'Crowns', discover: 'Discover' };

const NAV_GROUPS = [
  { label: 'Command', ids: ['inbox', 'analytics'] },
  { label: 'Players & safety', ids: ['users', 'safety', 'comms'] },
  { label: 'Content', ids: ['library', 'ai-logs', 'bots'] },
  { label: 'Game', ids: ['rules', 'live', 'world'] },
  { label: 'Money', ids: ['economy'] },
  { label: 'Platform', ids: ['system', 'audit', 'team'] },
];

// ── Admin shell ────────────────────────────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('admin_token') || '');
  // Who is signed in ({ id, label, role, via }), from the login answer or GET /admin/me
  const [me, setMe] = useState(() => JSON.parse(sessionStorage.getItem('admin_me') || 'null'));
  const hashTab = useNavStore(s => s.tab);
  const go = useNavStore(s => s.go);
  const activeTab = TABS.some(t => t.id === hashTab) ? hashTab : 'inbox';
  // Tracks which tabs have been visited — once mounted, tabs are never unmounted
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([activeTab]));
  const [openCount, setOpenCount] = useState(0);
  const [liveConnected, setLiveConnected] = useState(socket.connected);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Sidebar groups folded away, remembered on this browser
  const [collapsed, setCollapsed] = useState(() => new Set(JSON.parse(localStorage.getItem('nav_collapsed') || '[]')));
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

  // Who am I (a session from before this was stored), and the Inbox's open count, kept live
  useEffect(() => {
    if (!token) return;
    if (!me) adminFetch('/admin/me', {}, token).then(d => { setMe(d.admin); sessionStorage.setItem('admin_me', JSON.stringify(d.admin)); }).catch(() => {});
    const refresh = () => adminFetch('/admin/ops-events?status=open&limit=1', {}, token)
      .then(d => setOpenCount(Object.values(d.open ?? {}).reduce((a, b) => a + b, 0))).catch(() => {});
    refresh();
    socket.on('ops_event', refresh);
    return () => { socket.off('ops_event', refresh); };
  }, [token]);

  // An expired or switched-off session signs out
  useEffect(() => {
    function onExpired() {
      if (!sessionStorage.getItem('admin_token')) return;
      sessionStorage.removeItem('admin_token');
      sessionStorage.removeItem('admin_me');
      setToken('');
      setMe(null);
      addToast('Your session ended. Sign in again.', 'info');
    }
    window.addEventListener(SESSION_EXPIRED, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED, onExpired);
  }, []);

  useEffect(() => {
    setVisitedTabs(prev => {
      if (prev.has(activeTab)) return prev;
      return new Set([...prev, activeTab]);
    });
  }, [activeTab]);

  function toggleGroup(label) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      localStorage.setItem('nav_collapsed', JSON.stringify([...next]));
      return next;
    });
  }

  function logout() {
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_me');
    window.google?.accounts?.id?.disableAutoSelect();
    setToken('');
    setMe(null);
    addToast('Logged out', 'info');
  }

  function login(t, admin) {
    sessionStorage.setItem('admin_token', t);
    sessionStorage.setItem('admin_me', JSON.stringify(admin ?? null));
    setMe(admin ?? null);
    setToken(t);
  }

  if (!token) {
    return <LoginGate onLogin={login} />;
  }

  const active = TABS.find(tab => tab.id === activeTab) ?? TABS[0];
  const ActiveIcon = active.Icon;

  function selectTab(id) {
    go(id);
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
          {NAV_GROUPS.map(group => {
            const folded = collapsed.has(group.label);
            return (
            <div key={group.label} className="mb-5 last:mb-0">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                aria-expanded={!folded}
                className="group flex w-full items-center gap-2 px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 hover:text-slate-300"
              >
                <span>{group.label}</span>
                {folded && group.ids.includes('inbox') && openCount > 0 && (
                  <span className="rounded-full bg-[#E8453C] px-1.5 py-px text-[9px] tracking-normal text-white">{openCount}</span>
                )}
                <ChevronDown size={13} className={`ml-auto transition-transform ${folded ? '-rotate-90' : ''}`} />
              </button>
              <div className="space-y-1">
                {group.ids.map(id => {
                  const tab = TABS.find(item => item.id === id);
                  if (tab.ownerOnly && me?.role !== 'owner') return null;
                  // A folded group still shows the tab you're on
                  if (folded && activeTab !== id) return null;
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
                      {id === 'inbox' && openCount > 0 && (
                        <span className="ml-auto rounded-full bg-[#E8453C] px-2 py-0.5 text-[10px] font-bold text-white">{openCount}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3">
          {me && (
            <div className="mb-2 px-3 text-xs text-slate-400">
              <div className="truncate text-slate-200">{me.label}</div>
              <div className="uppercase tracking-wider text-[10px] text-slate-500">{me.role}{me.via === 'token' ? ' · admin token' : ''}</div>
            </div>
          )}
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
            <SettingsSearch token={token} tabs={TABS} views={VIEW_LABELS} />
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
        <main className={`min-w-0 flex-1 ${activeTab === 'library' ? 'overflow-hidden' : 'p-4 sm:p-6 xl:p-8'}`}>
          {visitedTabs.has('library') && (
            <div style={{ display: activeTab === 'library' ? '' : 'none' }}>
              <Suspense fallback={<Spinner />}>
                <LibraryTab token={token} />
              </Suspense>
            </div>
          )}
          <div className="w-full" style={{ display: activeTab === 'library' ? 'none' : '' }}>
            {visitedTabs.has('inbox')      && <div style={{ display: activeTab === 'inbox'      ? '' : 'none' }}><Suspense fallback={<Spinner />}><InboxTab      token={token} /></Suspense></div>}
            {visitedTabs.has('audit')      && <div style={{ display: activeTab === 'audit'      ? '' : 'none' }}><Suspense fallback={<Spinner />}><AuditTab      token={token} /></Suspense></div>}
            {visitedTabs.has('system')     && <div style={{ display: activeTab === 'system'     ? '' : 'none' }}><Suspense fallback={<Spinner />}><SystemTab     token={token} /></Suspense></div>}
            {visitedTabs.has('safety')     && <div style={{ display: activeTab === 'safety'     ? '' : 'none' }}><Suspense fallback={<Spinner />}><SafetyTab     token={token} /></Suspense></div>}
            {visitedTabs.has('economy')    && <div style={{ display: activeTab === 'economy'    ? '' : 'none' }}><Suspense fallback={<Spinner />}><EconomyTab    token={token} /></Suspense></div>}
            {visitedTabs.has('world')      && <div style={{ display: activeTab === 'world'      ? '' : 'none' }}><Suspense fallback={<Spinner />}><GameWorldTab  token={token} /></Suspense></div>}
            {visitedTabs.has('comms')      && <div style={{ display: activeTab === 'comms'      ? '' : 'none' }}><Suspense fallback={<Spinner />}><CommsTab      token={token} /></Suspense></div>}
            {visitedTabs.has('team')       && <div style={{ display: activeTab === 'team'       ? '' : 'none' }}><Suspense fallback={<Spinner />}><TeamTab       token={token} me={me} /></Suspense></div>}
            {visitedTabs.has('analytics')  && <div style={{ display: activeTab === 'analytics'  ? '' : 'none' }}><Suspense fallback={<Spinner />}><AnalyticsTab  token={token} /></Suspense></div>}
            {visitedTabs.has('users')      && <div style={{ display: activeTab === 'users'      ? '' : 'none' }}><Suspense fallback={<Spinner />}><UsersTab      token={token} /></Suspense></div>}
            {visitedTabs.has('ai-logs')    && <div style={{ display: activeTab === 'ai-logs'    ? '' : 'none' }}><Suspense fallback={<Spinner />}><AILogsTab     token={token} /></Suspense></div>}
            {visitedTabs.has('rules')      && <div style={{ display: activeTab === 'rules'      ? '' : 'none' }}><Suspense fallback={<Spinner />}><GameRulesTab  token={token} /></Suspense></div>}
            {visitedTabs.has('bots')       && <div style={{ display: activeTab === 'bots'       ? '' : 'none' }}><Suspense fallback={<Spinner />}><BotsTab       token={token} /></Suspense></div>}
            {visitedTabs.has('live')       && <div style={{ display: activeTab === 'live'       ? '' : 'none' }}><Suspense fallback={<Spinner />}><LiveTab       token={token} /></Suspense></div>}
          </div>
        </main>
      </div>
      <PlayerDrawer token={token} />
    </div>
  );
}
