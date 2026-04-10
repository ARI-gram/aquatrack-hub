import React, { useState }           from 'react';
import { usePasswordPolicy }         from '@/hooks/usePasswordPolicy';
import { ForceChangePasswordModal }  from '@/components/dialogs/ForceChangePasswordModal';
import { PasswordExpiryBanner }      from '@/components/layout/PasswordExpiryBanner';
import { useAuth }                   from '@/contexts/AuthContext';
import { cn }                        from '@/lib/utils';
import { AppSidebar }                from './AppSidebar';
import { Header }                    from './Header';

interface DashboardLayoutProps {
  children:  React.ReactNode;
  title:     string;
  subtitle?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title,
  subtitle,
}) => {
  const { user }                                      = useAuth();   // ← pulls user from context
  const { mustChange, showBanner, daysLeft, reason }  = usePasswordPolicy(user ?? null);
  const [sidebarCollapsed, setSidebarCollapsed]       = useState(false);
  const [mobileMenuOpen,   setMobileMenuOpen]         = useState(false);
  const [manualChangeOpen, setManualChangeOpen]       = useState(false);

  return (
    <div className="min-h-screen bg-gradient-surface">

      {/* ── Password expiry banner — full-width, above everything ── */}
      {showBanner && daysLeft !== null && (
        <PasswordExpiryBanner
          daysLeft={daysLeft}
          onChangeNow={() => setManualChangeOpen(true)}
        />
      )}

      {/* ── Force-change modal — cannot be dismissed ── */}
      <ForceChangePasswordModal
        open={mustChange || manualChangeOpen}
        reason={reason}
      />

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn('hidden lg:block', mobileMenuOpen && 'block')}>
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Main content */}
      <div
        className={cn(
          'transition-all duration-300 ease-in-out',
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        )}
      >
        <Header
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        <main className="p-6">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};