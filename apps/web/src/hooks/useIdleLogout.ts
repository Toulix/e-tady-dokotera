import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { apiClient } from '../api/client';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * AUTO-LOGOUT on inactivity (LOW-04 security fix).
 *
 * Why this exists: simply clearing the Zustand store on idle leaves the
 * httpOnly refresh-token cookie and the Redis session alive — an attacker
 * with cookie access could keep refreshing forever.
 *
 * How it works: after 30 minutes without user interaction we call
 * POST /auth/logout (server deletes the Redis session and clears the cookie),
 * then wipe the in-memory access token regardless of whether the request
 * succeeded (network may already be gone).
 */
export function useIdleLogout() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    // Only activate when the user is authenticated
    if (!accessToken) return;

    const resetTimer = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        try {
          await apiClient.post('/auth/logout');
        } finally {
          clearAuth();
          window.location.href = '/auth/login';
        }
      }, IDLE_TIMEOUT_MS);
    };

    const events: (keyof WindowEventMap)[] = [
      'mousemove',
      'keydown',
      'click',
      'touchstart',
    ];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [accessToken, clearAuth]);
}
