# CLAUDE.md — KWIZ Operator

The admin panel for KWIZ.LIVE, split out of the game repo at `/home/asim/Quizup`. A Vite +
React 18 + Tailwind 3 web app with no backend of its own: everything goes to the Quizup
backend's `/api/admin/*` routes and its admin socket room.

- **The API lives in Quizup.** Changing an admin feature usually means editing
  `Quizup/backend/routes/admin.js` (or `analytics.js`, `themes.js`) as well as a tab here.
  Read `Quizup/CLAUDE.md` and the matching `Quizup/docs/*.md` before touching the backend.
- **Auth:** admins sign in with Google (`POST /api/admin/login/google`, the email must be in Team) or, as
  break-glass, with the raw `ADMIN_TOKEN` (`POST /api/admin/login`). Either returns a 4-hour admin JWT, sent as
  `x-admin-token` on every request and as `socket.auth.adminToken` on the socket. Agents use an API key
  (`x-admin-key`) instead. A plain 403 "Forbidden" signs the Operator out (`SESSION_EXPIRED` in
  `lib/adminUtils.jsx`). Never send a game user JWT from this app. Details: `Quizup/docs/platform.md` → Operator admins.
- **Every write is audited by the API**, so there is nothing to do here for that. The Audit log tab shows it.
- **Settings labels come from the API** (`Quizup/backend/services/configSchema.js`); don't add them here.
  There is no Config tab: each setting shows in the tab that owns it (`src/lib/settingsHome.js` maps
  group or key → tab and view; an unmapped group lands in Game rules), drawn by `components/SettingsSection.jsx`.
  The header's settings search jumps to any of them.
- **Google sign-in** needs this app's origin (`https://operator.kwiz.live`, `http://localhost:5174`) in the
  Google Web client's authorised JavaScript origins.
- **Backend URL:** `VITE_BACKEND_URL` (build time). Empty in dev, where Vite proxies to
  `localhost:3001`. In production the backend must list this origin in `EXTRA_ORIGINS`.
- **Socket listeners:** pass the handler to `socket.off(event, handler)`.
- **Deploy:** push to `main` → GitHub Actions → GHCR → Coolify (`operator.kwiz.live`). Runbook: `Quizup/docs/deployment.md`.
- **Verify locally** against the Quizup local stack, not prod.

```bash
npm run dev     # http://localhost:5174
npm run lint && npm run build
```
