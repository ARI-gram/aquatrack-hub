/**
 * AccountsLayout
 * src/pages/accounts/AccountsLayout.tsx
 *
 * Smart layout wrapper used by all accounts pages
 * (AccountingSettingsPage, InvoicesListPage, ReportsPage, InvoiceDetailPage).
 *
 * - If the current user is an `accountant` → renders AccountantLayout
 * - If the current user is `client_admin` or `super_admin` → renders DashboardLayout
 *
 * This means each accounts page only needs to import ONE layout and works
 * correctly regardless of which role is viewing it.
 *
 * Usage:
 *   <AccountsLayout title="Invoices" subtitle="All customer invoices">
 *     <YourPageContent />
 *   </AccountsLayout>
 */

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
  const { user } = useAuth();

  if (user?.role === 'accountant') {
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

  // client_admin and super_admin use the standard dashboard layout
  return (
    <DashboardLayout title={title} subtitle={subtitle}>
      {children}
    </DashboardLayout>
  );
};

export default AccountsLayout;