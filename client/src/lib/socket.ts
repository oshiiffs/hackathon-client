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

  socket = io(API_BASE_URL, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
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
