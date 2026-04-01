/**
 * Driver Layout Component
 * Mobile-first: 4 primary tabs + "More" drawer that exposes the remaining items.
 * Desktop keeps the full sidebar unchanged.
 *
 * Changes in this revision:
 *  - Added Receipts nav item (Receipt icon → /driver/receipts)
 *  - Receipts sits in moreNavItems (accessible via the More drawer on mobile)
 *  - Receipts sits in sidebarItems (always visible on desktop)
 */

import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  Home, Truck, ClipboardList, MapPin, User,
  LogOut, Package, Settings, ChevronLeft, Droplets,
  PackageSearch, ShoppingCart, MoreHorizontal, X,
  Receipt,                                          // ← NEW
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { ROUTES } from '@/constants/routes';

// ── Route constants ───────────────────────────────────────────────────────────

const DRIVER_ROUTES = {
  DASHBOARD:  ROUTES.DRIVER.DASHBOARD,
  DELIVERIES: ROUTES.DRIVER.DELIVERIES,
  STORE:      ROUTES.DRIVER.STORE,
  HISTORY:    '/driver/history',
  RECEIPTS:   '/driver/receipts',               // ← NEW
  MAP:        '/driver/map',
  PROFILE:    '/driver/profile',
  SETTINGS:   '/driver/settings',
  SALES:      '/driver/sales',
};

interface DriverLayoutProps {
  children:        React.ReactNode;
  title?:          string;
  subtitle?:       string;
  showBackButton?: boolean;
  onBack?:         () => void;
}

interface NavItem { label: string; path: string; icon: React.ElementType }

// ── Bottom nav: 4 primary tabs ────────────────────────────────────────────────

const primaryNavItems: NavItem[] = [
  { label: 'Home',  path: DRIVER_ROUTES.DASHBOARD,  icon: Home          },
  { label: 'Queue', path: DRIVER_ROUTES.DELIVERIES, icon: Truck         },
  { label: 'Stock', path: DRIVER_ROUTES.STORE,      icon: PackageSearch },
  { label: 'Map',   path: DRIVER_ROUTES.MAP,        icon: MapPin        },
];

// Items accessible via the More drawer on mobile
const moreNavItems: NavItem[] = [
  { label: 'History',  path: DRIVER_ROUTES.HISTORY,   icon: ClipboardList },
  { label: 'Receipts', path: DRIVER_ROUTES.RECEIPTS,  icon: Receipt       }, // ← NEW
  { label: 'My Sales', path: DRIVER_ROUTES.SALES,     icon: ShoppingCart  },
  { label: 'Profile',  path: DRIVER_ROUTES.PROFILE,   icon: User          },
  { label: 'Settings', path: DRIVER_ROUTES.SETTINGS,  icon: Settings      },
];

// Desktop sidebar — all items
const sidebarItems: NavItem[] = [
  { label: 'Dashboard',        path: DRIVER_ROUTES.DASHBOARD,  icon: Home          },
  { label: 'Delivery Queue',   path: DRIVER_ROUTES.DELIVERIES, icon: Truck         },
  { label: 'Van Stock',        path: DRIVER_ROUTES.STORE,      icon: PackageSearch },
  { label: 'Delivery History', path: DRIVER_ROUTES.HISTORY,    icon: ClipboardList },
  { label: 'Receipts',         path: DRIVER_ROUTES.RECEIPTS,   icon: Receipt       }, // ← NEW
  { label: 'My Sales',         path: DRIVER_ROUTES.SALES,      icon: ShoppingCart  },
  { label: 'Live Map',         path: DRIVER_ROUTES.MAP,        icon: MapPin        },
  { label: 'Profile',          path: DRIVER_ROUTES.PROFILE,    icon: User          },
  { label: 'Settings',         path: DRIVER_ROUTES.SETTINGS,   icon: Settings      },
];

// ── More drawer ───────────────────────────────────────────────────────────────

interface MoreDrawerProps {
  open:        boolean;
  onClose:     () => void;
  isActive:    (path: string) => boolean;
  onNavigate:  (path: string) => void;
  displayName: string;
  initials:    string;
  email:       string;
  onLogout:    () => void;
}

