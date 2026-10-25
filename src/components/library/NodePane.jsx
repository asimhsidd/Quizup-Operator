// The Library's right pane for a category, a subcategory, "All topics" or "Uncategorised":
// what it holds, its own controls (rename, enable, validate, add) and the topics table
// scoped to it.
import { useState } from 'react';
import { Pencil, Trash2, ShieldCheck, Plus, Upload, ListPlus } from 'lucide-react';
import { adminFetch, Btn } from '../../lib/adminUtils.jsx';
import { useToastStore } from '../../lib/toastStore';
import { StatCard } from '../Panels.jsx';
import TopicTable from './TopicTable.jsx';
import ImportTopics from './ImportTopics.jsx';
import { AddTopicModal, BatchTopicCreator } from './TopicCreators.jsx';
import { useValidation } from './useValidation.js';

const n = v => Number(v ?? 0).toLocaleString();

function Stats({ totals, categories }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {!categories && <StatCard label="Topics" value={n(totals.topics)} sub={`${totals.off ? `${n(totals.off)} off · ` : ''}${n(totals.assorted)} assorted`} />}
      {categories && <StatCard label="Categories" value={n(categories.roots)} sub={`${n(categories.subs)} subcategories · ${n(totals.topics)} topics`} />}
      <StatCard label="Questions" value={n(totals.questions)} sub={`${n(totals.games)} games played`} />
      <StatCard label="Need questions" value={n(totals.critical + totals.pending)}
                sub={`${n(totals.critical)} critical · ${n(totals.pending)} generating · ${n(totals.low)} low`} />
      <StatCard label="Questions to review" value={n(totals.flagged + totals.reported)} sub={`${n(totals.flagged)} flagged · ${n(totals.reported)} reported`} />
    </div>
  );
}

// Rename / icon / order for a category, and its Enabled switch
function CategoryHeader({ token, node, parent, onChanged, onDeleted }) {
  const [edit, setEdit] = useState(null);
  const [adding, setAdding] = useState(null);
  const { addToast } = useToastStore();
  const empty = node.totals.topics + node.totals.assorted === 0 && node.subs.length === 0;

  async function patch(body, msg) {
    try { await adminFetch(`/admin/categories/${node.id}`, { method: 'PATCH', body }, token); addToast(msg, 'success'); onChanged(); }
    catch (err) { addToast(err.message, 'error'); }
  }
  async function addSub() {
    try {
      await adminFetch('/admin/categories', { method: 'POST', body: { name: adding.trim(), parent_id: node.id, sort_order: node.subs.length + 1 } }, token);
      addToast(`Added ${adding.trim()}`, 'success'); setAdding(null); onChanged();
    } catch (err) { addToast(err.message, 'error'); }
  }
  async function remove() {
    if (!confirm(`Delete ${node.name}?`)) return;
    try { await adminFetch(`/admin/categories/${node.id}`, { method: 'DELETE' }, token); addToast(`Deleted ${node.name}`, 'success'); onDeleted(); }
    catch (err) { addToast(err.message, 'error'); }
  }

  const field = 'rounded-lg border border-[#E0E0E0] px-2 py-1 text-sm focus:outline-none focus:border-[#E8453C]';
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {edit ? (
          <div className="flex flex-wrap items-center gap-2">
            <input value={edit.icon} onChange={e => setEdit(x => ({ ...x, icon: e.target.value }))} className={`${field} w-12 text-center`} />
            <input value={edit.name} onChange={e => setEdit(x => ({ ...x, name: e.target.value }))} className={`${field} w-56`} autoFocus />
            <label className="flex items-center gap-1 text-xs text-gray-500">Order
              <input type="number" value={edit.sort_order} onChange={e => setEdit(x => ({ ...x, sort_order: e.target.value }))} className={`${field} w-16`} />
            </label>
            <Btn variant="success" disabled={!edit.name.trim()} onClick={() => { patch({ name: edit.name.trim(), icon: edit.icon, sort_order: parseInt(edit.sort_order, 10) || 0 }, 'Saved'); setEdit(null); }}>Save</Btn>
            <Btn variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-[#1A1A2E]">{node.icon} {node.name}</h2>
            <button type="button" title="Rename" onClick={() => setEdit({ name: node.name, icon: node.icon ?? '', sort_order: node.sort_order ?? 0 })}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Pencil size={14} /></button>
          </>
        )}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm font-semibold text-gray-600">
          <input type="checkbox" className="accent-[#E8453C]" checked={node.is_active}
                 onChange={e => patch({ is_active: e.target.checked }, e.target.checked ? `${node.name} is on` : `${node.name} is off: players don't see it`)} />
          On in the game
        </label>
      </div>
      <p className="text-xs text-gray-500">
        {parent ? <>Subcategory of {parent.name}.</> : <>{node.subs.length} subcategories.</>}
        {!node.is_active && <span className="font-semibold text-red-600"> Off: players don't see it or its topics.</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {!parent && (adding === null
          ? <Btn variant="ghost" onClick={() => setAdding('')}><Plus size={12} /> Subcategory</Btn>
          : <span className="flex items-center gap-2">
              <input value={adding} onChange={e => setAdding(e.target.value)} placeholder="Subcategory name" autoFocus
                     onKeyDown={e => e.key === 'Enter' && adding.trim() && addSub()} className={`${field} w-48`} />
              <Btn variant="success" disabled={!adding.trim()} onClick={addSub}>Add</Btn>
              <Btn variant="ghost" onClick={() => setAdding(null)}>Cancel</Btn>
            </span>)}
        {empty && <Btn variant="danger" onClick={remove}><Trash2 size={12} /> Delete</Btn>}
      </div>
    </div>
  );
}

