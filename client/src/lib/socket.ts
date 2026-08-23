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
    // Polling ONLY — not "polling first, upgrade to websocket". In
    // production this connection goes through vercel.json's /socket.io/*
    // rewrite to the Render backend, and that rewrite does not tunnel a
    // websocket upgrade at all: every upgrade attempt comes back with a hard
    // "Unexpected response code: 400" during the handshake, not a timeout or
    // a graceful fallback. socket.io-client's default upgrade behavior
    // treats that as a transport worth retrying, so leaving 'websocket' in
    // this list at all — even second, as a mere upgrade candidate — means
    // every single (re)connection immediately fires off one of these
    // guaranteed-to-fail 400 attempts, and does it again on every
    // `reconnection: true` retry. With many participants connected at once
    // that's a real, continuous storm of failed handshakes hitting the
    // backend for no benefit, plausibly contributing to the slowness/502s
    // seen elsewhere. Excluding 'websocket' from `transports` entirely (not
    // just reordering it) stops the attempts outright — polling is a plain
    // HTTP request the rewrite proxies without issue, so this is the only
    // transport that actually works through this specific proxy setup.
    transports: ['polling'],
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
