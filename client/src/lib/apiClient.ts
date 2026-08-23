import axios, { type AxiosError } from 'axios';
import type { ApiErrorBody } from '../types/api';
import { useAuthStore } from '../store/authStore';

// API base URL comes from a build-time env var, never a hardcoded secret. No API
// keys (Cloudinary, xAI, JWT signing secret) ever live in this client — every
// privileged operation is proxied through the server. Strip a trailing slash —
// VITE_API_URL is commonly configured with one (e.g. "https://host.onrender.com/"),
// which would otherwise double up into ".../onrender.com//api".
//
// PRODUCTION BUILDS ALWAYS USE SAME-ORIGIN (empty string), EVEN IF
// VITE_API_URL IS SET — this is deliberate, not an oversight. vercel.json
// rewrites /api/* to the Render backend, so the browser sees every request as
// first-party. That's required for Safari: as of Safari 17, it blocks
// essentially all cross-site cookies regardless of SameSite/Secure, so a
// directly cross-origin API call (Vercel client -> onrender.com) can never
// reliably keep a logged-in session on iOS, no matter how the cookie flags
// are set server-side — this is exactly the "login works, then immediately
// bounces back to the login screen" iOS bug, and it silently comes right
// back the moment VITE_API_URL is set in the production environment (e.g. in
// Vercel's project settings) even though the code elsewhere is written
// assuming same-origin. So rather than trust every future deploy to leave
// that field blank, a production build ignores it outright — see the
// console.warn below if that ever actually happens, so it's loud instead of
// a silent reason iOS logins mysteriously loop.
//
// Everything that isn't a genuine production build (local dev, vitest)
// still targets an absolute URL (either VITE_API_URL from .env, or
// localhost:4000) — checking `PROD` rather than `!DEV` specifically, since
// Vite/vitest's mode isn't guaranteed to report DEV=true in every
// non-production context, and an accidentally-empty base URL in a test
// resolves relative to jsdom's own origin instead of failing loudly.
const rawApiUrl = import.meta.env.VITE_API_URL;
if (rawApiUrl && import.meta.env.PROD) {
  // eslint-disable-next-line no-console
  console.warn(
    `VITE_API_URL ("${rawApiUrl}") is set but is ignored in production builds — same-origin + vercel.json's ` +
      'rewrite is required for iOS Safari to keep a logged-in session. Remove it from this deploy\'s environment ' +
      'variables (it does nothing here and just invites confusion).',
  );
}
export const API_BASE_URL = import.meta.env.PROD ? '' : rawApiUrl ? rawApiUrl.replace(/\/+$/, '') : 'http://localhost:4000';

// Auth is an httpOnly session cookie set by the server on login — this client
// never sees or stores the raw JWT. `withCredentials` is what makes the browser
// attach that cookie to every request (and accept the Set-Cookie on login).
export const apiClient = axios.create({ baseURL: `${API_BASE_URL}/api`, withCredentials: true });

// Render's free tier spins the backend process down after ~15min idle; the
// next request(s) can hit a 502/503/504 while it cold-starts back up (can
// take 30-60s). A 502 specifically means Render's own edge proxy couldn't
// reach the app process at all, so the request handler almost certainly
// never ran — safe to retry here even a POST/PATCH/DELETE, unlike a generic
// timeout that might have landed mid-write. Bounded retries with a short,
// increasing backoff turn "the whole app is broken, click Try Again" into
// "quietly waits a few seconds and just works," which is what a cold start
// actually calls for — existing callers' own loading state already covers
// the wait, no separate "retrying…" UI needed.
const MAX_TRANSIENT_RETRIES = 3;
type RetryableConfig = NonNullable<AxiosError['config']> & { __retryCount?: number };

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clear();
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const config = error.config as RetryableConfig | undefined;
    if (config && (status === 502 || status === 503 || status === 504)) {
      const attempt = (config.__retryCount ?? 0) + 1;
      if (attempt <= MAX_TRANSIENT_RETRIES) {
        config.__retryCount = attempt;
        const delayMs = attempt * 1500; // 1.5s, 3s, 4.5s
        return new Promise((resolve) => setTimeout(resolve, delayMs)).then(() => apiClient(config));
      }
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
