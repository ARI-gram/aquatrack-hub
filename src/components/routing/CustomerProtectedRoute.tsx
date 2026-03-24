// src/components/routing/CustomerProtectedRoute.tsx

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { CUSTOMER_ROUTES } from '@/constants/customerRoutes';

interface Props {
  children: React.ReactNode;
}

export const CustomerProtectedRoute: React.FC<Props> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // Wait for AuthContext to finish reading localStorage on mount.
  // Without this guard, user is null for one render even when a valid
  // session exists, causing an incorrect redirect.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Not logged in at all → send to customer login
  if (!user) {
    return (
      <Navigate
        to={CUSTOMER_ROUTES.LOGIN}
        state={{ from: location }}
        replace
      />
    );
  }

  // Logged in as staff → send to staff login.
  // DO NOT clear localStorage — they have a valid staff session.
  if (user.role !== 'customer') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};