# KWIZ Operator

The operator (admin) panel for [KWIZ.LIVE](https://kwiz.live). Split out of the game repo
(`Quizup`, formerly `frontend/src/pages/Admin.jsx`) so the game can ship as a native-only
Capacitor app while the operator panel stays a small web app.

It's a frontend only. The admin API (`/api/admin/*`), the admin socket room and the
`ADMIN_TOKEN` all stay in the Quizup backend.

## Run locally

Start the KWIZ backend first (`Quizup/docs/local-dev.md`), then:

```bash
npm install
npm run dev        # http://localhost:5174, proxies /api and /socket.io to localhost:3001
npm run lint
npm run build
```

Log in with the backend's `ADMIN_TOKEN`; it's exchanged for a short-lived JWT kept in
`sessionStorage`.

## Deploy

1. Build with `VITE_BACKEND_URL=https://play.kwiz.live` (a Docker build arg; it's baked in).
   The Dockerfile serves the static build with nginx on port 80.
2. On the backend, add this app's origin to `EXTRA_ORIGINS`
   (e.g. `EXTRA_ORIGINS=https://ops.kwiz.live`). Without that, CORS blocks the API and the
   socket handshake.

## Layout

| Path | What |
|---|---|
| `src/App.jsx` | Login gate, tab bar, keep-alive tab mounting, admin socket |
| `src/tabs/*Tab.jsx` | One file per tab (Analytics, Users, Categories, Topics, Logs, Config, Reports, Themes, Bots, Live) |
| `src/lib/adminUtils.jsx` | `adminFetch`, `adminUpload`, and shared table/button helpers |
| `src/lib/config.js` | `BACKEND_URL` from `VITE_BACKEND_URL` |
| `src/lib/socket.js` | Admin-only Socket.IO client (`auth.adminToken`, never a game JWT) |
