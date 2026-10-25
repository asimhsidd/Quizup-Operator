// Economy → Store & pricing: the shop's catalogue (store_products in the KWIZ API). Each row is a
// Google Play product: what it gives and how the shop shows it. Money prices are set in
// Play Console, not here (Play localises them), and a SKU only sells once it exists there
// with the same id. The coin, KWIZ+ and ad settings sit under it in the same view; lifeline
// prices are in Game rules. docs/monetisation-plan.md in the KWIZ repo.
import { useEffect, useState } from 'react';
import { adminFetch, Badge, Btn, Spinner } from '../lib/adminUtils.jsx';
import { useToastStore } from '../lib/toastStore';

const BLANK = { sku: '', kind: 'coins', coins: '', label: '', badge: '', one_time: false, sort: '', active: true };

export default function StoreCatalogue({ token }) {
  const [products, setProducts] = useState(null);
  const [edit, setEdit] = useState(null); // the row being edited (a copy), or a new one
  const [busy, setBusy] = useState(false);
  const { addToast } = useToastStore();

  async function load() {
    try { setProducts((await adminFetch('/admin/store/products', {}, token)).products); }
    catch (err) { addToast(err.message, 'error'); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setBusy(true);
    try {
      await adminFetch(`/admin/store/products/${encodeURIComponent(edit.sku.trim())}`, {
        method: 'PUT',
        body: { ...edit, coins: parseInt(edit.coins || 0, 10), sort: parseInt(edit.sort || 0, 10) },
      }, token);
      addToast(`${edit.sku} saved`, 'success');
      setEdit(null);
      await load();
    } catch (err) { addToast(err.message, 'error'); }
    setBusy(false);
  }

  async function remove(sku) {
    if (!confirm(`Remove ${sku} from the shop? Past purchases keep their record.`)) return;
    try { await adminFetch(`/admin/store/products/${encodeURIComponent(sku)}`, { method: 'DELETE' }, token); await load(); }
    catch (err) { addToast(err.message, 'error'); }
  }

  if (!products) return <Spinner />;
  const field = (key, props = {}) => (
    <input value={edit[key] ?? ''} onChange={e => setEdit(x => ({ ...x, [key]: e.target.value }))}
           className="border border-[#E0E0E0] rounded px-2 py-1 text-sm w-full" {...props} />
  );

  return (
    <div className="flex flex-col gap-5">
      <section className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-2">
        <h2 className="text-lg font-bold text-[#1A1A2E]">Shop catalogue</h2>
        <p className="text-sm text-gray-600">
          What each Google Play product gives. <b>Prices are set in Play Console</b> (Monetise → Products), and
          the SKU here must match Play's product id exactly. A coin pack is a one-time (consumable) product;
          KWIZ+ is the subscription <code>kwiz_plus</code> with base plans <code>monthly</code> and <code>yearly</code>.
        </p>
        <div><Btn variant="primary" onClick={() => setEdit({ ...BLANK, isNew: true })}>+ Add product</Btn></div>
      </section>

      {edit && (
        <section className="bg-amber-50 rounded-xl border border-amber-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <label className="flex flex-col gap-1">SKU (Play product id){field('sku', { disabled: !edit.isNew, placeholder: 'coins_medium' })}</label>
          <label className="flex flex-col gap-1">Kind
            <select value={edit.kind} onChange={e => setEdit(x => ({ ...x, kind: e.target.value }))} className="border border-[#E0E0E0] rounded px-2 py-1">
              <option value="coins">coins (consumable pack)</option>
              <option value="plus">plus (KWIZ+ subscription)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">Coins it gives{field('coins', { type: 'number', min: 0, disabled: edit.kind === 'plus' })}</label>
          <label className="flex flex-col gap-1">Label{field('label', { placeholder: 'Stack' })}</label>
          <label className="flex flex-col gap-1">Badge (optional){field('badge', { placeholder: 'Most popular' })}</label>
          <label className="flex flex-col gap-1">Sort (low first){field('sort', { type: 'number' })}</label>
          <label className="flex items-center gap-2 mt-5"><input type="checkbox" checked={!!edit.one_time} onChange={e => setEdit(x => ({ ...x, one_time: e.target.checked }))} /> Once per account</label>
          <label className="flex items-center gap-2 mt-5"><input type="checkbox" checked={edit.active !== false} onChange={e => setEdit(x => ({ ...x, active: e.target.checked }))} /> In the shop</label>
          <div className="col-span-2 md:col-span-4 flex gap-2">
            <Btn variant="success" disabled={busy || !edit.sku || !edit.label} onClick={save}>{busy ? 'Saving…' : 'Save'}</Btn>
            <Btn variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn>
          </div>
        </section>
      )}

      <div className="overflow-x-auto bg-white border border-[#E0E0E0] rounded-xl shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              {['SKU', 'Kind', 'Coins', 'Label', 'Badge', 'Once', 'Sort', 'State', ''].map(h => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.sku} className="border-b border-gray-100">
                <td className="px-4 py-2 font-mono text-xs">{p.sku}</td>
                <td className="px-4 py-2">{p.kind}</td>
                <td className="px-4 py-2 font-bold text-amber-600">{p.kind === 'coins' ? p.coins.toLocaleString() : '—'}</td>
                <td className="px-4 py-2">{p.label}</td>
                <td className="px-4 py-2 text-gray-500">{p.badge ?? ''}</td>
                <td className="px-4 py-2">{p.one_time ? 'yes' : ''}</td>
                <td className="px-4 py-2 text-gray-500">{p.sort}</td>
                <td className="px-4 py-2">{p.active ? <Badge color="bg-green-100 text-green-700">in shop</Badge> : <Badge color="bg-gray-100 text-gray-600">hidden</Badge>}</td>
                <td className="px-4 py-2 flex gap-2">
                  <Btn variant="ghost" onClick={() => setEdit({ ...p, badge: p.badge ?? '' })}>Edit</Btn>
                  <Btn variant="danger" onClick={() => remove(p.sku)}>Remove</Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
