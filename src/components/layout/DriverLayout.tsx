/**
 * Driver Layout Component
 * Mobile-first: 4 primary tabs + "More" left drawer.
 * Desktop keeps the full sidebar unchanged.
 *
 * Changes in this revision:
 *  - Mobile "More" bottom sheet replaced with left-side drawer (translate-based),
 *    matching AppSidebar pattern
 *  - MoreDrawer component removed; mobileOpen state drives the drawer directly
 *  - Desktop sidebar, all nav routes, isActive(), header, and page content unchanged
 */

import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  Home, Truck, ClipboardList, MapPin, User,
  LogOut, Package, Settings, ChevronLeft, Droplets,
  PackageSearch, ShoppingCart, MoreHorizontal, X,
  Receipt,
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
  RECEIPTS:   '/driver/receipts',
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
  { label: 'History',  path: DRIVER_ROUTES.HISTORY,  icon: ClipboardList },
  { label: 'Receipts', path: DRIVER_ROUTES.RECEIPTS, icon: Receipt       },
  { label: 'My Sales', path: DRIVER_ROUTES.SALES,    icon: ShoppingCart  },
  { label: 'Profile',  path: DRIVER_ROUTES.PROFILE,  icon: User          },
  { label: 'Settings', path: DRIVER_ROUTES.SETTINGS, icon: Settings      },
];

// Desktop sidebar — all items
const sidebarItems: NavItem[] = [
  { label: 'Dashboard',        path: DRIVER_ROUTES.DASHBOARD,  icon: Home          },
  { label: 'Delivery Queue',   path: DRIVER_ROUTES.DELIVERIES, icon: Truck         },
  { label: 'Van Stock',        path: DRIVER_ROUTES.STORE,      icon: PackageSearch },
  { label: 'Delivery History', path: DRIVER_ROUTES.HISTORY,    icon: ClipboardList },
  { label: 'Receipts',         path: DRIVER_ROUTES.RECEIPTS,   icon: Receipt       },
  { label: 'My Sales',         path: DRIVER_ROUTES.SALES,      icon: ShoppingCart  },
  { label: 'Live Map',         path: DRIVER_ROUTES.MAP,        icon: MapPin        },
  { label: 'Profile',          path: DRIVER_ROUTES.PROFILE,    icon: User          },
  { label: 'Settings',         path: DRIVER_ROUTES.SETTINGS,   icon: Settings      },
];

// ── Layout ────────────────────────────────────────────────────────────────────

export const DriverLayout: React.FC<DriverLayoutProps> = ({
  children, title, subtitle, showBackButton, onBack,
}) => {
  const { user, logout } = useAuth();
  const location         = useLocation();
  const navigate         = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) =>
    path === DRIVER_ROUTES.DASHBOARD
      ? location.pathname === path
      : location.pathname.startsWith(path);

  const moreIsActive = moreNavItems.some(item => isActive(item.path));

  const initials    = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('') || '?';
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Driver';
  const handleBack  = () => { if (onBack) onBack(); else navigate(-1); };

  return (
    <div className="min-h-screen bg-background flex">

      {/* ─── Mobile backdrop overlay ──────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

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

      {/* ─── Mobile left drawer sidebar ───────────────────────────── */}
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
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest -mt-0.5">Driver Portal</p>
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
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {[...primaryNavItems, ...moreNavItems].map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
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

        {/* Drawer footer */}
        <div className="border-t border-border p-4 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email ?? 'Driver'}</p>
            </div>
          </div>
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

          {/* More — opens the left drawer */}
          <button
            onClick={() => setMobileOpen(true)}
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
    </div>
  );
};

export default DriverLayout;