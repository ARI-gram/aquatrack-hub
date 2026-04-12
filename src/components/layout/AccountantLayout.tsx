/**
 * AccountantLayout
 * src/components/layout/AccountantLayout.tsx
 *
 * Changes in this revision:
 *  - Mobile sidebar is now a left-side drawer (translate-based), matching AppSidebar pattern
 *  - Bottom nav shows primary 4 items; "More" button opens the left drawer
 *  - Horizontal-scroll bottom nav removed in favour of drawer overflow
 *  - mobileOpen state lifted into AccountantLayout (no internal sidebar state)
 *  - Desktop sidebar, all nav routes, isActive(), header, and page content unchanged
 */

import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/constants/routes';
import {
  FileText, TrendingUp, Settings, LogOut, Users,
  Droplets, ChevronLeft, Calculator,
  ShoppingBag, LayoutDashboard, MoreHorizontal, X, Package, Truck, 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationBell } from '@/components/layout/NotificationBell';

// ── Nav config ────────────────────────────────────────────────────────────────

interface NavItem {
  label:    string;
  path:     string;
  icon:     React.ElementType;
  sublabel: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label:    'Dashboard',
    path:     ROUTES.ACCOUNTANT.DASHBOARD,
    icon:     LayoutDashboard,
    sublabel: 'Financial overview',
  },
  {
    label:    'Invoices',
    path:     ROUTES.ACCOUNTANT.INVOICES,
    icon:     FileText,
    sublabel: 'Issue & manage',
  },
  {
    label:    'Direct Sales',
    path:     '/client/accounts/direct-sales',
    icon:     ShoppingBag,
    sublabel: 'One-off sales',
  },
  {
    label:    'Customers',
    path:     '/client/accounts/customers',
    icon:     Users,
    sublabel: 'Balances & accounts',
  },
  {
    label:    'Reports',
    path:     ROUTES.ACCOUNTANT.REPORTS,
    icon:     TrendingUp,
    sublabel: 'Revenue & VAT',
  },
  {
    label:    'Bottle Audit',      
    path:     '/client/accounts/bottle-audit',
    icon:     Package,
    sublabel: 'Returns & losses',
  },
  {
    label:    'Settings',
    path:     ROUTES.ACCOUNTANT.SETTINGS,
    icon:     Settings,
    sublabel: 'KRA, VAT, Bank',
  },
];

const MOBILE_PRIMARY_COUNT = 4;

// ── Props ─────────────────────────────────────────────────────────────────────

interface AccountantLayoutProps {
  children:        React.ReactNode;
  title?:          string;
  subtitle?:       string;
  showBackButton?: boolean;
  onBack?:         () => void;
}

// ── Layout ────────────────────────────────────────────────────────────────────

