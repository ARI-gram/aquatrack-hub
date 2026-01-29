import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ROUTES, roleDefaultRoutes } from "@/constants/routes";
import { ProtectedRoute } from "@/routes/ProtectedRoute";

// Auth Pages
import { LoginPage } from "@/pages/auth/LoginPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import UnauthorizedPage from "@/pages/UnauthorizedPage";
import NotFound from "@/pages/NotFound";

// Super Admin Pages
import { SuperAdminDashboard } from "@/pages/superadmin/SuperAdminDashboard";
import ClientManagementPage from "@/pages/superadmin/ClientManagementPage";
import BillingPlansPage from "@/pages/superadmin/BillingPlansPage";
import SystemSettingsPage from "@/pages/superadmin/SystemSettingsPage";
import AuditLogsPage from "@/pages/superadmin/AuditLogsPage";

// Client Admin Pages
import { ClientAdminDashboard } from "@/pages/client/ClientAdminDashboard";
import { OrdersPage } from "@/pages/client/OrdersPage";
import { DeliveriesPage } from "@/pages/client/DeliveriesPage";
import { CustomersPage } from "@/pages/client/CustomersPage";
import InvoicesPage from "@/pages/client/InvoicesPage";
import InventoryPage from "@/pages/client/InventoryPage";
import ReportsPage from "@/pages/client/ReportsPage";
import EmployeesPage from "@/pages/client/EmployeesPage";
import ClientSettingsPage from "@/pages/client/SettingsPage";

// Site Manager Pages
import { SiteManagerDashboard } from "@/pages/manager/SiteManagerDashboard";
import CreateOrderPage from "@/pages/manager/CreateOrderPage";
import ManagerOrdersPage from "@/pages/manager/OrdersPage";
import SiteInventoryPage from "@/pages/manager/SiteInventoryPage";

// Driver Pages
import { DriverDashboard } from "@/pages/driver/DriverDashboard";
import DeliveryQueuePage from "@/pages/driver/DeliveryQueuePage";
import DeliveryDetailPage from "@/pages/driver/DeliveryDetailPage";

// Customer Pages
import CustomerDashboard from "@/pages/customer/CustomerDashboard";
import PlaceOrderPage from "@/pages/customer/PlaceOrderPage";
import OrderHistoryPage from "@/pages/customer/OrderHistoryPage";
import WalletPage from "@/pages/customer/WalletPage";

const queryClient = new QueryClient();

const RootRedirect = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-surface">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated || !user) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }
  
  return <Navigate to={roleDefaultRoutes[user.role]} replace />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      
      {/* Public routes */}
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      
      {/* Super Admin routes */}
      <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
        <Route path={ROUTES.SUPER_ADMIN.DASHBOARD} element={<SuperAdminDashboard />} />
        <Route path={ROUTES.SUPER_ADMIN.CLIENTS} element={<ClientManagementPage />} />
        <Route path={ROUTES.SUPER_ADMIN.BILLING} element={<BillingPlansPage />} />
        <Route path={ROUTES.SUPER_ADMIN.SETTINGS} element={<SystemSettingsPage />} />
        <Route path={ROUTES.SUPER_ADMIN.AUDIT_LOGS} element={<AuditLogsPage />} />
      </Route>
      
      {/* Client Admin routes */}
      <Route element={<ProtectedRoute allowedRoles={['client_admin', 'super_admin']} />}>
        <Route path={ROUTES.CLIENT_ADMIN.DASHBOARD} element={<ClientAdminDashboard />} />
        <Route path={ROUTES.CLIENT_ADMIN.ORDERS} element={<OrdersPage />} />
        <Route path={ROUTES.CLIENT_ADMIN.DELIVERIES} element={<DeliveriesPage />} />
        <Route path={ROUTES.CLIENT_ADMIN.CUSTOMERS} element={<CustomersPage />} />
        <Route path={ROUTES.CLIENT_ADMIN.INVOICES} element={<InvoicesPage />} />
        <Route path={ROUTES.CLIENT_ADMIN.INVENTORY} element={<InventoryPage />} />
        <Route path={ROUTES.CLIENT_ADMIN.REPORTS} element={<ReportsPage />} />
        <Route path={ROUTES.CLIENT_ADMIN.EMPLOYEES} element={<EmployeesPage />} />
        <Route path={ROUTES.CLIENT_ADMIN.SETTINGS} element={<ClientSettingsPage />} />
      </Route>
      
      {/* Site Manager routes */}
      <Route element={<ProtectedRoute allowedRoles={['site_manager', 'client_admin', 'super_admin']} />}>
        <Route path={ROUTES.SITE_MANAGER.DASHBOARD} element={<SiteManagerDashboard />} />
        <Route path={ROUTES.SITE_MANAGER.CREATE_ORDER} element={<CreateOrderPage />} />
        <Route path={ROUTES.SITE_MANAGER.ORDERS} element={<ManagerOrdersPage />} />
        <Route path={ROUTES.SITE_MANAGER.INVENTORY} element={<SiteInventoryPage />} />
      </Route>
      
      {/* Driver routes */}
      <Route element={<ProtectedRoute allowedRoles={['driver', 'site_manager', 'client_admin', 'super_admin']} />}>
        <Route path={ROUTES.DRIVER.DASHBOARD} element={<DriverDashboard />} />
        <Route path={ROUTES.DRIVER.DELIVERIES} element={<DeliveryQueuePage />} />
        <Route path={ROUTES.DRIVER.DELIVERY_DETAIL} element={<DeliveryDetailPage />} />
      </Route>
      
      {/* Customer routes */}
      <Route element={<ProtectedRoute allowedRoles={['customer', 'site_manager', 'client_admin', 'super_admin']} />}>
        <Route path={ROUTES.CUSTOMER.DASHBOARD} element={<CustomerDashboard />} />
        <Route path={ROUTES.CUSTOMER.PLACE_ORDER} element={<PlaceOrderPage />} />
        <Route path={ROUTES.CUSTOMER.ORDER_HISTORY} element={<OrderHistoryPage />} />
        <Route path={ROUTES.CUSTOMER.WALLET} element={<WalletPage />} />
      </Route>
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
