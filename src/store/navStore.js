import { useEffect } from 'react';
import { create } from 'zustand';

// Where the Operator is: the tab, and a path inside it (the Library's selected node), kept
// in the URL hash (#/library/c12/s40/t913) so links land in the right place.
// `focus` asks a tab to show a view and a setting: the header's settings search sets it,
// the tab switches to the view, and the SettingsSection holding the key opens and scrolls to it.

function parseHash() {
  const [tab, ...path] = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { tab: tab || 'inbox', path: path.map(decodeURIComponent) };
}

function writeHash(tab, path) {
  const hash = `#/${[tab, ...path].map(encodeURIComponent).join('/')}`;
  if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
}

export const useNavStore = create((set) => ({
  ...parseHash(),
  focus: null, // { tab, view, key, nonce }
  go(tab, { path = [], view, key } = {}) {
    writeHash(tab, path);
    set({ tab, path, focus: view || key ? { tab, view, key, nonce: Date.now() } : null });
  },
  setPath(tab, path) {
    writeHash(tab, path);
    set({ tab, path });
  },
}));

window.addEventListener('hashchange', () => useNavStore.setState(parseHash()));

/** For a tab with views: switch to the view the search asked for. */
export function useFocusView(tab, setView) {
  const focus = useNavStore(s => s.focus);
  useEffect(() => {
    if (focus?.tab === tab && focus.view) setView(focus.view);
  }, [focus]);
}
