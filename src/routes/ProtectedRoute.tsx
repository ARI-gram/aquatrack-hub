import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole, roleHierarchy } from '@/types/auth.types';
import { ROUTES } from '@/constants/routes';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  allowedRoles,
  children 
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-surface">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Check if user has higher privilege
    const userLevel = roleHierarchy[user.role];
    const hasAccess = allowedRoles.some(role => userLevel >= roleHierarchy[role]);
    
    if (!hasAccess) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
};
