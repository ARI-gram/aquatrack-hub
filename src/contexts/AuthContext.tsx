// /src/contexts/AuthContext.tsx
import React, {
  createContext, useContext, useState,
  useCallback, useEffect,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, UserRole, AuthContextType,
  LoginCredentials, roleHierarchy,
} from '@/types/auth.types';
import authService from '@/api/services/auth.service';
import { ROUTES, roleDefaultRoutes } from '@/constants/routes';
import { CUSTOMER_ROUTES } from '@/constants/customerRoutes';

// ─── Extended context type ────────────────────────────────────────────────────
interface ExtendedAuthContextType extends AuthContextType {
  loginAsCustomer: (user: User, token: string, refreshToken: string) => void;
  refreshUser:     () => Promise<void>;
}

const AuthContext = createContext<ExtendedAuthContextType | undefined>(undefined);

// ─── Helper: where to send a user who must change password ───────────────────
function mustChangePasswordRoute(role: UserRole): string {
  switch (role) {
    case 'accountant':   return ROUTES.ACCOUNTANT.SETTINGS;
    case 'client_admin': return ROUTES.CLIENT_ADMIN.SETTINGS;
    case 'driver':       return ROUTES.DRIVER.DASHBOARD;      // no settings page yet
    case 'site_manager': return ROUTES.SITE_MANAGER.DASHBOARD;
    default:             return '/login';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user,      setUser]      = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();

  // ── Restore session on mount ──────────────────────────────────────────────
  useEffect(() => {
    const storedUser  = localStorage.getItem('aquatrack_user');
    const storedToken = localStorage.getItem('aquatrack_token');
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('aquatrack_user');
      }
    }
    setIsLoading(false);
  }, []);

  // ── Listen for session-expired events from axios interceptor ─────────────
  useEffect(() => {
    const handleExpired = (e: Event) => {
      const { isCustomer } = (e as CustomEvent<{ isCustomer: boolean }>).detail;
      setUser(null);
      navigate(isCustomer ? CUSTOMER_ROUTES.LOGIN : '/login', { replace: true });
    };

    window.addEventListener('aquatrack:session-expired', handleExpired);
    return () => window.removeEventListener('aquatrack:session-expired', handleExpired);
  }, [navigate]);

  // ── Staff login ───────────────────────────────────────────────────────────
  const login = useCallback(async (
    emailOrCredentials: string | LoginCredentials,
    password?: string,
  ) => {
    const credentials: LoginCredentials =
      typeof emailOrCredentials === 'string'
        ? { email: emailOrCredentials, password: password! }
        : emailOrCredentials;

    setIsLoading(true);
    try {
      const { user: loggedInUser, token, refreshToken } =
        await authService.login(credentials);

      localStorage.setItem('aquatrack_token',         token);
      localStorage.setItem('aquatrack_refresh_token', refreshToken);
      localStorage.setItem('aquatrack_user',          JSON.stringify(loggedInUser));

      setUser(loggedInUser);

      // ── If backend flagged a forced password change, go straight
      //    to the settings/security page — nowhere else. ──────────────────────
      if (loggedInUser.must_change_password) {
        navigate(mustChangePasswordRoute(loggedInUser.role), { replace: true });
      } else {
        navigate(roleDefaultRoutes[loggedInUser.role], { replace: true });
      }

    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  // ── Customer OTP login ────────────────────────────────────────────────────
  const loginAsCustomer = useCallback((
    customerUser: User,
    token: string,
    refreshToken: string,
  ) => {
    localStorage.setItem('aquatrack_token',         token);
    localStorage.setItem('aquatrack_refresh_token', refreshToken);
    localStorage.setItem('aquatrack_user',          JSON.stringify(customerUser));
    setUser(customerUser);
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    const wasCustomer = user?.role === 'customer';
    try {
      await authService.logout();
    } catch {
      // swallow — still clear local state
    } finally {
      setUser(null);
      localStorage.removeItem('aquatrack_token');
      localStorage.removeItem('aquatrack_refresh_token');
      localStorage.removeItem('aquatrack_user');
      localStorage.removeItem('customer_data');
      navigate(wasCustomer ? CUSTOMER_ROUTES.LOGIN : '/login', { replace: true });
    }
  }, [user, navigate]);

  // ── Refresh user ──────────────────────────────────────────────────────────
  // Called after a forced password change so the new must_change_password=false
  // value flows into context and the dialog closes automatically.
  const refreshUser = useCallback(async () => {
    try {
      const updated = await authService.getCurrentUser();
      localStorage.setItem('aquatrack_user', JSON.stringify(updated));
      setUser(updated);
    } catch {
      // if refresh fails, leave existing user state intact
    }
  }, []);

  const hasPermission = useCallback((requiredRole: UserRole | UserRole[]) => {
    if (!user) return false;
    const roles     = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const userLevel = roleHierarchy[user.role];
    return roles.some(role => userLevel >= roleHierarchy[role]);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        loginAsCustomer,
        logout,
        hasPermission,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};