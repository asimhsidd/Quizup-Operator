# CLAUDE.md — KWIZ Operator

The admin panel for KWIZ.LIVE, split out of the game repo at `/home/asim/Quizup`. A Vite +
React 18 + Tailwind 3 web app with no backend of its own: everything goes to the Quizup
backend's `/api/admin/*` routes and its admin socket room.

- **The API lives in Quizup.** Changing an admin feature usually means editing
  `Quizup/backend/routes/admin.js` (or `analytics.js`, `themes.js`) as well as a tab here.
  Read `Quizup/CLAUDE.md` and the matching `Quizup/docs/*.md` before touching the backend.
- **Auth:** the login form exchanges the raw `ADMIN_TOKEN` for a short-lived JWT
  (`POST /api/admin/login`), sent as `x-admin-token` on every request and as
  `socket.auth.adminToken` on the socket. Never send a game user JWT from this app.
- **Backend URL:** `VITE_BACKEND_URL` (build time). Empty in dev, where Vite proxies to
  `localhost:3001`. In production the backend must list this origin in `EXTRA_ORIGINS`.
- **Socket listeners:** pass the handler to `socket.off(event, handler)`.
- **Verify locally** against the Quizup local stack, not prod.

```bash
npm run dev     # http://localhost:5174
npm run lint && npm run build
```
