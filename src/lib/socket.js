import { io } from 'socket.io-client';
import { BACKEND_URL } from './config';

// Admin-only socket. It never carries a game user JWT, so the operator never shows up online
// in the game. App.jsx sets auth.adminToken, which puts it in the server's admin room, the
// only place the admin_* live updates are sent.
export const socket = io(BACKEND_URL, {
  autoConnect: false,
  auth: {},
});
