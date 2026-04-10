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

      {/* ── Sidebar — renders its own mobile top bar + bottom nav ── */}
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
          // Desktop: offset for the sidebar width
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64',
          // Mobile: offset for AppSidebar's fixed top bar (h-14) and bottom nav (h-16 + safe area)
          'pt-14 lg:pt-0',
          'pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0',
        )}
      >
        {/* Desktop-only header — AppSidebar renders its own top bar on mobile */}
        <div className="hidden lg:block">
          <Header
            title={title}
            subtitle={subtitle}
            onMenuClick={() => setMobileOpen(prev => !prev)}
          />
        </div>

        {/* Mobile page title — sits below the fixed top bar */}
        {(title || subtitle) && (
          <div className="lg:hidden px-4 pt-4 pb-2">
            <h1 className="text-lg font-bold leading-tight">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
        )}

        <main className="p-4 lg:p-6">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};