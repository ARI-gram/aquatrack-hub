import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole, AuthContextType, LoginCredentials, roleHierarchy } from '@/types/auth.types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for demo
const mockUsers: Record<string, User & { password: string }> = {
  'admin@aquatrack.com': {
    id: '1',
    email: 'admin@aquatrack.com',
    password: 'admin123',
    firstName: 'System',
    lastName: 'Admin',
    role: 'super_admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  'client@aquatrack.com': {
    id: '2',
    email: 'client@aquatrack.com',
    password: 'client123',
    firstName: 'John',
    lastName: 'Distributor',
    role: 'client_admin',
    clientId: 'client-001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  'manager@aquatrack.com': {
    id: '3',
    email: 'manager@aquatrack.com',
    password: 'manager123',
    firstName: 'Sarah',
    lastName: 'Manager',
    role: 'site_manager',
    clientId: 'client-001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  'driver@aquatrack.com': {
    id: '4',
    email: 'driver@aquatrack.com',
    password: 'driver123',
    firstName: 'Mike',
    lastName: 'Driver',
    role: 'driver',
    clientId: 'client-001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  'customer@aquatrack.com': {
    id: '5',
    email: 'customer@aquatrack.com',
    password: 'customer123',
    firstName: 'Sarah',
    lastName: 'Customer',
    role: 'customer',
    clientId: 'client-001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const storedUser = localStorage.getItem('aquatrack_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const mockUser = mockUsers[credentials.email];
    
    if (!mockUser || mockUser.password !== credentials.password) {
      setIsLoading(false);
      throw new Error('Invalid email or password');
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...userWithoutPassword } = mockUser;
    setUser(userWithoutPassword);
    localStorage.setItem('aquatrack_user', JSON.stringify(userWithoutPassword));
    setIsLoading(false);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('aquatrack_user');
  }, []);

  const hasPermission = useCallback((requiredRole: UserRole | UserRole[]) => {
    if (!user) return false;
    
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
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
        logout,
        hasPermission,
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
