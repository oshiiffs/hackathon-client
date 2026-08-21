import axios, { type AxiosError } from 'axios';
import type { ApiErrorBody } from '../types/api';
import { useAuthStore } from '../store/authStore';

// API base URL comes from a build-time env var, never a hardcoded secret. No API
// keys (Cloudinary, xAI, JWT signing secret) ever live in this client — every
// privileged operation is proxied through the server. Strip a trailing slash —
// VITE_API_URL is commonly configured with one (e.g. "https://host.onrender.com/"),
// which would otherwise double up into ".../onrender.com//api".
//
// Leaving VITE_API_URL unset in production means "same origin" (empty string)
// — vercel.json rewrites /api/* to the Render backend, so the browser sees
// every request as first-party. That's required for Safari: as of Safari 17,
// it blocks essentially all cross-site cookies regardless of SameSite/Secure,
// so a directly cross-origin API call (Vercel client -> onrender.com) can
// never reliably keep a logged-in session on iOS, no matter how the cookie
// flags are set server-side. Everything that isn't a genuine production
// build (local dev, vitest) targets an absolute URL (either VITE_API_URL
// from .env, or localhost:4000) — checking `PROD` rather than `!DEV`
// specifically, since Vite/vitest's mode isn't guaranteed to report DEV=true
// in every non-production context, and an accidentally-empty base URL in a
// test resolves relative to jsdom's own origin instead of failing loudly.
const rawApiUrl = import.meta.env.VITE_API_URL;
export const API_BASE_URL = rawApiUrl
  ? rawApiUrl.replace(/\/+$/, '')
  : import.meta.env.PROD
    ? ''
    : 'http://localhost:4000';

// Auth is an httpOnly session cookie set by the server on login — this client
// never sees or stores the raw JWT. `withCredentials` is what makes the browser
// attach that cookie to every request (and accept the Set-Cookie on login).
export const apiClient = axios.create({ baseURL: `${API_BASE_URL}/api`, withCredentials: true });

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clear();
    }
    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiErrorBody | undefined;
    if (body?.error?.message) return body.error.message;
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

export function getApiErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as ApiErrorBody | undefined)?.error?.code;
  }
  return undefined;
}
