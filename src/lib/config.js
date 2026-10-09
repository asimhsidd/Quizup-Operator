// Origin of the KWIZ backend, e.g. https://play.kwiz.live. Empty means same origin, which is
// what `npm run dev` uses (Vite proxies /api and /socket.io to the local backend).
// The backend must list this app's origin in EXTRA_ORIGINS, or CORS blocks every request.
export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
