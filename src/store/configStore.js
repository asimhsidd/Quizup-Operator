import { create } from 'zustand';
import { adminFetch } from '../lib/adminUtils.jsx';

// app_config as GET /admin/config returns it ({ key, value, default, is_default, updated_at,
// meta }), shared by every SettingsSection and the header's settings search.
export const useConfigStore = create((set, get) => ({
  entries: null,
  error: '',
  loading: false,
  async load(token) {
    if (get().loading) return;
    set({ loading: true });
    try { set({ entries: await adminFetch('/admin/config', {}, token), error: '' }); }
    catch (err) { set({ error: err.message }); }
    set({ loading: false });
  },
  /** Save one value (the API checks it); throws with the API's reason on refusal. */
  async save(token, key, value) {
    await adminFetch('/admin/config', { method: 'PUT', body: { key, value } }, token);
    await get().load(token);
  },
}));
