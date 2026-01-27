import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  BarChart3,
  ClipboardList,
  Warehouse,
  UserCog,
  ScrollText,
  Droplets,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const superAdminNav: NavItem[] = [
  { label: 'Dashboard', path: ROUTES.SUPER_ADMIN.DASHBOARD, icon: LayoutDashboard },
  { label: 'Clients', path: ROUTES.SUPER_ADMIN.CLIENTS, icon: Building2 },
  { label: 'Billing Plans', path: ROUTES.SUPER_ADMIN.BILLING, icon: CreditCard },
  { label: 'Audit Logs', path: ROUTES.SUPER_ADMIN.AUDIT_LOGS, icon: ScrollText },
  { label: 'Settings', path: ROUTES.SUPER_ADMIN.SETTINGS, icon: Settings },
];

const clientAdminNav: NavItem[] = [
  { label: 'Dashboard', path: ROUTES.CLIENT_ADMIN.DASHBOARD, icon: LayoutDashboard },
  { label: 'Orders', path: ROUTES.CLIENT_ADMIN.ORDERS, icon: ClipboardList },
  { label: 'Deliveries', path: ROUTES.CLIENT_ADMIN.DELIVERIES, icon: Truck },
  { label: 'Customers', path: ROUTES.CLIENT_ADMIN.CUSTOMERS, icon: Users },
  { label: 'Invoices', path: ROUTES.CLIENT_ADMIN.INVOICES, icon: FileText },
  { label: 'Inventory', path: ROUTES.CLIENT_ADMIN.INVENTORY, icon: Warehouse },
  { label: 'Reports', path: ROUTES.CLIENT_ADMIN.REPORTS, icon: BarChart3 },
  { label: 'Employees', path: ROUTES.CLIENT_ADMIN.EMPLOYEES, icon: UserCog },
  { label: 'Settings', path: ROUTES.CLIENT_ADMIN.SETTINGS, icon: Settings },
];

const siteManagerNav: NavItem[] = [
  { label: 'Dashboard', path: ROUTES.SITE_MANAGER.DASHBOARD, icon: LayoutDashboard },
  { label: 'Create Order', path: ROUTES.SITE_MANAGER.CREATE_ORDER, icon: Package },
  { label: 'Orders', path: ROUTES.SITE_MANAGER.ORDERS, icon: ClipboardList },
  { label: 'Inventory', path: ROUTES.SITE_MANAGER.INVENTORY, icon: Warehouse },
];

const driverNav: NavItem[] = [
  { label: 'Dashboard', path: ROUTES.DRIVER.DASHBOARD, icon: LayoutDashboard },
  { label: 'My Deliveries', path: ROUTES.DRIVER.DELIVERIES, icon: Truck },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ collapsed, onToggle }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const getNavItems = (): NavItem[] => {
    switch (user?.role) {
      case 'super_admin':
        return superAdminNav;
      case 'client_admin':
        return clientAdminNav;
      case 'site_manager':
        return siteManagerNav;
      case 'driver':
        return driverNav;
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  const isActiveRoute = (path: string) => {
    if (path === location.pathname) return true;
    // Check for nested routes
    const pathParts = path.split('/').filter(Boolean);
    const locationParts = location.pathname.split('/').filter(Boolean);
    if (pathParts.length === 1 && locationParts[0] === pathParts[0] && locationParts.length === 1) {
      return true;
    }
    return false;
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 ease-in-out flex flex-col',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-ocean shadow-glow">
            <Droplets className="h-6 w-6 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold text-sidebar-foreground">
              AquaTrack
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActiveRoute(item.path)
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-glow'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-4">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <Avatar className="h-9 w-9 border-2 border-sidebar-primary/30">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-sm">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
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
            collapsed ? 'w-full justify-center' : 'w-full justify-start'
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Logout</span>}
        </Button>
      </div>
    </aside>
  );
};
