// src/pages/accounts/AccountsLayout.tsx

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AccountantLayout } from '@/components/layout/AccountantLayout';
import { DashboardLayout }  from '@/components/layout/DashboardLayout';

interface AccountsLayoutProps {
  children:        React.ReactNode;
  title:           string;
  subtitle?:       string;
  showBackButton?: boolean;
  onBack?:         () => void;
}

export const AccountsLayout: React.FC<AccountsLayoutProps> = ({
  children,
  title,
  subtitle,
  showBackButton,
  onBack,
}) => {
  const { user, isLoading } = useAuth();

  // ── Wait for auth to resolve before committing a layout shell ──────────────
  // Without this guard, user is null on first render → DashboardLayout mounts →
  // the client-admin shell renders even for accountants.
  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user.role === 'accountant') {
    return (
      <AccountantLayout
        title={title}
        subtitle={subtitle}
        showBackButton={showBackButton}
        onBack={onBack}
      >
        {children}
      </AccountantLayout>
    );
  }

  // client_admin and super_admin
  return (
    <DashboardLayout title={title} subtitle={subtitle}>
      {children}
    </DashboardLayout>
  );
};

export default AccountsLayout;