const MoreDrawer: React.FC<MoreDrawerProps> = ({
  open, onClose, isActive, onNavigate, displayName, initials, email, onLogout,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl shadow-2xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* User info */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted/50 hover:bg-muted transition-colors shrink-0"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Grid of overflow nav items */}
        <div className="px-4 py-4 grid grid-cols-4 gap-3">
          {moreNavItems.map(item => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => { onNavigate(item.path); onClose(); }}
                className={cn(
                  'flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all active:scale-[0.96]',
                  active ? 'bg-primary/10' : 'hover:bg-muted/60',
                )}
              >
                <div className={cn(
                  'h-11 w-11 rounded-2xl flex items-center justify-center transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/60 text-muted-foreground',
                )}>
                  <item.icon className="h-5 w-5" />
                </div>
                <span className={cn(
                  'text-[11px] font-semibold text-center leading-tight',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Logout */}
        <div className="px-4 pt-1 pb-4 border-t border-border/40">
          <button
            onClick={() => { onLogout(); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-destructive font-semibold text-sm hover:bg-destructive/8 transition-colors active:scale-[0.98]"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign Out
          </button>
        </div>

        {/* Safe area */}
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  );
};

// ── Layout ────────────────────────────────────────────────────────────────────

export const DriverLayout: React.FC<DriverLayoutProps> = ({
  children, title, subtitle, showBackButton, onBack,
}) => {
  const { user, logout } = useAuth();
  const location         = useLocation();
  const navigate         = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (path: string) =>
    path === DRIVER_ROUTES.DASHBOARD
      ? location.pathname === path
      : location.pathname.startsWith(path);

  // True if any "more" item is currently active — lights up the More tab
  const moreIsActive = moreNavItems.some(item => isActive(item.path));

  const initials    = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('') || '?';
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Driver';
  const handleBack  = () => { if (onBack) onBack(); else navigate(-1); };

  return (
    <div className="min-h-screen bg-background flex">

      {/* ─── Desktop Sidebar ──────────────────────────────────────── */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-border bg-card z-30">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-ocean shadow-glow">
            <Droplets className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <span className="text-lg font-bold tracking-tight">AquaTrack</span>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest -mt-0.5">Driver Portal</p>
          </div>
        </div>

        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email ?? 'Driver'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {sidebarItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive(item.path)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-border">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* ─── Main area ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">

        {/* Mobile-optimized header */}
        <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {showBackButton ? (
              <button
                onClick={handleBack}
                className="flex items-center justify-center h-9 w-9 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 -ml-1"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : (
              <div className="flex lg:hidden items-center gap-2 shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-ocean">
                  <Droplets className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
            )}

            {title ? (
              <div className="min-w-0 flex-1">
                <h1 className="text-[15px] font-bold leading-tight truncate lg:text-lg">{title}</h1>
                {subtitle && (
                  <p className="text-[11px] text-muted-foreground leading-tight truncate">{subtitle}</p>
                )}
              </div>
            ) : (
              <div className="flex-1" />
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <NotificationBell />

            {/* Desktop profile dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hidden lg:flex h-9 w-9 rounded-xl">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
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
                  <NavLink to={DRIVER_ROUTES.PROFILE} className="cursor-pointer">
                    <User className="h-4 w-4 mr-2" />Profile
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <NavLink to={DRIVER_ROUTES.DELIVERIES} className="cursor-pointer">
                    <Package className="h-4 w-4 mr-2" />My Deliveries
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <NavLink to={DRIVER_ROUTES.STORE} className="cursor-pointer">
                    <PackageSearch className="h-4 w-4 mr-2" />Van Stock
                  </NavLink>
                </DropdownMenuItem>
                {/* ← NEW */}
                <DropdownMenuItem asChild>
                  <NavLink to={DRIVER_ROUTES.RECEIPTS} className="cursor-pointer">
                    <Receipt className="h-4 w-4 mr-2" />Receipts
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <NavLink to={DRIVER_ROUTES.SETTINGS} className="cursor-pointer">
                    <Settings className="h-4 w-4 mr-2" />Settings
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 px-4 py-4 lg:px-8 lg:py-6 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-8 overflow-x-hidden">
          <div className="max-w-5xl mx-auto w-full">{children}</div>
        </main>
      </div>

      {/* ─── Mobile Bottom Nav ────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden border-t border-border bg-background/98 backdrop-blur-xl">
        <div
          className="flex items-stretch justify-around px-1"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {/* Primary tabs */}
          {primaryNavItems.map(item => {
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className="flex flex-col items-center justify-center gap-0.5 flex-1 pt-2 pb-2.5 min-h-[56px]"
              >
                <div className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-2xl transition-all duration-200',
                  active ? 'bg-primary/12 scale-110' : 'scale-100',
                )}>
                  <item.icon className={cn(
                    'h-[22px] w-[22px] transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )} />
                </div>
                <span className={cn(
                  'text-[10px] font-semibold tracking-wide transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}>
                  {item.label}
                </span>
              </NavLink>
            );
          })}

          {/* More tab */}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 pt-2 pb-2.5 min-h-[56px]"
          >
            <div className={cn(
              'flex items-center justify-center h-8 w-8 rounded-2xl transition-all duration-200',
              moreIsActive ? 'bg-primary/12 scale-110' : 'scale-100',
            )}>
              <MoreHorizontal className={cn(
                'h-[22px] w-[22px] transition-colors',
                moreIsActive ? 'text-primary' : 'text-muted-foreground',
              )} />
            </div>
            <span className={cn(
              'text-[10px] font-semibold tracking-wide transition-colors',
              moreIsActive ? 'text-primary' : 'text-muted-foreground',
            )}>
              More
            </span>
          </button>
        </div>
      </nav>

      {/* More drawer */}
      <MoreDrawer
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        isActive={isActive}
        onNavigate={path => navigate(path)}
        displayName={displayName}
        initials={initials}
        email={user?.email ?? ''}
        onLogout={logout}
      />
    </div>
  );
};

export default DriverLayout;
