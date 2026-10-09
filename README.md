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

GitHub Actions (`.github/workflows/build-and-push.yml`) lints, builds and pushes
`ghcr.io/asimhsidd/quizup-operator:main` on every push to `main`, then pings Coolify, which
pulls the image. It serves https://operator.kwiz.live from nginx on port 80.

- `VITE_BACKEND_URL` is baked in at build time: a repository variable, defaulting to
  `https://api.kwiz.live`.
- The backend must list `https://operator.kwiz.live` in `EXTRA_ORIGINS`, or CORS blocks the
  API and the socket handshake.
- Secrets `COOLIFY_WEBHOOK` + `COOLIFY_TOKEN` enable the auto-redeploy.

The full runbook is `Quizup/docs/deployment.md`.

## Layout

| Path | What |
|---|---|
| `src/App.jsx` | Login gate, tab bar, keep-alive tab mounting, admin socket |
| `src/tabs/*Tab.jsx` | One file per tab (Analytics, Users, Categories, Topics, Logs, Config, Reports, Themes, Bots, Live) |
| `src/lib/adminUtils.jsx` | `adminFetch`, `adminUpload`, and shared table/button helpers |
| `src/lib/config.js` | `BACKEND_URL` from `VITE_BACKEND_URL` |
| `src/lib/socket.js` | Admin-only Socket.IO client (`auth.adminToken`, never a game JWT) |
