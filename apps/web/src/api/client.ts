import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
  withCredentials: true, // sends httpOnly refresh_token cookie on every request
});

// Attach access token from in-memory store to every request
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Silently refresh on 401
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !(error.config as any)._retry) {
      (error.config as any)._retry = true;
      try {
        await refreshTokens();
        const token = useAuthStore.getState().accessToken;
        error.config.headers.Authorization = `Bearer ${token}`;
        return apiClient(error.config);
      } catch {
        useAuthStore.getState().clearAuth();
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  },
);

/**
 * Silently refresh the access token.
 * The browser automatically sends the httpOnly refresh_token cookie.
 * The API rotates the cookie and returns a new access_token in the body.
 */
async function refreshTokens(): Promise<void> {
  // Use a plain axios instance to avoid interceptor recursion
  const res = await axios.post(
    `${apiClient.defaults.baseURL}/auth/refresh`,
    {},
    { withCredentials: true },
  );
  useAuthStore.getState().setAccessToken(res.data.data.access_token);
}
