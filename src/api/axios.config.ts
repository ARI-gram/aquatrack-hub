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
// Instead of window.location.href (hard reload that wipes React state and
// causes the "logged in → dashboard → back to login" flash), we dispatch
// a custom event that AuthContext listens to and handles with React Router.
// This keeps the React tree alive and lets the router do a clean navigation.
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

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      // ✅ Customers use OTP auth — staff refresh endpoint will always reject
      // their tokens. Skip the refresh attempt and redirect immediately.
      const role = getStoredRole();
      if (role === 'customer') {
        return Promise.reject(error); 
      }

      const refreshToken = localStorage.getItem('aquatrack_refresh_token');

      if (refreshToken) {
        try {
          const refreshUrl = `${import.meta.env.VITE_API_BASE_URL || '/api'}/auth/refresh-token/`;
          const response = await axios.post(refreshUrl, { refresh: refreshToken });
          const { access } = response.data;
          localStorage.setItem('aquatrack_token', access);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access}`;
          }
          return axiosInstance(originalRequest);
        } catch {
          clearSession();
          dispatchSessionExpired(false);
        }
      } else {
        clearSession();
        dispatchSessionExpired(false);
      }
    }

    if (error.response?.status === 403) console.error('Access forbidden');
    else if (error.response?.status === 500) console.error('Server error');

    return Promise.reject(error);
  },
);

export default axiosInstance;