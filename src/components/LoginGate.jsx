// Sign-in: Google for the admins listed in Team (the KWIZ API checks the email against
// admin_users), or the raw ADMIN_TOKEN as a break-glass owner login. Either way the API
// answers with a 4-hour admin JWT, kept in sessionStorage by App.jsx.
import { useEffect, useRef, useState } from 'react';
import { adminFetch } from '../lib/adminUtils.jsx';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    const s = existing ?? Object.assign(document.createElement('script'), { src: GIS_SRC, async: true });
    s.addEventListener('load', () => resolve());
    s.addEventListener('error', () => reject(new Error('Google sign-in did not load')));
    if (!existing) document.head.appendChild(s);
  });
}

export default function LoginGate({ onLogin }) {
  const buttonRef = useRef(null);
  const [showToken, setShowToken] = useState(false);
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { googleClientId } = await adminFetch('/admin/login/config');
        await loadGoogleScript();
        if (cancelled || !buttonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async ({ credential }) => {
            setErr('');
            setLoading(true);
            try {
              const data = await adminFetch('/admin/login/google', { method: 'POST', body: { credential } });
              onLogin(data.token, data.admin);
            } catch (e) {
              setErr(e.message || 'Google sign-in failed');
            } finally {
              setLoading(false);
            }
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, { theme: 'outline', size: 'large', width: 320, text: 'signin_with' });
        setGoogleReady(true);
      } catch {
        if (!cancelled) setShowToken(true); // no Google (offline, blocked): the token still works
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function submitToken(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const data = await adminFetch('/admin/login', { method: 'POST', body: { token: val } });
      onLogin(data.token, data.admin);
    } catch {
      setErr('Invalid admin token');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm space-y-5">
        <div>
          <h1 className="text-xl font-extrabold text-[#1A1A2E]">KWIZ Operator</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in with the Google account listed in Team.</p>
        </div>

        <div className="flex min-h-[44px] justify-center">
          <div ref={buttonRef} />
          {!googleReady && !showToken && <span className="text-sm text-gray-400 self-center">Loading Google sign-in…</span>}
        </div>

        {err && <p className="text-red-500 text-sm">{err}</p>}

        {showToken ? (
          <form onSubmit={submitToken} className="space-y-3 border-t border-gray-100 pt-4">
            <label className="block text-xs font-semibold text-gray-500">Admin token (break-glass)</label>
            <input
              type="password"
              value={val}
              onChange={e => setVal(e.target.value)}
              placeholder="ADMIN_TOKEN"
              className="w-full border border-[#E0E0E0] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#E8453C]"
            />
            <button
              type="submit"
              disabled={loading || !val}
              className="w-full bg-[#E8453C] text-white font-bold rounded-xl py-2.5 text-sm hover:bg-[#d03a32] transition-colors disabled:opacity-60"
            >
              {loading ? 'Checking…' : 'Sign in with the token'}
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setShowToken(true)} className="w-full text-xs text-gray-400 hover:text-gray-600">
            Use the admin token instead
          </button>
        )}
      </div>
    </div>
  );
}
