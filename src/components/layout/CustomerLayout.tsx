/**
 * Customer Layout Component
 * Responsive: desktop sidebar + mobile bottom nav
 */

import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { CUSTOMER_ROUTES } from '@/constants/customerRoutes';
import {
  Home, Package, Droplets, Wallet, User, Bell, LogOut,
  HelpCircle, Settings, MapPin, ChevronLeft, ShoppingCart,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationBell } from '@/components/layout/NotificationBell';

interface CustomerLayoutProps {
  children:        React.ReactNode;
  title?:          string;
  showBackButton?: boolean;
  onBack?:         () => void;
}

interface NavItem {
  label: string;
  path:  string;
  icon:  React.ElementType;
}

const bottomNavItems: NavItem[] = [
  { label: 'Home',    path: CUSTOMER_ROUTES.DASHBOARD,     icon: Home     },
  { label: 'Orders',  path: CUSTOMER_ROUTES.ORDER_HISTORY, icon: Package  },
  { label: 'Bottles', path: CUSTOMER_ROUTES.BOTTLES,       icon: Droplets },
  { label: 'Wallet',  path: CUSTOMER_ROUTES.WALLET,        icon: Wallet   },
  { label: 'Profile', path: CUSTOMER_ROUTES.PROFILE,       icon: User     },
];

const sidebarItems: NavItem[] = [
  { label: 'Dashboard',       path: CUSTOMER_ROUTES.DASHBOARD,       icon: Home         },
  { label: 'Place Order',     path: CUSTOMER_ROUTES.PLACE_ORDER,     icon: ShoppingCart },
  { label: 'Order History',   path: CUSTOMER_ROUTES.ORDER_HISTORY,   icon: Package      },
  { label: 'My Bottles',      path: CUSTOMER_ROUTES.BOTTLES,         icon: Droplets     },
  { label: 'Wallet',          path: CUSTOMER_ROUTES.WALLET,          icon: Wallet       },
  { label: 'Payment Details', path: CUSTOMER_ROUTES.PAYMENT_PROFILE, icon: CreditCard   },
  { label: 'Addresses',       path: CUSTOMER_ROUTES.ADDRESSES,       icon: MapPin       },
  { label: 'Notifications',   path: CUSTOMER_ROUTES.NOTIFICATIONS,   icon: Bell         },
  { label: 'Support',         path: CUSTOMER_ROUTES.SUPPORT,         icon: HelpCircle   },
  { label: 'Profile',         path: CUSTOMER_ROUTES.PROFILE,         icon: User         },
];

export const CustomerLayout: React.FC<CustomerLayoutProps> = ({
  children, title, showBackButton, onBack,
}) => {
  const { user, logout } = useAuth();
  const location         = useLocation();
  const navigate         = useNavigate();

  const isActive    = (path: string) => location.pathname === path;
  const initials    = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('') || '?';
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Customer';
  const handleBack  = () => { if (onBack) onBack(); else navigate(-1); };

  const bellReady = !!user && user.role === 'customer' 
    && !!localStorage.getItem('aquatrack_token');

  return (
    <div className="min-h-screen bg-background flex">

      {/* ─── Desktop Sidebar ─────────────────────────────────────── */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-border bg-card z-30">

        <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-ocean shadow-glow">
            <Droplets className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">AquaTrack</span>
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
              <p className="text-xs text-muted-foreground truncate">
                {user?.email ?? 'Customer'}
              </p>
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

      {/* ─── Main area ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">

        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <div className="flex lg:hidden items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-ocean">
                <Droplets className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>

            {showBackButton && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </button>
            )}

            {title && (
              <h1 className="text-base font-semibold lg:text-lg">{title}</h1>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Gate the bell behind a confirmed session to prevent 401 redirect loops */}
            {bellReady && <NotificationBell />}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hidden lg:flex">
                  <Avatar className="h-8 w-8">
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
                    <span className="text-xs font-normal text-muted-foreground">
                      {user?.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <NavLink to={CUSTOMER_ROUTES.PROFILE} className="cursor-pointer">
                    <User className="h-4 w-4 mr-2" />Profile
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <NavLink to={CUSTOMER_ROUTES.PAYMENT_PROFILE} className="cursor-pointer">
                    <CreditCard className="h-4 w-4 mr-2" />Payment Details
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <NavLink to={CUSTOMER_ROUTES.ADDRESSES} className="cursor-pointer">
                    <Settings className="h-4 w-4 mr-2" />Addresses
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <NavLink to={CUSTOMER_ROUTES.SUPPORT} className="cursor-pointer">
                    <HelpCircle className="h-4 w-4 mr-2" />Help & Support
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-2" />Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 lg:px-8 lg:py-6 pb-24 lg:pb-8">
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* ─── Mobile Bottom Nav ───────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-around h-16 px-1 safe-area-inset-bottom">
          {bottomNavItems.map(item => {
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-xl transition-all',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <div className={cn(
                  'flex items-center justify-center h-7 w-7 rounded-lg transition-colors',
                  active && 'bg-primary/10',
                )}>
                  <item.icon className={cn('h-5 w-5', active && 'text-primary')} />
                </div>
                <span className={cn(
                  'text-[10px] font-medium',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}>
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default CustomerLayout;