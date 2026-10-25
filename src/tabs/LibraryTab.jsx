// Library: all the game's content in one place, categories → subcategories → topics →
// questions → answers. The tree on the left is for finding things; the pane on the right
// shows what's selected: a category's topics table, or one topic's questions, stats and
// generation history. The selection is in the URL (#/library/<category>/<topic>).
// API: Quizup routes/adminLibrary.js (plus the category, topic and validation routes in admin.js).
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { adminFetch, Spinner } from '../lib/adminUtils.jsx';
import { socket } from '../lib/socket';
import { useNavStore } from '../store/navStore';
import SettingsSection from '../components/SettingsSection.jsx';
import Tree from '../components/library/Tree.jsx';
import NodePane from '../components/library/NodePane.jsx';
import TopicPane from '../components/library/TopicPane.jsx';
import { buildTree } from '../components/library/common.jsx';

const FILTER_LABELS = { attention: 'need attention', critical: 'critical', pending: 'still generating', low: 'low on questions', healthy: 'healthy', assorted: 'assorted' };

export default function LibraryTab({ token }) {
  const path = useNavStore(s => (s.tab === 'library' ? s.path : null));
  const setPath = useNavStore(s => s.setPath);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ health: 'attention', source: '', active: '' });
  const [version, setVersion] = useState(0);
  const lastPath = useRef([]);
  const timer = useRef(null);

  // Keep the last Library path while another tab is showing
  if (path) lastPath.current = path;
  const [cat, topic] = lastPath.current;
  const selection = { cat: cat || null, topic: topic || null };

  async function load() {
    try { setData(await adminFetch('/admin/library/tree', {}, token)); setError(''); }
    catch (err) { setError(err.message); }
  }

  // Something changed (here or elsewhere): reload the tree and bump `version` so the open
  // lists reload too. Bursts (a bulk generation) are folded into one reload.
  function changed() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { load(); setVersion(x => x + 1); }, 400);
  }

  useEffect(() => {
    load();
    const events = ['admin_library_changed', 'admin_topic_updated', 'admin_topic_deleted', 'topic_ready'];
    events.forEach(e => socket.on(e, changed));
    return () => events.forEach(e => socket.off(e, changed));
  }, []);

  function select({ cat: c, topic: t } = {}) {
    setPath('library', c ? [c, ...(t ? [t] : [])] : []);
  }

  if (!data) return error ? <p className="p-6 text-sm text-red-600">{error}</p> : <Spinner />;
  const tree = buildTree(data.categories);
  const node = selection.cat === 'none' ? 'none' : tree.byId.get(selection.cat) ?? null;
  const totals = node && node !== 'none' ? node.totals
    : tree.roots.reduce((a, r) => { for (const k of Object.keys(r.totals)) a[k] = (a[k] ?? 0) + r.totals[k]; return a; }, {});
  const counts = { roots: tree.roots.length, subs: data.categories.length - tree.roots.length };
  const filtered = filters.health || filters.source || filters.active;

  return (
    <div className="flex flex-col md:flex-row" style={{ height: 'calc(100dvh - 72px)' }}>
      <aside className={`flex-col border-r border-[#E0E0E0] bg-white md:flex md:w-[320px] md:shrink-0 ${selection.cat || selection.topic ? 'hidden' : 'flex'}`}>
        {filtered && (
          <div className="flex items-center gap-2 border-b border-[#E0E0E0] bg-[#FFF5F4] px-3 py-1.5 text-xs text-[#1A1A2E]">
            <span className="flex-1">
              Showing topics {[FILTER_LABELS[filters.health], filters.source && `from ${filters.source}`, filters.active && `switched ${filters.active}`].filter(Boolean).join(', ')}
            </span>
            <button type="button" onClick={() => setFilters({ health: '', source: '', active: '' })}
                    className="flex items-center gap-1 font-semibold text-[#E8453C] hover:underline"><X size={12} /> Show all</button>
          </div>
        )}
        <div className="min-h-0 flex-1">
          <Tree token={token} tree={tree} uncategorised={data.uncategorised} selection={selection} onSelect={select} filters={filters} version={version} />
        </div>
      </aside>

      <section className={`min-w-0 flex-1 overflow-y-auto bg-[#F8F9FA] ${selection.cat || selection.topic ? 'block' : 'hidden md:block'}`}>
        {(selection.cat || selection.topic) && (
          <button type="button" onClick={() => select({})} className="px-4 pt-3 text-sm font-semibold text-gray-500 md:hidden">‹ Library</button>
        )}
        {selection.topic
          ? <TopicPane key={selection.topic} token={token} topicId={selection.topic} tree={tree} onSelect={select} onChanged={changed} />
          : <NodePane key={selection.cat ?? 'all'} token={token} node={node} tree={tree} totals={totals} categoryCounts={counts}
                      filters={filters} setFilters={setFilters} onSelect={select} version={version} onChanged={changed} />}
        {!selection.cat && !selection.topic && (
          <div className="px-4 pb-6 sm:px-6"><SettingsSection token={token} tab="library" title="Content settings" /></div>
        )}
      </section>
    </div>
  );
}
