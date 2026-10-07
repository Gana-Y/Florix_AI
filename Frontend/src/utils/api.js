import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Decode JWT payload safely with Base64URL and UTF-8 support */
const decodeToken = (token) => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

/** Flag set during intentional logout — suppresses 401 "session expired" toast */
let _intentionalLogout = false;

export const markIntentionalLogout = () => { _intentionalLogout = true; };

/** Schedule a "session expiring soon" warning toast 5 min before expiry */
let _warnTimer = null;
let _expireTimer = null;

export const scheduleSessionWarning = (token) => {
  clearTimeout(_warnTimer);
  clearTimeout(_expireTimer);
  const payload = decodeToken(token);
  if (!payload?.exp) return;

  const expiresMs = payload.exp * 1000;
  const nowMs = Date.now();
  const msUntilExpiry = expiresMs - nowMs;
  const warnAt = msUntilExpiry - 5 * 60 * 1000; // 5 min before expiry

  if (warnAt > 0) {
    _warnTimer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('florix:session-expiring'));
    }, warnAt);
  }

  if (msUntilExpiry > 0) {
    _expireTimer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('florix:session-expired'));
    }, msUntilExpiry);
  }
};

export const clearSessionTimers = () => {
  clearTimeout(_warnTimer);
  clearTimeout(_expireTimer);
};

// On load, schedule warning for existing token
const _existingToken = localStorage.getItem('token');
if (_existingToken) scheduleSessionWarning(_existingToken);

// ── Request Interceptor: attach JWT ──────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let _isRefreshing = false;
let _failedQueue = [];

const processQueue = (error, token = null) => {
  _failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  _failedQueue = [];
};

// ── Response Interceptor: handle 401, 402 ────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isAuthEndpoint = ['/login', '/signup', '/refresh-token'].some((p) => url.includes(p));

    // 401 handling
    if (status === 401 && !isAuthEndpoint && !error.config._retried) {
      error.config._retried = true;

      // If user intentionally logged out, suppress the "session expired" message
      if (_intentionalLogout) {
        _intentionalLogout = false;
        return Promise.reject(error);
      }

      // No token means not logged in or token removed — dispatch session expired to clear state & route to login
      const token = localStorage.getItem('token');
      if (!token) {
        window.dispatchEvent(new CustomEvent('florix:session-expired'));
        return Promise.reject(error);
      }

      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            error.config.headers.Authorization = `Bearer ${newToken}`;
            return api.request(error.config);
          })
          .catch((err) => Promise.reject(err));
      }

      _isRefreshing = true;

      // Try silent token refresh
      try {
        const payload = decodeToken(token);
        if (payload?.exp && payload.exp * 1000 > Date.now() - 3600_000) {
          const res = await api.post('/refresh-token');
          const newToken = res.data.access_token;
          localStorage.setItem('token', newToken);
          scheduleSessionWarning(newToken);
          error.config.headers.Authorization = `Bearer ${newToken}`;
          processQueue(null, newToken);
          _isRefreshing = false;
          return api.request(error.config);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
      } finally {
        _isRefreshing = false;
      }

      localStorage.removeItem('token');
      clearSessionTimers();
      window.dispatchEvent(new CustomEvent('florix:session-expired'));
    }

    // 402 — plan limit reached
    if (status === 402) {
      window.dispatchEvent(
        new CustomEvent('florix:upgrade-required', {
          detail: { message: error.response?.data?.detail },
        })
      );
    }

    return Promise.reject(error);
  }
);

export default api;
