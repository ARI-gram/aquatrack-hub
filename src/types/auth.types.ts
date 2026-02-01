export type UserRole = 'super_admin' | 'client_admin' | 'site_manager' | 'driver' | 'customer';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatar?: string;
  clientId?: string; // For multi-tenant isolation
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthContextType extends AuthState {
  login: (emailOrCredentials: string | LoginCredentials, password?: string) => Promise<void>;
  logout: () => void;
  hasPermission: (requiredRole: UserRole | UserRole[]) => boolean;
}

export const roleHierarchy: Record<UserRole, number> = {
  super_admin: 5,
  client_admin: 4,
  site_manager: 3,
  driver: 2,
  customer: 1,
};

export const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  client_admin: 'Client Admin',
  site_manager: 'Site Manager',
  driver: 'Driver',
  customer: 'Customer',
};

export const roleColors: Record<UserRole, string> = {
  super_admin: 'bg-gradient-ocean text-primary-foreground',
  client_admin: 'bg-primary text-primary-foreground',
  site_manager: 'bg-accent text-accent-foreground',
  driver: 'bg-success text-success-foreground',
  customer: 'bg-secondary text-secondary-foreground',
};
