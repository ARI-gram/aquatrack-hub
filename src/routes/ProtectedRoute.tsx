// src/routes/ProtectedRoute.tsx

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES, roleDefaultRoutes } from '@/constants/routes';
import { CUSTOMER_ROUTES } from '@/constants/customerRoutes';

interface ProtectedRouteProps {
  allowedRoles:  string[];
  customerOnly?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  customerOnly = false,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Not logged in → appropriate login page
  if (!isAuthenticated || !user) {
    const loginPath = customerOnly ? CUSTOMER_ROUTES.LOGIN : ROUTES.LOGIN;
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  // Staff on a customer-only route → their own dashboard.
  // DO NOT clear storage — they are legitimately logged in as staff.
  if (customerOnly && user.role !== 'customer') {
    const staffHome =
      roleDefaultRoutes[user.role as keyof typeof roleDefaultRoutes] ??
      ROUTES.LOGIN;
    return <Navigate to={staffHome} replace />;
  }

  // Customer on a staff-only route → customer dashboard.
  // DO NOT clear storage — they have a valid customer session.
  if (!customerOnly && user.role === 'customer') {
    return <Navigate to={CUSTOMER_ROUTES.DASHBOARD} replace />;
  }

  // Role not in the allowed list for this route
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};