export const AccountantLayout: React.FC<AccountantLayoutProps> = ({
  children,
  title,
  subtitle,
  showBackButton,
  onBack,
}) => {
  const { user, logout } = useAuth();
  const location         = useLocation();
  const navigate         = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === ROUTES.ACCOUNTANT.DASHBOARD) {
      return location.pathname === path;
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const initials    = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('') || '?';
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Accountant';
  const handleBack  = () => { if (onBack) onBack(); else navigate(-1); };

  const primaryItems     = NAV_ITEMS.slice(0, MOBILE_PRIMARY_COUNT);
  const overflowItems    = NAV_ITEMS.slice(MOBILE_PRIMARY_COUNT);
  const hasOverflow      = overflowItems.length > 0;
  const overflowIsActive = overflowItems.some(item => isActive(item.path));

  return (
    <div className="min-h-screen bg-background flex">

      {/* ─── Mobile backdrop overlay ──────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ─── Desktop Sidebar ──────────────────────────────────────────── */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:fixed lg:inset-y-0 border-r border-border bg-card z-30">

        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-ocean shadow-glow shrink-0">
            <Droplets className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <span className="text-base font-bold tracking-tight">AquaTrack</span>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest -mt-0.5">
              Accounts
            </p>
          </div>
        </div>

        {/* User card */}
        <div className="mx-4 mt-5 mb-4 rounded-2xl border border-violet-200 bg-violet-50/50 dark:bg-violet-950/20 dark:border-violet-800/50 p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0 ring-2 ring-violet-300 dark:ring-violet-700">
              <AvatarFallback className="bg-violet-600 text-white font-bold text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">{displayName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Calculator className="h-3 w-3 text-violet-500 shrink-0" />
                <p className="text-[11px] text-violet-600 dark:text-violet-400 font-semibold">
                  Accountant
                </p>
              </div>
            </div>
          </div>
          {user?.email && (
            <p className="mt-2.5 text-[11px] text-muted-foreground truncate border-t border-violet-200/60 dark:border-violet-800/40 pt-2.5">
              {user.email}
            </p>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 px-3 pb-2">
            Accounts Module
          </p>
          {NAV_ITEMS.map(item => {
            const active = isActive(item.path);
            const Icon   = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3.5 rounded-xl px-3 py-3 transition-all duration-200 group',
                  active
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25'
                    : 'text-muted-foreground hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-950/30 dark:hover:text-violet-300',
                )}
              >
                <div className={cn(
                  'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                  active
                    ? 'bg-white/20'
                    : 'bg-muted/50 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/40',
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-semibold leading-tight', active && 'text-white')}>
                    {item.label}
                  </p>
                  <p className={cn(
                    'text-[10px] leading-tight mt-0.5',
                    active ? 'text-white/70' : 'text-muted-foreground/60',
                  )}>
                    {item.sublabel}
                  </p>
                </div>
                {active && (
                  <div className="h-1.5 w-1.5 rounded-full bg-white/80 shrink-0" />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-4 pb-6 border-t border-border pt-4">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-destructive/8 hover:text-destructive transition-colors group"
          >
            <div className="h-8 w-8 rounded-lg bg-muted/50 group-hover:bg-destructive/10 flex items-center justify-center shrink-0 transition-colors">
              <LogOut className="h-4 w-4" />
            </div>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ─── Mobile left drawer sidebar ───────────────────────────────── */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen flex flex-col lg:hidden',
          'bg-card border-r border-border w-72',
          'transition-all duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Drawer header */}
        <div className="flex h-14 items-center justify-between px-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-ocean shadow-glow shrink-0">
              <Droplets className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold">AquaTrack</span>
              <p className="text-[10px] text-violet-500 font-semibold uppercase tracking-widest -mt-0.5">
                Accounts
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(false)}
            className="h-8 w-8 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Drawer nav — all items */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV_ITEMS.map(item => {
            const active = isActive(item.path);
            const Icon   = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group',
                  active
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25'
                    : 'text-muted-foreground hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-950/30 dark:hover:text-violet-300',
                )}
              >
                <div className={cn(
                  'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                  active
                    ? 'bg-white/20'
                    : 'bg-muted/50 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/40',
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-semibold leading-tight', active && 'text-white')}>
                    {item.label}
                  </p>
                  <p className={cn(
                    'text-[10px] leading-tight mt-0.5',
                    active ? 'text-white/70' : 'text-muted-foreground/60',
                  )}>
                    {item.sublabel}
                  </p>
                </div>
                {active && <div className="h-1.5 w-1.5 rounded-full bg-white/80 shrink-0" />}
              </NavLink>
            );
          })}
        </nav>

        {/* Drawer footer */}
        <div className="border-t border-border p-4 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-9 w-9 shrink-0 ring-2 ring-violet-300 dark:ring-violet-700">
              <AvatarFallback className="bg-violet-600 text-white font-bold text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{displayName}</p>
              <p className="text-[11px] text-violet-500 font-semibold">Accountant</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/8 hover:text-destructive transition-colors group"
          >
            <div className="h-8 w-8 rounded-lg bg-muted/50 group-hover:bg-destructive/10 flex items-center justify-center shrink-0 transition-colors">
              <LogOut className="h-4 w-4" />
            </div>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ─── Main area ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72">

        {/* Header */}
        <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
          <div className="flex items-center gap-2 flex-1 min-w-0">

            {/* Mobile: back button or logo */}
            <div className="flex lg:hidden items-center gap-2 shrink-0">
              {showBackButton ? (
                <button
                  onClick={handleBack}
                  className="flex items-center justify-center h-9 w-9 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors -ml-1"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-ocean">
                  <Droplets className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>

            {/* Desktop back button */}
            {showBackButton && (
              <button
                onClick={handleBack}
                className="hidden lg:flex items-center justify-center h-9 w-9 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}

            {/* Page title */}
            {title ? (
              <div className="min-w-0 flex-1">
                <h1 className="text-[15px] font-bold leading-tight truncate lg:text-lg">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-[11px] text-muted-foreground leading-tight truncate">
                    {subtitle}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex lg:hidden items-baseline gap-1.5 min-w-0">
                <span className="text-base font-bold">AquaTrack</span>
                <span className="text-xs text-violet-500 font-semibold">Accounts</span>
              </div>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1 shrink-0">
            <NotificationBell />

            {/* Desktop profile dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hidden lg:flex h-9 w-9 rounded-xl">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-violet-600 text-white text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-0.5">
                    <span>{displayName}</span>
                    <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <NavLink to={ROUTES.ACCOUNTANT.SETTINGS} className="cursor-pointer">
                    <Settings className="h-4 w-4 mr-2" />Accounting Settings
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile avatar */}
            <div className="flex lg:hidden">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-violet-600 text-white text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-5 lg:px-8 lg:py-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-8 overflow-x-hidden">
          <div className="max-w-5xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* ─── Mobile bottom nav — primary 4 + More drawer trigger ─────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden border-t border-border bg-background/98 backdrop-blur-xl">
        <div
          className="flex items-stretch justify-around px-1"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {primaryItems.map(item => {
            const active = isActive(item.path);
            const Icon   = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className="flex flex-col items-center justify-center gap-0.5 flex-1 pt-2 pb-2.5 min-h-[56px]"
              >
                <div className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-2xl transition-all duration-200',
                  active ? 'bg-violet-600/15 scale-110' : 'scale-100',
                )}>
                  <Icon className={cn(
                    'h-[22px] w-[22px] transition-colors',
                    active ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground',
                  )} />
                </div>
                <span className={cn(
                  'text-[10px] font-semibold tracking-wide transition-colors truncate max-w-[52px] text-center',
                  active ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground',
                )}>
                  {item.label}
                </span>
              </NavLink>
            );
          })}

          {/* More — opens the left drawer */}
          {hasOverflow && (
            <button
              onClick={() => setMobileOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 pt-2 pb-2.5 min-h-[56px]"
            >
              <div className={cn(
                'flex items-center justify-center h-8 w-8 rounded-2xl transition-all duration-200',
                overflowIsActive ? 'bg-violet-600/15 scale-110' : 'scale-100',
              )}>
                <MoreHorizontal className={cn(
                  'h-[22px] w-[22px]',
                  overflowIsActive ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground',
                )} />
              </div>
              <span className={cn(
                'text-[10px] font-semibold tracking-wide',
                overflowIsActive ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground',
              )}>
                More
              </span>
            </button>
          )}
        </div>
      </nav>

    </div>
  );
};

export default AccountantLayout;