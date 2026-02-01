/**
 * Customer Layout Component
 * Mobile-first layout with bottom navigation for customer portal
 */

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { CUSTOMER_ROUTES } from '@/constants/customerRoutes';
import {
  Home,
  Package,
  Droplets,
  Wallet,
  User,
  Bell,
  Menu,
  LogOut,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface CustomerLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
  onBack?: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const bottomNavItems: NavItem[] = [
  { label: 'Home', path: CUSTOMER_ROUTES.DASHBOARD, icon: Home },
  { label: 'Orders', path: CUSTOMER_ROUTES.ORDER_HISTORY, icon: Package },
  { label: 'Bottles', path: CUSTOMER_ROUTES.BOTTLES, icon: Droplets },
  { label: 'Wallet', path: CUSTOMER_ROUTES.WALLET, icon: Wallet },
  { label: 'Profile', path: CUSTOMER_ROUTES.PROFILE, icon: User },
];

const sideMenuItems: NavItem[] = [
  { label: 'Home', path: CUSTOMER_ROUTES.DASHBOARD, icon: Home },
  { label: 'Place Order', path: CUSTOMER_ROUTES.PLACE_ORDER, icon: Package },
  { label: 'Order History', path: CUSTOMER_ROUTES.ORDER_HISTORY, icon: Package },
  { label: 'My Bottles', path: CUSTOMER_ROUTES.BOTTLES, icon: Droplets },
  { label: 'Wallet', path: CUSTOMER_ROUTES.WALLET, icon: Wallet },
  { label: 'Addresses', path: CUSTOMER_ROUTES.ADDRESSES, icon: Settings },
  { label: 'Profile', path: CUSTOMER_ROUTES.PROFILE, icon: User },
  { label: 'Notifications', path: CUSTOMER_ROUTES.NOTIFICATIONS, icon: Bell },
  { label: 'Support', path: CUSTOMER_ROUTES.SUPPORT, icon: HelpCircle },
];

interface CustomerLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export const CustomerLayout: React.FC<CustomerLayoutProps> = ({
  children,
  title,
}) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const isActiveRoute = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen bg-gradient-surface pb-20 lg:pb-0">
      {/* Customer Header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
        <div className="flex items-center gap-3">
          {/* Mobile Menu Trigger */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-ocean">
                    <Droplets className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <SheetTitle className="text-left">AquaTrack</SheetTitle>
                </div>
              </SheetHeader>
              
              {/* User info */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
              </div>
              
              {/* Navigation */}
              <nav className="p-2">
                {sideMenuItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors',
                      isActiveRoute(item.path)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              
              {/* Logout */}
              <div className="absolute bottom-4 left-4 right-4">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo for desktop */}
          <div className="hidden lg:flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-ocean">
              <Droplets className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">AquaTrack</span>
          </div>

          {/* Page Title */}
          {title && (
            <h1 className="text-lg font-semibold lg:ml-4">{title}</h1>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  2
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                Notifications
                <Badge variant="secondary" className="text-xs">2 new</Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
                <span className="font-medium">🚚 Driver is nearby!</span>
                <span className="text-xs text-muted-foreground">Hassan is 5 minutes away</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
                <span className="font-medium">✅ Order Confirmed</span>
                <span className="text-xs text-muted-foreground">Your order #12345 has been confirmed</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profile dropdown (desktop) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="hidden lg:flex">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{user?.firstName} {user?.lastName}</span>
                  <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <NavLink to={CUSTOMER_ROUTES.PROFILE} className="cursor-pointer">
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </NavLink>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <NavLink to={CUSTOMER_ROUTES.ADDRESSES} className="cursor-pointer">
                  <Settings className="h-4 w-4 mr-2" />
                  Addresses
                </NavLink>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <NavLink to={CUSTOMER_ROUTES.SUPPORT} className="cursor-pointer">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Help & Support
                </NavLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 lg:p-6 lg:max-w-4xl lg:mx-auto">
        <div className="animate-fade-in">
          {children}
        </div>
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-around h-16">
          {bottomNavItems.map((item) => {
            const isActive = isActiveRoute(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 px-3 py-2 min-w-[64px] rounded-lg transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                <span className={cn(
                  'text-[10px] font-medium',
                  isActive ? 'text-primary' : 'text-muted-foreground'
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