function SubActions({ token, node, onAdd, onBatch, onChanged }) {
  const v = useValidation(token, 'category', node.id, onChanged);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Btn variant="primary" onClick={onAdd}><Plus size={12} /> Add topic here</Btn>
      <Btn variant="ghost" onClick={onBatch}><ListPlus size={12} /> Add many</Btn>
      <Btn variant="ghost" disabled={v.running} onClick={v.start}><ShieldCheck size={12} /> Fact-check new questions</Btn>
      {v.label && <span className="text-xs font-mono text-blue-600">{v.label}</span>}
    </div>
  );
}

export default function NodePane({ token, node, tree, totals, categoryCounts, filters, setFilters, onSelect, version, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [batch, setBatch] = useState(false);
  const [importing, setImporting] = useState(false);
  const [newRoot, setNewRoot] = useState(null);
  const { addToast } = useToastStore();
  const isAll = !node;
  const isNone = node === 'none';
  const cat = !isAll && !isNone ? node : null;
  const parent = cat?.parent_id ? tree.byId.get(cat.parent_id) : null;
  const filedUnder = cat && (parent || cat.subs.length === 0) ? cat.id : null; // where "Add topic" files it

  async function addRoot() {
    try {
      await adminFetch('/admin/categories', { method: 'POST', body: { name: newRoot.trim(), sort_order: tree.roots.length + 1 } }, token);
      addToast(`Added ${newRoot.trim()}`, 'success'); setNewRoot(null); onChanged();
    } catch (err) { addToast(err.message, 'error'); }
  }

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      {isAll && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-lg font-bold text-[#1A1A2E]">Library</h2>
            {newRoot === null
              ? <Btn variant="ghost" onClick={() => setNewRoot('')}><Plus size={12} /> Category</Btn>
              : <span className="flex items-center gap-2">
                  <input value={newRoot} onChange={e => setNewRoot(e.target.value)} placeholder="Category name" autoFocus
                         onKeyDown={e => e.key === 'Enter' && newRoot.trim() && addRoot()}
                         className="w-48 rounded-lg border border-[#E0E0E0] px-2 py-1 text-sm focus:outline-none focus:border-[#E8453C]" />
                  <Btn variant="success" disabled={!newRoot.trim()} onClick={addRoot}>Add</Btn>
                  <Btn variant="ghost" onClick={() => setNewRoot(null)}>Cancel</Btn>
                </span>}
            <Btn variant="ghost" onClick={() => setAdding(true)}><Plus size={12} /> Topic</Btn>
            <Btn variant="ghost" onClick={() => setBatch(true)}><ListPlus size={12} /> Add many</Btn>
            <Btn variant={importing ? 'coral' : 'ghost'} onClick={() => setImporting(x => !x)}><Upload size={12} /> Import</Btn>
          </div>
          <p className="text-xs text-gray-500">Every category, subcategory, topic and question. New topics without a category are filed by the categorisation job.</p>
        </div>
      )}
      {isNone && (
        <div>
          <h2 className="text-lg font-bold text-[#1A1A2E]">Uncategorised</h2>
          <p className="text-xs text-gray-500">Topics with no category. The categorisation job files them; pick some and use Move to… to do it by hand.</p>
        </div>
      )}
      {cat && <CategoryHeader token={token} node={cat} parent={parent} onChanged={onChanged} onDeleted={() => { onSelect(parent ? { cat: parent.id } : {}); onChanged(); }} />}
      {cat && (parent || cat.subs.length === 0) && <SubActions token={token} node={cat} onAdd={() => setAdding(true)} onBatch={() => setBatch(true)} onChanged={onChanged} />}

      {importing && <ImportTopics token={token} />}
      {!isNone && <Stats totals={totals} categories={isAll ? categoryCounts : null} />}

      {cat && !parent && cat.subs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {cat.subs.map(s => (
            <button key={s.id} type="button" onClick={() => onSelect({ cat: s.id })}
                    className={`rounded-lg border px-3 py-1.5 text-left text-xs hover:border-[#E8453C] ${s.is_active ? 'border-[#E0E0E0] bg-white' : 'border-dashed border-gray-300 bg-gray-50 text-gray-400'}`}>
              <span className="font-semibold text-[#1A1A2E]">{s.name}</span>
              <span className="ml-1.5 text-gray-400">{s.totals.topics}</span>
              {s.totals.critical + s.totals.pending > 0 && <span className="ml-1.5 font-semibold text-red-600">{s.totals.critical + s.totals.pending} need questions</span>}
            </button>
          ))}
        </div>
      )}

      <TopicTable
        token={token}
        category={isAll ? null : isNone ? 'none' : cat.id}
        scopedToSub={!!parent}
        roots={tree.roots}
        filters={filters}
        setFilters={setFilters}
        version={version}
        onChanged={onChanged}
        onOpenTopic={t => onSelect({ cat: t.category_id ?? 'none', topic: t.id })}
      />

      {adding && <AddTopicModal token={token} categoryId={filedUnder} onClose={() => { setAdding(false); onChanged(); }} />}
      {batch && <BatchTopicCreator token={token} categoryId={filedUnder} onClose={() => { setBatch(false); onChanged(); }} />}
    </div>
  );
}
