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
import UnauthorizedPage from "@/pages/UnauthorizedPage";
import NotFound from "@/pages/NotFound";

// Super Admin Pages
import { SuperAdminDashboard } from "@/pages/superadmin/SuperAdminDashboard";

// Client Admin Pages
import { ClientAdminDashboard } from "@/pages/client/ClientAdminDashboard";
import { OrdersPage } from "@/pages/client/OrdersPage";
import { DeliveriesPage } from "@/pages/client/DeliveriesPage";
import { CustomersPage } from "@/pages/client/CustomersPage";

// Site Manager Pages
import { SiteManagerDashboard } from "@/pages/manager/SiteManagerDashboard";

// Driver Pages
import { DriverDashboard } from "@/pages/driver/DriverDashboard";

const queryClient = new QueryClient();

// Component to handle root redirect based on auth state
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
      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />
      
      {/* Public routes */}
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      
      {/* Super Admin routes */}
      <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
        <Route path={ROUTES.SUPER_ADMIN.DASHBOARD} element={<SuperAdminDashboard />} />
        <Route path={ROUTES.SUPER_ADMIN.CLIENTS} element={<SuperAdminDashboard />} />
        <Route path={ROUTES.SUPER_ADMIN.BILLING} element={<SuperAdminDashboard />} />
        <Route path={ROUTES.SUPER_ADMIN.SETTINGS} element={<SuperAdminDashboard />} />
        <Route path={ROUTES.SUPER_ADMIN.AUDIT_LOGS} element={<SuperAdminDashboard />} />
      </Route>
      
      {/* Client Admin routes */}
      <Route element={<ProtectedRoute allowedRoles={['client_admin', 'super_admin']} />}>
        <Route path={ROUTES.CLIENT_ADMIN.DASHBOARD} element={<ClientAdminDashboard />} />
        <Route path={ROUTES.CLIENT_ADMIN.ORDERS} element={<OrdersPage />} />
        <Route path={ROUTES.CLIENT_ADMIN.DELIVERIES} element={<DeliveriesPage />} />
        <Route path={ROUTES.CLIENT_ADMIN.CUSTOMERS} element={<CustomersPage />} />
        <Route path={ROUTES.CLIENT_ADMIN.INVOICES} element={<ClientAdminDashboard />} />
        <Route path={ROUTES.CLIENT_ADMIN.INVENTORY} element={<ClientAdminDashboard />} />
        <Route path={ROUTES.CLIENT_ADMIN.REPORTS} element={<ClientAdminDashboard />} />
        <Route path={ROUTES.CLIENT_ADMIN.EMPLOYEES} element={<ClientAdminDashboard />} />
        <Route path={ROUTES.CLIENT_ADMIN.SETTINGS} element={<ClientAdminDashboard />} />
      </Route>
      
      {/* Site Manager routes */}
      <Route element={<ProtectedRoute allowedRoles={['site_manager', 'client_admin', 'super_admin']} />}>
        <Route path={ROUTES.SITE_MANAGER.DASHBOARD} element={<SiteManagerDashboard />} />
        <Route path={ROUTES.SITE_MANAGER.CREATE_ORDER} element={<SiteManagerDashboard />} />
        <Route path={ROUTES.SITE_MANAGER.ORDERS} element={<SiteManagerDashboard />} />
        <Route path={ROUTES.SITE_MANAGER.INVENTORY} element={<SiteManagerDashboard />} />
      </Route>
      
      {/* Driver routes */}
      <Route element={<ProtectedRoute allowedRoles={['driver', 'site_manager', 'client_admin', 'super_admin']} />}>
        <Route path={ROUTES.DRIVER.DASHBOARD} element={<DriverDashboard />} />
        <Route path={ROUTES.DRIVER.DELIVERIES} element={<DriverDashboard />} />
      </Route>
      
      {/* Catch-all */}
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
