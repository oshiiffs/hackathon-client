import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from './apiClient';

let socket: Socket | null = null;

/**
 * The same httpOnly session cookie used for REST auth rides along on the
 * Socket.IO handshake automatically because of `withCredentials: true` — there
 * is no token for this client to hold or pass explicitly.
 */
export function connectSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (socket) socket.disconnect();

  // An empty API_BASE_URL means "same origin" (see apiClient.ts) — passing
  // that through as-is would make socket.io-client treat it as a literal
  // empty host, so fall back to `undefined`, which is socket.io-client's own
  // signal to connect to the page's current origin.
  socket = io(API_BASE_URL || undefined, {
    withCredentials: true,
    // Polling first, then opportunistically upgrade to websocket — NOT
    // websocket-first. In production this connection goes through
    // vercel.json's /socket.io/* rewrite to the Render backend, and a raw
    // websocket upgrade doesn't reliably tunnel through that rewrite (shows
    // up as a hard "WebSocket connection failed" in the console, retried
    // forever since `reconnection: true` keeps trying the same losing
    // transport first). Polling is a plain HTTP request the rewrite proxies
    // without issue, so starting there always works; the upgrade attempt
    // after that is best-effort and fails silently (no error, no retry loop)
    // if it can't complete, same as socket.io-client's own default order —
    // this was previously overridden to the wrong order.
    transports: ['polling', 'websocket'],
    reconnection: true,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
