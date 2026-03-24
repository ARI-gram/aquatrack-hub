// src/components/routing/StaffProtectedRoute.tsx

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { CUSTOMER_ROUTES } from '@/constants/customerRoutes';

interface Props {
  children:      React.ReactNode;
  allowedRoles?: string[];
}

export const StaffProtectedRoute: React.FC<Props> = ({ children, allowedRoles }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Not logged in → staff login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Customer landed on a staff route → send to customer portal.
  // DO NOT clear storage — they have a valid customer session.
  if (user.role === 'customer') {
    return <Navigate to={CUSTOMER_ROUTES.DASHBOARD} replace />;
  }

  // Role-based access check
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};