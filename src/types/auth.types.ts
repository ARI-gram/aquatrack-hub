/**
 * Auth Types
 * src/types/auth.types.ts
 */

export type UserRole =
  | 'super_admin'
  | 'client_admin'
  | 'site_manager'
  | 'driver'
  | 'accountant'
  | 'customer';

export interface User {
  id:         string;
  email:      string;
  firstName:  string;
  lastName:   string;
  role:       UserRole;
  avatar?:    string;
  clientId?:  string;
  createdAt:  string;
  updatedAt:  string;
  must_change_password: boolean;
  password_changed_at: string | null;
}

export interface AuthState {
  user:            User | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
}

export interface LoginCredentials {
  email:    string;
  password: string;
}

export interface AuthContextType extends AuthState {
  login:         (emailOrCredentials: string | LoginCredentials, password?: string) => Promise<void>;
  logout:        () => void;
  hasPermission: (requiredRole: UserRole | UserRole[]) => boolean;
}

export const roleHierarchy: Record<UserRole, number> = {
  super_admin:  5,
  client_admin: 4,
  site_manager: 3,
  accountant:   3,   // same level as site_manager — different domain
  driver:       2,
  customer:     1,
};

export const roleLabels: Record<UserRole, string> = {
  super_admin:  'Super Admin',
  client_admin: 'Client Admin',
  site_manager: 'Site Manager',
  accountant:   'Accountant',
  driver:       'Driver',
  customer:     'Customer',
};

export const roleColors: Record<UserRole, string> = {
  super_admin:  'bg-gradient-ocean text-primary-foreground',
  client_admin: 'bg-primary text-primary-foreground',
  site_manager: 'bg-accent text-accent-foreground',
  accountant:   'bg-violet-600 text-white',
  driver:       'bg-success text-success-foreground',
  customer:     'bg-secondary text-secondary-foreground',
};