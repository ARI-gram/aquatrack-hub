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
  const { user }                                     = useAuth();
  const { mustChange, showBanner, daysLeft, reason } = usePasswordPolicy(user ?? null);
  const [sidebarCollapsed, setSidebarCollapsed]      = useState(false);
  const [mobileOpen,       setMobileOpen]            = useState(false);
  const [manualChangeOpen, setManualChangeOpen]      = useState(false);

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

      {/* ── Mobile backdrop overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar — single instance; translate drives mobile open/close ── */}
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(prev => !prev)}
        mobileOpen={mobileOpen}
        onMobileOpen={() => setMobileOpen(true)}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* ── Main content ── */}
      <div
        className={cn(
          'transition-all duration-300 ease-in-out',
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64',
          // Mobile: clear fixed top bar + fixed bottom nav
          'pt-14 pb-16 lg:pt-0 lg:pb-0',
        )}
      >
        <Header
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setMobileOpen(prev => !prev)}
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