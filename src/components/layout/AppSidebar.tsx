/**
 * AppSidebar.tsx
 *
 * Changes in this revision:
 *  - Removed siteManagerNav (site_manager now uses ManagerLayout)
 *  - Removed 'site_manager' case from getNavItems()
 */

import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/constants/routes';
import { roleLabels } from '@/types/auth.types';
import {
  LayoutDashboard,
  Users,
  Package,
  Truck,
  FileText,
  Settings,
  Building2,
  CreditCard,
  ClipboardList,
  UserCog,
  ScrollText,
  Droplets,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Store,
  PackageSearch,
  ShoppingBag,
  MoreHorizontal,
  X,
  BookOpen,
  TrendingUp,
  Calculator,
  Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

interface NavItem {
  label: string;
  path:  string;
  icon:  React.ElementType;
}

const superAdminNav: NavItem[] = [
  { label: 'Dashboard',    path: ROUTES.SUPER_ADMIN.DASHBOARD,  icon: LayoutDashboard },
  { label: 'Clients',      path: ROUTES.SUPER_ADMIN.CLIENTS,    icon: Building2       },
  { label: 'Billing Plans',path: ROUTES.SUPER_ADMIN.BILLING,    icon: CreditCard      },
  { label: 'Audit Logs',   path: ROUTES.SUPER_ADMIN.AUDIT_LOGS, icon: ScrollText      },
  { label: 'Settings',     path: ROUTES.SUPER_ADMIN.SETTINGS,   icon: Settings        },
];

const clientAdminNav: NavItem[] = [
  { label: 'Dashboard',    path: ROUTES.CLIENT_ADMIN.DASHBOARD,  icon: LayoutDashboard },
  { label: 'Orders',       path: ROUTES.CLIENT_ADMIN.ORDERS,     icon: ClipboardList   },
  { label: 'Deliveries',   path: ROUTES.CLIENT_ADMIN.DELIVERIES, icon: Truck           },
  { label: 'Direct Sales', path: '/client/direct-sales',         icon: ShoppingBag     },
  { label: 'Store',        path: ROUTES.CLIENT_ADMIN.STORE,      icon: Store           },
  { label: 'Customers',    path: ROUTES.CLIENT_ADMIN.CUSTOMERS,  icon: Users           },
  { label: 'Products',     path: ROUTES.CLIENT_ADMIN.PRODUCTS,   icon: Package         },
  { label: 'Employees',    path: ROUTES.CLIENT_ADMIN.EMPLOYEES,  icon: UserCog         },
  { label: 'Settings',     path: ROUTES.CLIENT_ADMIN.SETTINGS,   icon: Settings        },
  { label: 'Reports',      path: ROUTES.CLIENT_ADMIN.REPORTS,    icon: TrendingUp      },
  // ── Accounts section ────────────────────────────────────────────────────
  { label: 'Accounts',     path: '/client/accounts/settings',   icon: BookOpen    },
  { label: 'Invoices',     path: '/client/accounts/invoices',   icon: FileText    },
];

const accountantNav: NavItem[] = [
  { label: 'Invoices',  path: '/client/accounts/invoices',  icon: FileText    },
  { label: 'Customers', path: '/client/accounts/customers', icon: Users       },
  { label: 'Reports',   path: '/client/accounts/reports',   icon: TrendingUp  },
  { label: 'Accounts',  path: '/client/accounts/settings',  icon: Calculator  },
  { label: 'Direct Sales', path: '/client/accounts/direct-sales', icon: ShoppingBag },
];

const driverNav: NavItem[] = [
  { label: 'Dashboard',     path: ROUTES.DRIVER.DASHBOARD,  icon: LayoutDashboard },
  { label: 'My Deliveries', path: ROUTES.DRIVER.DELIVERIES, icon: Truck           },
  { label: 'Van Stock',     path: ROUTES.DRIVER.STORE,      icon: PackageSearch   },
  { label: 'Receipts',      path: '/driver/receipts',        icon: Receipt         },
];

const MOBILE_PRIMARY_COUNT = 4;

interface AppSidebarProps {
  collapsed: boolean;
  onToggle:  () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ collapsed, onToggle }) => {
  const { user, logout } = useAuth();
  const location         = useLocation();
  const navigate         = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const getNavItems = (): NavItem[] => {
    switch (user?.role) {
      case 'super_admin':  return superAdminNav;
      case 'client_admin': return clientAdminNav;
      case 'driver':       return driverNav;
      case 'accountant':   return accountantNav;
      // site_manager uses ManagerLayout — not rendered through AppSidebar
      default:             return [];
    }
  };

  const navItems = getNavItems();

  const isActiveRoute = (path: string) => {
    if (path === location.pathname) return true;
    const pathParts     = path.split('/').filter(Boolean);
    const locationParts = location.pathname.split('/').filter(Boolean);
    if (
      pathParts.length === 1 &&
      locationParts[0] === pathParts[0] &&
      locationParts.length === 1
    ) {
      return true;
    }
    return false;
  };

  const primaryItems     = navItems.slice(0, MOBILE_PRIMARY_COUNT);
  const overflowItems    = navItems.slice(MOBILE_PRIMARY_COUNT);
  const hasOverflow      = overflowItems.length > 0;
  const overflowIsActive = overflowItems.some(item => isActiveRoute(item.path));

  const initials    = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('') || '?';
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';

  return (
    <>
      {/* ─── Desktop sidebar ──────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 ease-in-out flex-col',
          'hidden lg:flex',
          collapsed ? 'w-20' : 'w-64',
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-ocean shadow-glow">
              <Droplets className="h-6 w-6 text-primary-foreground" />
            </div>
            {!collapsed && (
              <span className="text-lg font-bold text-sidebar-foreground">AquaTrack</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {collapsed
              ? <ChevronRight className="h-4 w-4" />
              : <ChevronLeft  className="h-4 w-4" />
            }
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {navItems.map(item => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isActiveRoute(item.path)
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-glow'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            <Avatar className="h-9 w-9 border-2 border-sidebar-primary/30">
              <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {user?.role && roleLabels[user.role]}
                </p>
              </div>
            )}
          </div>

          {!collapsed && <Separator className="my-3 bg-sidebar-border" />}

          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'default'}
            onClick={logout}
            className={cn(
              'text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10',
              collapsed ? 'w-full justify-center' : 'w-full justify-start',
            )}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Logout</span>}
          </Button>
        </div>
      </aside>

      {/* ─── Mobile top bar ─────────────────────────────────────────── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-ocean shadow-glow">
            <Droplets className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-base font-bold">AquaTrack</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium hidden sm:block">
            {user?.role && roleLabels[user.role]}
          </span>
          <Avatar className="h-8 w-8 border border-sidebar-primary/30">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* ─── Mobile bottom nav ──────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/98 backdrop-blur-xl">
        <div
          className="flex items-stretch justify-around px-1"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {primaryItems.map(item => {
            const active = isActiveRoute(item.path);
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
                  'text-[10px] font-semibold tracking-wide transition-colors truncate max-w-[52px] text-center',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}>
                  {item.label}
                </span>
              </NavLink>
            );
          })}

          {hasOverflow && (
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 pt-2 pb-2.5 min-h-[56px]"
            >
              <div className={cn(
                'flex items-center justify-center h-8 w-8 rounded-2xl transition-all duration-200',
                overflowIsActive ? 'bg-primary/12 scale-110' : 'scale-100',
              )}>
                <MoreHorizontal className={cn(
                  'h-[22px] w-[22px] transition-colors',
                  overflowIsActive ? 'text-primary' : 'text-muted-foreground',
                )} />
              </div>
              <span className={cn(
                'text-[10px] font-semibold tracking-wide',
                overflowIsActive ? 'text-primary' : 'text-muted-foreground',
              )}>
                More
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* ─── More drawer ────────────────────────────────────────────── */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />

          <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl shadow-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>

            <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.role && roleLabels[user.role]}
                </p>
              </div>
              <button
                onClick={() => setMoreOpen(false)}
                className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted/50 hover:bg-muted transition-colors shrink-0"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="px-4 py-4 grid grid-cols-4 gap-3">
              {overflowItems.map(item => {
                const active = isActiveRoute(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setMoreOpen(false); }}
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

            <div className="px-4 pt-1 pb-4 border-t border-border/40">
              <button
                onClick={() => { logout(); setMoreOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-destructive font-semibold text-sm hover:bg-destructive/8 transition-colors active:scale-[0.98]"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Sign Out
              </button>
            </div>

            <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
          </div>
        </div>
      )}
    </>
  );
};