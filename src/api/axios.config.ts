import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: Number(import.meta.env.VITE_API_TIMEOUT) || 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Public endpoints — never attach a Bearer token ──────────────────────────
const PUBLIC_ENDPOINTS = [
  '/customer/auth/send-otp/',
  '/customer/auth/verify-otp/',
  '/customers/invite/',
];

const isPublicEndpoint = (url: string | undefined): boolean => {
  if (!url) return false;
  return PUBLIC_ENDPOINTS.some((path) => url.includes(path));
};

// ─── Refresh queue ────────────────────────────────────────────────────────────
// Prevents the race condition where multiple simultaneous 401s each try to
// refresh independently, causing the second refresh to fail on a rotated token.
// Instead: the first 401 triggers the refresh; all others wait in this queue
// and are resolved/rejected once the single refresh attempt completes.
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
};

// ─── Read role BEFORE any clearing ───────────────────────────────────────────
const getStoredRole = (): string | null => {
  try {
    const stored = localStorage.getItem('aquatrack_user');
    if (!stored) return null;
    return JSON.parse(stored)?.role ?? null;
  } catch {
    return null;
  }
};

// ─── Centralised session clear ────────────────────────────────────────────────
const clearSession = () => {
  localStorage.removeItem('aquatrack_token');
  localStorage.removeItem('aquatrack_refresh_token');
  localStorage.removeItem('aquatrack_user');
  localStorage.removeItem('customer_data');
};

// ─── Soft logout via custom event ────────────────────────────────────────────
const dispatchSessionExpired = (isCustomer: boolean) => {
  window.dispatchEvent(
    new CustomEvent('aquatrack:session-expired', {
      detail: { isCustomer },
    })
  );
};

// ─── Request interceptor ─────────────────────────────────────────────────────
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (isPublicEndpoint(config.url)) return config;
    const token = localStorage.getItem('aquatrack_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

// ─── Response interceptor ────────────────────────────────────────────────────
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      if (error.response?.status === 403) console.error('Access forbidden');
      else if (error.response?.status === 500) console.error('Server error');
      return Promise.reject(error);
    }

    // ── If a refresh is already in flight, queue this request ────────────────
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        return axiosInstance(originalRequest);
      });
    }

    // ── First 401: attempt the token refresh ─────────────────────────────────
    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem('aquatrack_refresh_token');
    const role         = getStoredRole();
    const isCustomer   = role === 'customer';

    if (!refreshToken) {
      isRefreshing = false;
      processQueue(error, null);
      clearSession();
      dispatchSessionExpired(isCustomer);
      return Promise.reject(error);
    }

    try {
      const refreshUrl = `${import.meta.env.VITE_API_BASE_URL || '/api'}/auth/refresh-token/`;
      const response   = await axios.post(refreshUrl, { refresh: refreshToken });
      const { access } = response.data;

      localStorage.setItem('aquatrack_token', access);

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${access}`;
      }

      // Let all queued requests through with the new token
      processQueue(null, access);

      return axiosInstance(originalRequest);
    } catch (refreshError) {
      // Refresh failed — reject queued requests and log out
      processQueue(refreshError, null);
      clearSession();
      dispatchSessionExpired(isCustomer);
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default axiosInstance;